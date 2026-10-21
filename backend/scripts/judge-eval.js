#!/usr/bin/env node
/**
 * Run the Groq risk judge over the evaluation sets and save raw outputs to
 * docs/eval/judge_results.json. Network calls; needs GROQ_API_KEY in backend/.env.
 *
 *   node scripts/judge-eval.js --set main        main set (107)
 *   node scripts/judge-eval.js --set holdout     held-out v1 (41)
 *   node scripts/judge-eval.js --set holdout2    held-out v2 (74), sealed, run once
 *   node scripts/judge-eval.js --set main --limit 5   smoke test
 *
 * The judge runs on every case, including ones the rules already route CRISIS, so
 * "judge alone" can be reported. The app itself skips the judge on rule CRISIS.
 *
 * Resumable: a case already in the results file with the same text and policy is
 * not sent again. Paced for the free tier (2,000 tokens a minute for this model),
 * with retries and backoff on 429 and 5xx.
 *
 *   node scripts/judge-eval.js --rerun-failures --max-tokens 512
 *       Post-hoc diagnostic: sends only the cases that failed (unparseable output)
 *       in judge_results.json again with a larger output budget, and saves them to
 *       docs/eval/judge_failures_rerun.json. judge_results.json is not changed.
 *
 * Tables are made from the saved JSON by scripts/eval-report.js, without network.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { judgeMessage, POLICY, JUDGE_MODEL } = require('../ai/safety/riskJudge');
const { route } = require('../ai/safety/riskDetector');

const SETS = {
  main: () => require('../ai/safety/evalCases').cases,
  holdout: () => require('../ai/safety/evalHoldout').cases,
  holdout2: () => require('../ai/safety/evalHoldoutV2').cases,
};
const OUT = path.join(__dirname, '..', '..', 'docs', 'eval', 'judge_results.json');
const policyHash = crypto.createHash('sha256').update(POLICY).digest('hex').slice(0, 12);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

function load() {
  if (!fs.existsSync(OUT)) return { model: JUDGE_MODEL, policy_sha256_12: policyHash, cases: [] };
  return JSON.parse(fs.readFileSync(OUT, 'utf8'));
}

function save(data) {
  data.cases.sort((a, b) => (a.set === b.set ? a.id.localeCompare(b.id) : a.set.localeCompare(b.set)));
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
}

async function rerunFailures() {
  const maxTokens = Number(arg('max-tokens', 512));
  const intervalMs = Number(arg('interval', 25000));
  const failed = load().cases.filter(c => c.judge && c.judge.error);
  const out = { model: JUDGE_MODEL, policy_sha256_12: policyHash, max_tokens: maxTokens, note: 'Post-hoc rerun of the calls that failed in judge_results.json. Not a held-out result.', cases: [] };
  console.log(`re-sending ${failed.length} failed cases with max_tokens ${maxTokens}`);
  for (const [i, c] of failed.entries()) {
    if (i) await new Promise(r => setTimeout(r, intervalMs));
    let judge;
    try {
      const v = await judgeMessage(c.text, { timeoutMs: 8000, retries: 6, maxTokens });
      judge = { label: v.label, imminent: v.imminent, latency_ms: v.latencyMs, attempts: v.attempts, tokens: v.usage && v.usage.total_tokens };
    } catch (error) {
      judge = { error: error.kind || 'error', detail: error.message };
    }
    out.cases.push({ set: c.set, id: c.id, expected: c.expected, expected_imminent: c.expected_imminent, text: c.text, rules: c.rules, judge });
    console.log(`${c.set} ${c.id} expected ${c.expected} judge ${judge.error ? 'ERROR ' + judge.error : judge.label}`);
  }
  fs.writeFileSync(path.join(path.dirname(OUT), 'judge_failures_rerun.json'), JSON.stringify(out, null, 1) + '\n');
}

async function main() {
  if (process.argv.includes('--rerun-failures')) return rerunFailures();
  const setName = arg('set');
  if (!SETS[setName]) throw new Error(`--set must be one of ${Object.keys(SETS).join(', ')}`);
  const limit = Number(arg('limit', Infinity));
  const intervalMs = Number(arg('interval', 20000));
  // 192 is what the saved run used; the app now defaults to 512 (see riskJudge.js).
  const maxTokens = Number(arg('max-tokens', 192));
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in backend/.env');

  const data = load();
  if (data.policy_sha256_12 !== policyHash) {
    throw new Error(`results file was made with policy ${data.policy_sha256_12}, this is ${policyHash}. Move it aside first.`);
  }
  const done = new Map(data.cases.map(c => [`${c.set}:${c.id}`, c]));
  const todo = SETS[setName]().filter(c => {
    const prev = done.get(`${setName}:${c.id}`);
    return !(prev && prev.text === c.text && prev.judge && !prev.judge.error);
  }).slice(0, limit);

  console.log(`${setName}: ${todo.length} to judge with ${JUDGE_MODEL} (policy ${policyHash}), one every ${intervalMs / 1000}s`);
  let last = 0;
  for (const [i, c] of todo.entries()) {
    const wait = last + intervalMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();

    const rules = route(c.text);
    let judge;
    try {
      // 8 s here rather than the app's 2.5 s, so slow answers are measured, not dropped.
      const v = await judgeMessage(c.text, { timeoutMs: 8000, retries: 6, maxTokens });
      judge = { label: v.label, imminent: v.imminent, latency_ms: v.latencyMs, attempts: v.attempts, tokens: v.usage && v.usage.total_tokens };
    } catch (error) {
      judge = { error: error.kind || 'error', detail: error.message };
    }
    data.max_tokens = maxTokens;
    const row = {
      set: setName, id: c.id, category: c.category, expected: c.expected, expected_imminent: Boolean(c.imminent), text: c.text,
      rules: { route: rules.route, imminent: rules.imminent },
      judge,
    };
    done.set(`${setName}:${c.id}`, row);
    data.cases = [...done.values()];
    save(data);
    const shown = judge.error ? `ERROR ${judge.error}` : `${judge.label}${judge.imminent ? ' (imminent)' : ''} ${judge.latency_ms}ms`;
    console.log(`[${i + 1}/${todo.length}] ${c.id} expected ${c.expected} rules ${rules.route} judge ${shown}`);
  }
  console.log(`saved ${OUT}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
