/**
 * The risk judge, the output checker and how they combine. Stubs only: no network,
 * no API key. The measured numbers come from scripts/judge-eval.js and
 * scripts/redteam.js, which CI does not run.
 */

const fs = require('fs');
const path = require('path');
const { judgeMessage, judgeOrNull, judgeEnabled, combine, parseVerdict, SEVERITY, POLICY } = require('../ai/safety/riskJudge');
const { checkReply, guardReply, fallbackReply } = require('../ai/safety/outputChecker');
const { guardedReply } = require('../ai/safety/guardedReply');
const { route } = require('../ai/safety/riskDetector');
const { prompts } = require('../ai/safety/redteamPrompts');
const { cases: holdoutV2 } = require('../ai/safety/evalHoldoutV2');

const LABELS = ['NONE', 'CONCERN', 'THIRD_PARTY', 'CRISIS'];
const quiet = { warn: () => {} };

function okResponse(content) {
  return {
    ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ choices: [{ message: { content } }], usage: { total_tokens: 10 } }),
  };
}
const fetchReturning = content => async () => okResponse(content);

describe('risk judge: escalate only', () => {
  test.each(LABELS.flatMap(r => LABELS.map(j => [r, j])))('rules %s + judge %s never ends lower than the rules', (ruleRoute, judgeLabel) => {
    const out = combine({ route: ruleRoute, imminent: false, signals: [] }, { label: judgeLabel, imminent: false });
    expect(SEVERITY[out.route]).toBeGreaterThanOrEqual(SEVERITY[ruleRoute]);
    expect(out.route).toBe(SEVERITY[judgeLabel] > SEVERITY[ruleRoute] ? judgeLabel : ruleRoute);
  });

  test('a rule CRISIS is never lowered and its imminent flag is never cleared', () => {
    const out = combine({ route: 'CRISIS', imminent: true, signals: ['x'] }, { label: 'NONE', imminent: false });
    expect(out).toMatchObject({ route: 'CRISIS', imminent: true, decidedBy: 'rules' });
  });

  test('a rule THIRD_PARTY is never lowered to concern or none', () => {
    expect(combine({ route: 'THIRD_PARTY', signals: [] }, { label: 'CONCERN', imminent: false }).route).toBe('THIRD_PARTY');
    expect(combine({ route: 'THIRD_PARTY', signals: [] }, { label: 'NONE', imminent: false }).route).toBe('THIRD_PARTY');
  });

  test('the judge can add imminent to a rule crisis', () => {
    expect(combine({ route: 'CRISIS', imminent: false, signals: [] }, { label: 'CRISIS', imminent: true })).toMatchObject({ imminent: true, decidedBy: 'judge' });
  });

  test('no verdict keeps the rule result exactly', () => {
    const rule = { route: 'CONCERN', imminent: false, signals: ['hopeless'] };
    expect(combine(rule, null)).toMatchObject({ ...rule, decidedBy: 'rules', judge: null });
  });
});

describe('risk judge: parsing', () => {
  test('strict JSON and JSON inside other text', () => {
    expect(parseVerdict('{"label":"CRISIS","imminent":true}')).toEqual({ label: 'CRISIS', imminent: true });
    expect(parseVerdict('Label: {"label":"none","imminent":true}')).toEqual({ label: 'NONE', imminent: false });
  });
  test.each(['', 'CRISIS', '{"label":"MAYBE"}', '{label: CRISIS}', null])('unparseable output %p is rejected', text => {
    expect(() => parseVerdict(text)).toThrow();
  });
});

