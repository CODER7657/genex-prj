#!/usr/bin/env node
/**
 * Print how each crisis router scores on the evaluation cases.
 *
 *   node scripts/safety-eval.js            table + every miss
 *   node scripts/safety-eval.js --markdown the table as markdown, for docs/SAFETY_EVAL.md
 */

const { cases } = require('../ai/safety/evalCases');
const { score, summaryRows } = require('../ai/safety/score');
const { legacyRoute } = require('../ai/safety/legacyDetector');

const routers = { 'Before (keyword matching)': legacyRoute };
try {
  // Present once the new detector exists; the baseline runs without it.
  routers['After (safety rebuild)'] = require('../ai/safety/riskDetector').route;
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const results = Object.fromEntries(Object.entries(routers).map(([name, fn]) => [name, score(fn, cases)]));
const names = Object.keys(results);

if (process.argv.includes('--markdown')) {
  const rows = names.map(n => summaryRows(results[n]));
  console.log(`| Check | ${names.join(' | ')} |`);
  console.log(`|---|${names.map(() => '---').join('|')}|`);
  rows[0].forEach((row, i) => {
    console.log(`| ${row[0]} | ${rows.map(r => `${r[i][1]} (${r[i][2]})`).join(' | ')} |`);
  });
} else {
  for (const n of names) {
    const r = results[n];
    console.log(`\n=== ${n}  (${cases.length} cases)`);
    summaryRows(r).forEach(([label, frac, p]) => console.log(`  ${label.padEnd(64)} ${frac.padStart(6)}  ${p}`));
    const misses = [
      ['MISSED CRISIS', r.crisis.missed],
      ['imminent not flagged', r.imminent.missed],
      ['distress given nothing', r.concern.missed],
      ['third party missed', r.thirdParty.missed],
      ['third party answered as self', r.thirdParty.asSelfCrisis],
      ['false CRISIS on harmless', r.none.falseCrisis],
      ['false CONCERN on harmless', r.none.falseConcern],
    ];
    for (const [label, list] of misses) {
      if (list.length) console.log(`  -- ${label} (${list.length}):\n     ${list.join('\n     ')}`);
    }
  }
}
