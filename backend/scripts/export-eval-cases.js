#!/usr/bin/env node
/**
 * Write the crisis-routing evaluation cases, plus how today's rule-based router
 * scores each one, to docs/eval/eval_cases.json for the Python experiments.
 *
 *   node scripts/export-eval-cases.js
 *
 * The JS files stay the source of truth; test/safety.test.js fails if the JSON
 * drifts from them.
 */

const fs = require('fs');
const path = require('path');
const { cases: main } = require('../ai/safety/evalCases');
const { cases: holdout } = require('../ai/safety/evalHoldout');
const { cases: holdout2 } = require('../ai/safety/evalHoldoutV2');
const { route } = require('../ai/safety/riskDetector');

function build() {
  const withRules = (set, split) => set.map(c => ({ ...c, split, rules_route: route(c.text).route }));
  return { main: withRules(main, 'main'), holdout: withRules(holdout, 'holdout'), holdout2: withRules(holdout2, 'holdout2') };
}

if (require.main === module) {
  const out = path.join(__dirname, '..', '..', 'docs', 'eval', 'eval_cases.json');
  fs.writeFileSync(out, JSON.stringify(build(), null, 1) + '\n');
  console.log(`wrote ${out}`);
}

module.exports = { build };
