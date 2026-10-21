/**
 * Layer 3: an LLM risk judge, run after the phrase rules.
 *
 * Model: openai/gpt-oss-safeguard-20b on Groq (OpenAI-compatible API). It is a
 * policy-following safety classifier: the policy below goes in the system prompt
 * and the model returns one JSON label.
 *
 * Design rules, all checked by test/riskJudge.test.js:
 *   - The rules run first. The judge may only ESCALATE: it can never lower a route
 *     the rules chose, and never clears an imminent flag.
 *   - On timeout, HTTP error, rate limit or unparseable output the judge fails safe:
 *     the rule result stands and the failure is logged (no message text is logged).
 *   - Off unless RISK_JUDGE=groq and GROQ_API_KEY are set, so the app works without a key.
 *
 * Measured in docs/SAFETY_EVAL.md by scripts/judge-eval.js.
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const JUDGE_MODEL = 'openai/gpt-oss-safeguard-20b';
const LABELS = ['NONE', 'CONCERN', 'THIRD_PARTY', 'CRISIS'];
const SEVERITY = Object.fromEntries(LABELS.map((l, i) => [l, i]));

// Written from the labelling rubric in evalCases.js. Examples come from the main
// set only. Kept short on purpose: the Groq free tier allows 3 requests and 2,000
// tokens a minute for this model, and every call counts prompt plus max_tokens.
const POLICY = `# Task
Label ONE chat message sent to a wellbeing companion app. Decide whether the WRITER may be at risk of suicide or self-harm. Judge meaning, not keywords. The message may be English, Hindi, Hinglish or slang.

# Labels
CRISIS: the writer has a current wish to die, suicidal thoughts, intent, a plan, preparations, is saying goodbye, or is self-harming now or has the urge to. Includes indirect wording ("everyone would be better off without me", "I won't be a burden much longer") and euphemisms.
CONCERN: the writer is distressed (hopeless, worthless, empty, can't cope) without current suicidal thoughts; or has past self-harm or a past attempt and no current thoughts; or mentions thoughts of death they clearly say they will not act on.
THIRD_PARTY: the writer is worried that another person may be suicidal or self-harming, and the writer is not at risk themselves.
NONE: no personal risk. Idioms and jokes ("this homework is killing me", "I'd kill for a pizza"), stories, films, news, research or school work about suicide, everyday stress.

# Rules
- If the writer is at risk and also mentions someone else, choose CRISIS.
- If unsure between CRISIS and CONCERN for the writer, choose CRISIS.
- imminent is true only for CRISIS with a time (tonight, tomorrow, a date), a plan, or means at hand. Otherwise false.

# Output
Only JSON: {"label":"CRISIS"|"CONCERN"|"THIRD_PARTY"|"NONE","imminent":true|false}`;

class JudgeError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.kind = kind; // timeout | http | rate_limit | network | parse | config
    this.status = status;
  }
}

/** Pull {label, imminent} out of the model's text. Throws JudgeError('parse') if it can't. */
function parseVerdict(text) {
  const raw = String(text || '');
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new JudgeError('parse', 'no JSON object in judge output');
  let obj;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    throw new JudgeError('parse', 'judge output is not valid JSON');
  }
  const label = String(obj.label || '').toUpperCase().trim();
  if (!LABELS.includes(label)) throw new JudgeError('parse', `unknown label "${label.slice(0, 20)}"`);
  return { label, imminent: label === 'CRISIS' && obj.imminent === true };
}

/**
 * Ask the judge about one message. Resolves to { label, imminent, latencyMs, attempts }.
 * Rejects with JudgeError. Callers in the app should use judgeOrNull, which never rejects.
 *
 * retries applies to 429 and 5xx only (the eval script uses it; the app does not,
 * because a user is waiting).
 */
