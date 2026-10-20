/**
 * Crisis routing for chat messages.
 *
 * route(message) -> { route, imminent, signals }
 *   CRISIS       the user may be at risk of suicide or is self-harming now
 *   CONCERN      distress, self-harm history, or risk language the user negates
 *   THIRD_PARTY  the user is worried about someone else
 *   NONE         nothing that needs safety handling
 *
 * Phrases are matched, not substrings, so "vitamin pills" or "hopeless at math"
 * stay NONE. When a message is ambiguous the router escalates: a missed crisis is
 * the worst error this code can make, and a false alarm is the cheapest.
 *
 * Measured against ai/safety/evalCases.js by scripts/safety-eval.js. Those cases
 * were written before this file; see docs/SAFETY_EVAL.md for what they do and do
 * not show.
 */

// --- Normalisation ---------------------------------------------------------

const SHORTHAND = [
  [/\bwanna\b/g, 'want to'],
  [/\bgonna\b/g, 'going to'],
  [/\b(want|going|need) 2\b/g, '$1 to'],
  [/\bdont\b/g, "don't"],
  [/\bcant\b/g, "can't"],
  [/\bwont\b/g, "won't"],
  [/\bim\b/g, "i'm"],
  [/\bive\b/g, "i've"],
  [/\bself[ -]?harm/g, 'self-harm'],
];

function normalise(message) {
  let text = String(message || '')
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, replacement] of SHORTHAND) text = text.replace(pattern, replacement);
  return text;
}

// --- Signals ---------------------------------------------------------------
// Each is [name, regex]. Devanagari patterns avoid \b, which JS only applies to ASCII.

