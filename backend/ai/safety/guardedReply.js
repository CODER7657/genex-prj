/**
 * How a reply is chosen, in one place, so it can be tested without a network.
 *
 *   1. Rules (riskDetector) have already routed the message.
 *   2. Rule CRISIS: fixed safety reply at once. The judge is not asked; it could
 *      not raise the route any higher.
 *   3. Otherwise the judge (if switched on) is asked. For CONCERN and NONE the
 *      companion LLM starts at the same time, so the judge adds no waiting unless
 *      it is slower than the LLM. If the judge escalates to CRISIS or THIRD_PARTY,
 *      the LLM reply is thrown away and the fixed reply is sent.
 *   4. An LLM reply goes through the output checker. CONCERN adds the helpline footer
 *      after the check, so the footer is always the fixed text.
 *
 * judge:    async () => verdict | null   (null = off or failed safe)
 * generate: async (analysis) => { content, source }
 */

const { combine } = require('./riskJudge');
const { safetyReply, concernFooter, regionFrom } = require('./crisisResponse');
const { guardReply } = require('./outputChecker');

async function guardedReply({ rule, judge = null, generate, region = regionFrom() }) {
  if (rule.route === 'CRISIS') {
    const decision = combine(rule, null);
    return { decision, reply: safetyReply(decision, region), check: null, judgeAsked: false };
  }

  const judgeP = judge ? Promise.resolve().then(judge).catch(() => null) : Promise.resolve(null);

  let genP = null;
  if (rule.route !== 'THIRD_PARTY') {
    genP = Promise.resolve().then(() => generate(rule));
    genP.catch(() => {}); // handled below if used; ignored if the judge escalates
  }

  const verdict = await judgeP;
  const decision = combine(rule, verdict);

  const fixed = safetyReply(decision, region);
  if (fixed) return { decision, reply: fixed, check: null, judgeAsked: Boolean(judge) };

  const generated = await genP;
  const { reply, check } = guardReply(generated, region);
  const content = decision.route === 'CONCERN' ? reply.content + concernFooter(region) : reply.content;
  return { decision, reply: { ...reply, content }, check, judgeAsked: Boolean(judge) };
}

module.exports = { guardedReply };
