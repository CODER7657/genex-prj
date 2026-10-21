/**
 * Deterministic checks on what the companion LLM says, before the user sees it.
 *
 * checkReply(text) -> { ok, violations: [{ rule, match }] }
 *
 *   method_detail       names a suicide or self-harm method, a dose, or how-to wording
 *   discourages_help    talks someone out of helplines, therapy, or telling anyone,
 *                       or promises to keep risk a secret
 *   claims_professional says it is a therapist, doctor or counsellor, or diagnoses
 *
 * Any violation replaces the reply with fallbackReply(): fixed text, a helpline,
 * nothing generated. A false positive costs a slightly generic reply; a miss can
 * cost far more, so the patterns lean broad. Measured by scripts/redteam.js.
 *
 * It does not understand meaning. A reply that hints at a method in words not on
 * this list gets through; see docs/SAFETY_EVAL.md for what the red-team run found.
 */

const { helplineSentence, regionFrom } = require('./crisisResponse');

const RULES = {
  method_detail: [
    /\blethal (dose|amount|quantity)\b/,
    /\b(fatal|deadly|toxic) (dose|amount|quantity)\b/,
    /\b\d+(\.\d+)?\s?(mg|milligrams?|grams?|g)\b(?=[^.]*\b(overdose|die|death|fatal|lethal|kill)\b)/,
    /\bhow (many|much) (pills|tablets|of (them|it)) (it takes|would|to (die|kill|overdose))\b/,
    /\b(overdos(e|ing) on)\b/,
    /\b(noose|ligature|hanging yourself|hang yourself|hang myself)\b/,
    /\b(slit|slitting|cut|cutting) (your|my|the) (wrists?|veins?|throat)\b/,
    /\b(carbon monoxide|exhaust fumes|charcoal burning|helium)\b/,
    /\b(pesticide|rat poison|bleach|antifreeze|paraquat|organophosphate)\b/,
    /\b(jump(ing)? (off|from) (a|the) (bridge|building|roof|ledge|cliff))\b/,
    /\b(train tracks|in front of a (train|car|bus))\b/,
    /\b(painless|quickest|fastest|easiest|most effective|surest|least painful) (way|method|means) (to (die|go|end it|kill)|of (dying|suicide))\b/,
    /\b(method|methods) (of|for) (suicide|self-harm|killing yourself|ending your life)\b/,
    /\bstep[- ]by[- ]step\b(?=[^.]*\b(suicide|die|overdose|kill|self-harm|cut)\b)/,
    /\b(deeper|deep enough|without (anyone|people) noticing)\b(?=[^.]*\b(cut|cuts|cutting|wound|scar)\b)/,
  ],
  discourages_help: [
    /\b(you )?(don't|do not|shouldn't|should not|never) (need to |have to )?(call|contact|text|reach out to|bother with|tell) (a |the |any )?(helpline|hotline|crisis line|988|14416|therapist|counsell?or|doctor|anyone|anybody|your (parents|family|friends))\b/,
    /\bno need (to|for) (call|contact|text|a helpline|a hotline|a therapist|therapy|professional help|tell anyone)\b/,
    /\b(helplines?|hotlines?|crisis lines?|therapy|therapists?|counsell?ing) (are|is) (useless|pointless|a waste|not (going to|gonna) help|won't help|don't help|overrated)\b/,
    /\b(you can|you'll|you will) (handle|get through|deal with) (this|it) (alone|on your own|by yourself)\b/,
    /\b(i|i'll|i will) (won't|will not|never|promise not to) (tell|share this with|report this to) (anyone|anybody|a soul)\b/,
    /\bi promise (not to|i won't) tell\b/,
    /\b(this|it|everything) (stays|will stay|can stay) (between us|our secret|secret)\b/,
    /\b(our|a) little secret\b/,
    /\b(instead of|rather than) (calling|contacting|texting) (a |the )?(helpline|hotline|crisis line|988|14416)\b/,
  ],
  claims_professional: [
    /\b(i am|i'm) (a |your )?(licensed |qualified |trained |certified |registered )?(therapist|psychologist|psychiatrist|doctor|physician|counsell?or|psychotherapist|clinician)\b/,
    /\bas (a|your) (licensed |qualified )?(therapist|psychologist|psychiatrist|doctor|physician|counsell?or|clinician)\b/,
    /\b(my|i can give you a|i'd give you a) (diagnosis|prescription)\b/,
    /\bi (diagnose|can diagnose|am diagnosing) you\b/,
    /\byou (have|are suffering from) (clinical depression|major depressive disorder|bipolar( disorder)?|bpd|ptsd|an anxiety disorder)\b/,
    /\bi (can )?prescribe\b/,
  ],
};

function normaliseReply(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function checkReply(text) {
  const t = normaliseReply(text);
  const violations = [];
  for (const [rule, patterns] of Object.entries(RULES)) {
    for (const p of patterns) {
      const m = p.exec(t);
      if (m) {
        violations.push({ rule, match: m[0] });
        break;
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

function fallbackReply(region = regionFrom()) {
  return [
    "I want to be careful with how I answer this, so I'll keep it simple.",
    "I'm an AI companion, not a therapist or doctor, and I can't help with anything that could hurt you.",
    `If you're struggling or thinking about hurting yourself, please talk to someone now: ${helplineSentence(region)}. Reaching out is a strong thing to do, not a weak one.`,
    "I'm still here to listen. What's been going on?",
  ].join(' ');
}

/** Check a generated reply; return it unchanged if clean, or the fallback if not. */
function guardReply(reply, region = regionFrom()) {
  const result = checkReply(reply && reply.content);
  if (result.ok) return { reply, check: result };
  return {
    reply: { ...reply, content: fallbackReply(region), source: 'output_checker', blockedSource: reply && reply.source },
    check: result,
  };
}

module.exports = { checkReply, guardReply, fallbackReply, RULES };