const SELF_CRISIS = [
  ['kill_myself', /\b(kill|killing) myself\b/],
  ['kms', /\bkms\b/],
  ['unalive', /\bunalive (myself|me)\b/],
  ['sewerslide', /\bsewerslide\b/],
  ['suicide', /\bsuicid(e|al)\b/],
  ['end_my_life', /\b(end|ending|take|taking) my (own )?life\b/],
  ['want_to_die', /\bwant(ed)? to die\b/],
  ['wish_dead', /\bwish (that )?i (was|were|had been) (dead|never born)\b/],
  ['not_want_to_live', /\b(don't|do not|no longer) want to (be alive|live|exist|be here|wake up)\b/],
  ['end_it', /\bend (it all|it|everything)\b/],
  ['done_with_life', /\bdone with (life|living)\b/],
  ['tired_of_living', /\btired of (living|existing|being alive|life)\b/],
  ['better_off_without_me', /\b(better off|happier) (without me|if i (was|were|wasn't|weren't) (dead|gone|here|around))\b/],
  ['not_here_much_longer', /\b(won't|will not) be (a burden|around|here)( for)?( much)? longer\b/],
  ['wont_be_here', /\bi (won't|will not) be (here|around)\b/],
  ['never_wake_up', /\bnever wake up\b/],
  ['giving_things_away', /\bgiving (away )?(all )?my (things|stuff|belongings|possessions)\b/],
  ['no_reason_to_live', /\b(no|any) reason to (keep )?(live|living|be alive|exist|go on)\b/],
  ['point_of_living', /\bpoint (of|in) (living|life|being alive|going on)\b/],
  ['disappear_forever', /\bdisappear forever\b/],
  ['goodbye', /\b(this is|saying) (my )?goodbye\b|\bgoodbye (letters?|notes?)\b|\bsuicide note\b/],
  ['last_message', /\bmy last message\b/],
  ['nobody_would_notice', /\b(nobody|no one) would (even )?(notice|care|miss me)( if i('m| was| were)? gone)?\b/],
  ['decided_tonight', /\b(tonight|today) is the (night|day)\b/],
  ['saved_means', /\b(saved|saving|stockpiled|stockpiling|collected|collecting) (up )?(my )?(pills|tablets|meds|medication)\b/],
  ['self_harm_now', /\b(cut|cutting|burn|burning|burned|burnt|hurt|hurting|harm|harming|hit|hitting) myself\b/],
  ['self_harm', /\bself-harm(ing)?\b/],
  // Hindi in Roman script and in Devanagari
  ['hi_mar_jana', /\bmar (jana|jaana|jaun|jaunga|jaungi) (hai|chahta|chahti)?/],
  ['hi_jeena_nahi', /\bjeena nahi?n? (chahta|chahti|hai)\b/],
  ['hi_khud_ko', /\bkhud ko (khatam|maar|maarna)\b/],
  ['hi_sab_khatam', /\bsab khatam kar (dunga|dungi|du|doon|dena)\b/],
  ['hi_dev_marna', /मरना चाहत|मर जाना/],
  ['hi_dev_suicide', /आत्महत्या|ख़ुदकुशी|खुदकुशी/],
  ['hi_dev_jeena', /जीना नहीं चाहत/],
  ['hi_dev_khud', /खुद को (खत्म|मार)/],
];

const THIRD_PARTY_RISK = [
  ['other_kill_self', /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting|burn|burning) (himself|herself|themselves|themself)\b/],
  ['other_wants_to_die', /\bwants to (die|kill (himself|herself|themselves)|end (his|her|their) life)\b/],
  ['other_end_life', /\bend (his|her|their) (own )?life\b/],
  ['other_suicidal', /\b(is|are|seems|been|being) suicidal\b/],
  ['other_miss_them', /\bmiss (him|her|them) if (he|she|they)\b/],
];

const THIRD_PARTY_SUBJECT =
  /\b(my|a|our|his|her|their) (best )?(friend|brother|sister|mom|mum|mother|dad|father|son|daughter|cousin|roommate|flatmate|classmate|girlfriend|boyfriend|partner|wife|husband|colleague|coworker|student|child|kid)s?\b|\bsomeone (i know|close to me)\b/;

const CONCERN = [
  ['hopeless', /\bhopeless\b(?! (at|with|in)\b)/],
  ['worthless', /\bworthless\b/],
  ['cant_cope', /\bcan't cope\b/],
  ['nobody_cares', /\b(nobody|no one) (cares|loves me|understands me)\b/],
  ['empty', /\bfeel(ing)? (so )?(empty|numb)\b/],
  ['alone', /\b(feel(ing)? (so )?alone|alone all the time|so lonely)\b/],
  ['failure', /\bfeel like (such )?a failure\b/],
  ['crying', /\bcan't stop crying\b/],
  ['pointless', /\b(everything|life|it all) (feels|is|seems) (so )?(pointless|meaningless)\b/],
  ['hate_myself', /\bhate myself\b/],
  ['trapped', /\btrapped\b|\bno way out\b/],
  ['can_not_go_on', /\bcan't (go on|do this anymore|take (it|this) anymore)\b/],
];

const IMMINENT = /\b(tonight|today|right now|this (evening|weekend)|aaj raat|have a plan|planning to|plan to|i've decided|finally do it|saved up|goodbye (letters?|notes?)|written (goodbye|my) (letters?|notes?))\b/;

// Words just before a risk phrase that negate it: "I'd never kill myself", "I'm not
// suicidal". At most one word may sit between, and it may not start a new clause, so
// "it won't matter because I won't be here" is not read as negated.
const NEGATED_BEFORE =
  /\b(never|not|wouldn't|would not|won't|will not|no intention of|not going to)( (?!because\b|but\b|and\b|so\b|when\b|if\b|since\b)\w+)? $/;

// Past or recovery framing: "I used to self-harm", "attempted suicide years ago".
const HISTORY = /\bused to\b|\b(years?|months?) ago\b|\bclean for\b|\bin recovery\b|\bwhen i was (younger|a kid|a teenager|in school)\b|\battempted (suicide )?(\w+ ){0,3}ago\b/;
// ...unless the same message also says it is happening again or now.
const PRESENT_AGAIN = /\bagain\b|\bwant(ed)? to\b|\bgoing to\b|\btonight\b|\bright now\b|\bplan\b/;
// A past suicide attempt is the strongest known risk factor, so history never softens it.
const PAST_ATTEMPT = /\b(attempted|tried to) (suicide|kill myself|end my life|take my (own )?life)\b|\battempted\b.*\bsuicid/;

function matches(text, signals) {
  const found = [];
  for (const [name, pattern] of signals) {
    const m = pattern.exec(text);
    if (m) found.push({ name, index: m.index });
  }
  return found;
}

function route(message) {
  const text = normalise(message);
  const self = matches(text, SELF_CRISIS);
  const historical = HISTORY.test(text) && !PRESENT_AGAIN.test(text) && !PAST_ATTEMPT.test(text);

  const live = [];
  const softened = [];
  for (const s of self) {
    const negated = NEGATED_BEFORE.test(text.slice(0, s.index));
    (negated || historical ? softened : live).push(s.name);
  }

  const thirdParty = matches(text, THIRD_PARTY_RISK).map(s => s.name);
  const hasOther = THIRD_PARTY_SUBJECT.test(text);
  const firstPersonRisk = /\b(i|i'm|i've|i'd|me|my|myself|mujhe|main)\b/.test(text);

  // Generic words like "suicide" with only someone else as the subject are about them.
  const aboutOther =
    thirdParty.length > 0 ||
    (hasOther && live.length > 0 && live.every(n => n === 'suicide') && !/\b(i'm|i am|i've|i have|i feel|i was|me)\b.*suicid/.test(text));

  if (live.length && !aboutOther) {
    return { route: 'CRISIS', imminent: IMMINENT.test(text), signals: live };
  }
  if (aboutOther && (thirdParty.length || live.length)) {
    return { route: 'THIRD_PARTY', imminent: false, signals: [...thirdParty, ...live] };
  }
  if (hasOther && /\bhelp (a|my) (\w+ )?(friend|\w+) who\b/.test(text) && !firstPersonRisk) {
    return { route: 'THIRD_PARTY', imminent: false, signals: ['help_someone'] };
  }

  const concern = matches(text, CONCERN).map(s => s.name);
  if (softened.length || concern.length) {
    return { route: 'CONCERN', imminent: false, signals: [...softened.map(n => `${n}:softened`), ...concern] };
  }
  return { route: 'NONE', imminent: false, signals: [] };
}

module.exports = { route, normalise };