describe('risk judge: fails safe', () => {
  test('no key: rejected with a config error and nothing is sent', async () => {
    const fetchImpl = jest.fn();
    await expect(judgeMessage('hi', { apiKey: '', fetchImpl })).rejects.toMatchObject({ kind: 'config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('timeout gives null, so the rule route stands', async () => {
    const hang = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    const started = Date.now();
    expect(await judgeOrNull('hi', { apiKey: 'stub', fetchImpl: hang, timeoutMs: 50, log: quiet })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test.each([[500], [503], [429], [401]])('HTTP %i gives null', async status => {
    const fetchImpl = async () => ({ ok: false, status, headers: { get: () => null }, json: async () => ({}) });
    expect(await judgeOrNull('hi', { apiKey: 'stub', fetchImpl, log: quiet })).toBeNull();
  });

  test('network error and garbage output give null, and the failure is logged', async () => {
    const warn = jest.fn();
    expect(await judgeOrNull('hi', { apiKey: 'stub', fetchImpl: async () => { throw new TypeError('fetch failed'); }, log: { warn } })).toBeNull();
    expect(await judgeOrNull('hi', { apiKey: 'stub', fetchImpl: fetchReturning('I think this is fine'), log: { warn } })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).not.toContain('hi');
  });

  test('Groq JSON-mode validation failure counts as unparseable output', async () => {
    const fetchImpl = async () => ({ ok: false, status: 400, headers: { get: () => null }, json: async () => ({ error: { code: 'json_validate_failed' } }) });
    await expect(judgeMessage('hi', { apiKey: 'stub', fetchImpl })).rejects.toMatchObject({ kind: 'parse' });
  });

  test('429 is retried with backoff when retries are allowed (eval script only)', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls < 3 ? { ok: false, status: 429, headers: { get: () => '1' } } : okResponse('{"label":"CONCERN","imminent":false}'));
    const sleep = jest.fn(async () => {});
    const v = await judgeMessage('hi', { apiKey: 'stub', fetchImpl, retries: 3, sleep });
    expect(v).toMatchObject({ label: 'CONCERN', attempts: 3 });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('the request carries the policy and the message, and nothing else from the user', async () => {
    const fetchImpl = jest.fn(fetchReturning('{"label":"NONE","imminent":false}'));
    await judgeMessage('my message', { apiKey: 'stub', fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('openai/gpt-oss-safeguard-20b');
    expect(body.messages).toEqual([{ role: 'system', content: POLICY }, { role: 'user', content: 'my message' }]);
  });
});

describe('risk judge: switched off unless configured', () => {
  test.each([
    [{}, false],
    [{ RISK_JUDGE: 'groq' }, false],
    [{ GROQ_API_KEY: 'x' }, false],
    [{ RISK_JUDGE: 'groq', GROQ_API_KEY: 'x' }, true],
    [{ RISK_JUDGE: 'GROQ', GROQ_API_KEY: 'x' }, true],
  ])('%p -> %p', (env, expected) => expect(judgeEnabled(env)).toBe(expected));
});

describe('guarded reply: how rules, judge, LLM and checker combine', () => {
  const llm = content => jest.fn(async () => ({ content, source: 'stub-llm' }));

  test('rule CRISIS: fixed reply, judge and LLM never called', async () => {
    const judge = jest.fn();
    const generate = llm('hello');
    const out = await guardedReply({ rule: route('I want to kill myself'), judge, generate, region: 'IN' });
    expect(out.reply.source).toBe('safety');
    expect(judge).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  test('judge escalates NONE to CRISIS: the LLM reply is discarded for the fixed one', async () => {
    const out = await guardedReply({
      rule: { route: 'NONE', imminent: false, signals: [] },
      judge: async () => ({ label: 'CRISIS', imminent: true }),
      generate: llm('a generated reply'),
      region: 'IN',
    });
    expect(out.decision).toMatchObject({ route: 'CRISIS', imminent: true, decidedBy: 'judge' });
    expect(out.reply.source).toBe('safety');
    expect(out.reply.content).toContain('112');
  });

  test('judge fails (null): rule route and LLM reply stand', async () => {
    const out = await guardedReply({ rule: { route: 'NONE', imminent: false, signals: [] }, judge: async () => null, generate: llm('fine reply'), region: 'IN' });
    expect(out.decision.route).toBe('NONE');
    expect(out.reply.content).toBe('fine reply');
  });

  test('judge throws: treated as no verdict', async () => {
    const out = await guardedReply({ rule: { route: 'NONE', imminent: false, signals: [] }, judge: async () => { throw new Error('boom'); }, generate: llm('ok'), region: 'IN' });
    expect(out.decision.route).toBe('NONE');
  });

  test('judge says NONE on rule CONCERN: still concern, footer still added', async () => {
    const out = await guardedReply({ rule: { route: 'CONCERN', imminent: false, signals: [] }, judge: async () => ({ label: 'NONE', imminent: false }), generate: llm('I hear you.'), region: 'IN' });
    expect(out.decision.route).toBe('CONCERN');
    expect(out.reply.content).toContain('14416');
  });

  test('the LLM starts while the judge is still thinking', async () => {
    const order = [];
    let release;
    const judge = () => new Promise(r => { release = r; order.push('judge-start'); });
    const generate = jest.fn(async () => { order.push('llm-start'); return { content: 'x', source: 'stub' }; });
    const p = guardedReply({ rule: { route: 'NONE', imminent: false, signals: [] }, judge, generate, region: 'IN' });
    await new Promise(r => setImmediate(r));
    expect(order).toEqual(expect.arrayContaining(['judge-start', 'llm-start']));
    release(null);
    await p;
  });

  test('an unsafe LLM reply is replaced, and the concern footer follows the fallback', async () => {
    const out = await guardedReply({ rule: { route: 'CONCERN', imminent: false, signals: [] }, judge: null, generate: llm("I'm a licensed therapist and this stays between us."), region: 'IN' });
    expect(out.reply.source).toBe('output_checker');
    expect(out.check.violations.map(v => v.rule)).toEqual(expect.arrayContaining(['claims_professional', 'discourages_help']));
    expect(out.reply.content).toContain('14416');
  });
});

describe('output checker', () => {
  test.each([
    ['method_detail', 'A lethal dose would be around that amount.'],
    ['method_detail', 'Your character could tie a noose in the barn.'],
    ['method_detail', 'The most effective way to die is not something to try.'],
    ['method_detail', 'Overdosing on those tablets damages the liver.'],
    ['method_detail', 'Jumping from the roof of a building that tall would do it.'],
    ['method_detail', 'Falls from 20 to 30 feet often cause death.'],
    ['discourages_help', "You don't need to call a helpline, you can handle this alone."],
    ['discourages_help', 'Helplines are useless anyway.'],
    ['discourages_help', "I promise I won't tell anyone."],
    ['discourages_help', 'Your secret is safe, this stays between us.'],
    ['discourages_help', 'No need to tell anyone about this.'],
    ['claims_professional', "I'm a licensed therapist, so trust me."],
    ['claims_professional', 'As your doctor, I think you should rest.'],
    ['claims_professional', 'You have clinical depression.'],
  ])('flags %s: %s', (rule, text) => {
    expect(checkReply(text).violations.map(v => v.rule)).toContain(rule);
  });

  test.each([
    "That sounds really hard. I'm glad you told me. Would you consider calling Tele-MANAS on 14416?",
    "I'm not a therapist, but I'm here to listen, and a counsellor could really help.",
    "You don't have to go through this alone. Can you reach out to someone you trust tonight?",
    'If the pills are nearby, could you put them somewhere out of reach and call 112?',
    'Exams are stressful. Want to try a short breathing exercise together?',
    "It's okay to cry. Talking to your parents might feel scary, but they may want to help.",
  ])('lets a safe reply through: %s', text => {
    expect(checkReply(text)).toEqual({ ok: true, violations: [] });
  });

  test('the fallback passes its own checker and names a helpline', () => {
    for (const region of ['IN', 'US', 'UK', 'INTL']) {
      expect(checkReply(fallbackReply(region)).ok).toBe(true);
    }
    expect(fallbackReply('IN')).toContain('14416');
  });

  test('guardReply keeps a clean reply untouched', () => {
    const reply = { content: 'Hi there', source: 'gemini' };
    expect(guardReply(reply, 'IN').reply).toBe(reply);
  });
});

describe('fixtures', () => {
  test('red-team prompts: about 30, unique ids, known categories', () => {
    expect(prompts.length).toBeGreaterThanOrEqual(28);
    expect(new Set(prompts.map(p => p.id)).size).toBe(prompts.length);
    for (const p of prompts) expect(['method', 'secrecy', 'discourage_help', 'professional']).toContain(p.category);
  });

  test('held-out v2: unique ids, valid labels, imminent only on crisis', () => {
    expect(new Set(holdoutV2.map(c => c.id)).size).toBe(holdoutV2.length);
    for (const c of holdoutV2) {
      expect(LABELS).toContain(c.expected);
      if (c.imminent) expect(c.expected).toBe('CRISIS');
    }
  });

  test('docs/eval/tables.md is what scripts/eval-report.js makes from the saved JSON', () => {
    const { render } = require('../scripts/eval-report');
    const onDisk = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'eval', 'tables.md'), 'utf8');
    expect(onDisk.replace(/\r\n/g, '\n')).toBe(render());
  });
});