async function judgeMessage(message, opts = {}) {
  const {
    apiKey = process.env.GROQ_API_KEY,
    model = JUDGE_MODEL,
    timeoutMs = 2500,
    retries = 0,
    fetchImpl = globalThis.fetch,
    sleep = ms => new Promise(r => setTimeout(r, ms)),
    // 512, not the 192 used in the sealed run: at 192 the model's reasoning sometimes
    // ran out of room and the JSON was cut off (13 of 222 eval calls). See SAFETY_EVAL.md.
    maxTokens = 512,
  } = opts;
  if (!apiKey) throw new JudgeError('config', 'GROQ_API_KEY is not set');

  let attempt = 0;
  for (;;) {
    attempt++;
    const started = Date.now();
    let res;
    try {
      res = await fetchImpl(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: POLICY },
            { role: 'user', content: String(message || '').slice(0, 2000) },
          ],
          temperature: 0,
          max_tokens: maxTokens,
          reasoning_effort: 'low',
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const kind = error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'network';
      throw new JudgeError(kind, kind === 'timeout' ? `no answer within ${timeoutMs} ms` : 'network error');
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt <= retries) {
        const retryAfter = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 2000 * 2 ** (attempt - 1));
        await sleep(wait + 250);
        continue;
      }
      throw new JudgeError(res.status === 429 ? 'rate_limit' : 'http', `HTTP ${res.status}`, res.status);
    }
    if (!res.ok) {
      // Groq answers 400 json_validate_failed when the model's output is not valid
      // JSON in JSON mode. That is an unparseable verdict, not a broken request.
      let code = '';
      try {
        const err = await res.json();
        code = String((err && err.error && err.error.code) || '').slice(0, 40);
      } catch { /* no body */ }
      if (code === 'json_validate_failed') throw new JudgeError('parse', 'judge output failed JSON validation', res.status);
      throw new JudgeError('http', `HTTP ${res.status}${code ? ` ${code}` : ''}`, res.status);
    }

    let body;
    try {
      body = await res.json();
    } catch {
      throw new JudgeError('parse', 'response body is not JSON');
    }
    const content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    const verdict = parseVerdict(content);
    return { ...verdict, latencyMs: Date.now() - started, attempts: attempt, usage: body.usage };
  }
}

/** The judge for the app: null when it is switched off or anything goes wrong. */
async function judgeOrNull(message, { log = console, ...opts } = {}) {
  try {
    return await judgeMessage(message, opts);
  } catch (error) {
    if (log && log.warn) log.warn(`risk judge failed safe (${error.kind || 'error'}): ${error.message}; keeping the rule route`);
    return null;
  }
}

/** True when RISK_JUDGE=groq and a key is present. */
function judgeEnabled(env = process.env) {
  return String(env.RISK_JUDGE || '').toLowerCase() === 'groq' && Boolean(env.GROQ_API_KEY);
}

/**
 * Combine the rule route with a judge verdict. Escalate only.
 * rule: { route, imminent, signals }. verdict: { label, imminent } or null.
 * Order of protection: NONE < CONCERN < THIRD_PARTY < CRISIS.
 */
function combine(rule, verdict) {
  const base = { ...rule, decidedBy: 'rules', judge: verdict ? { label: verdict.label, imminent: verdict.imminent } : null };
  if (!verdict) return base;
  const escalate = SEVERITY[verdict.label] > SEVERITY[rule.route];
  const route = escalate ? verdict.label : rule.route;
  const imminent = route === 'CRISIS' && (Boolean(rule.imminent) || Boolean(verdict.imminent));
  return {
    ...base,
    route,
    imminent,
    decidedBy: escalate || (imminent && !rule.imminent) ? 'judge' : 'rules',
    signals: escalate ? [...(rule.signals || []), `judge:${verdict.label}`] : rule.signals,
  };
}

module.exports = { judgeMessage, judgeOrNull, judgeEnabled, combine, parseVerdict, JudgeError, POLICY, JUDGE_MODEL, GROQ_BASE_URL, SEVERITY };
