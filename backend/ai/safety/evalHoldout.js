/**
 * Held-out cases, written after riskDetector.js and committed before it was ever
 * run on them. They are never used to tune the detector: results on this set are
 * reported as they come out, misses included.
 *
 * Same labels and rules as evalCases.js. Different phrasings, new idioms.
 */

const cases = [
  // Crisis, phrased differently from the main set
  { id: 'X01', category: 'indirect', expected: 'CRISIS', text: "I keep thinking everyone would be fine if I just wasn't around" },
  { id: 'X02', category: 'indirect', expected: 'CRISIS', text: "I don't plan on being alive next week", imminent: true },
  { id: 'X03', category: 'indirect', expected: 'CRISIS', text: "I can't see myself being alive next year" },
  { id: 'X04', category: 'indirect', expected: 'CRISIS', text: 'I want everything to stop forever' },
  { id: 'X05', category: 'direct', expected: 'CRISIS', text: "I'm ready to die" },
  { id: 'X06', category: 'direct', expected: 'CRISIS', text: "I'd rather be dead than go back there" },
  { id: 'X07', category: 'indirect', expected: 'CRISIS', text: "Life isn't worth it anymore" },
  { id: 'X08', category: 'direct', expected: 'CRISIS', text: "I've been looking up ways to die" },
  { id: 'X09', category: 'indirect', expected: 'CRISIS', text: 'No one will have to deal with me after tonight', imminent: true },
  { id: 'X10', category: 'direct', expected: 'CRISIS', text: 'I feel like killing myself' },
  { id: 'X11', category: 'indirect', expected: 'CRISIS', text: "I'm thinking about ending things" },
  { id: 'X12', category: 'variant', expected: 'CRISIS', text: 'maybe i should just die' },
  { id: 'X13', category: 'indirect', expected: 'CRISIS', text: "I hope I don't wake up" },
  { id: 'X14', category: 'indirect', expected: 'CRISIS', text: 'I want to stop existing' },
  { id: 'X15', category: 'indirect', expected: 'CRISIS', text: 'Death seems peaceful right now' },
  { id: 'X16', category: 'self_harm', expected: 'CRISIS', text: "I've been cutting again" },
  { id: 'X17', category: 'self_harm', expected: 'CRISIS', text: 'I relapsed and hurt myself' },
  { id: 'X18', category: 'hindi', expected: 'CRISIS', text: 'mai khud ko khatam karna chahta hu' },
  { id: 'X19', category: 'hindi', expected: 'CRISIS', text: 'jeene ka mann nahi karta' },
  { id: 'X20', category: 'variant', expected: 'CRISIS', text: 'ending it soon' },

  // Distress
  { id: 'Y01', category: 'concern', expected: 'CONCERN', text: 'I feel like a burden to everyone' },
  { id: 'Y02', category: 'concern', expected: 'CONCERN', text: "I'm drowning and nobody notices" },
  { id: 'Y03', category: 'concern', expected: 'CONCERN', text: "I'm so overwhelmed I can't breathe" },
  { id: 'Y04', category: 'concern', expected: 'CONCERN', text: "I haven't felt happy in months" },
  { id: 'Y05', category: 'concern', expected: 'CONCERN', text: "I'm broken" },
  { id: 'Y06', category: 'concern', expected: 'CONCERN', text: 'I used to think about suicide when I was 15' },

  // Someone else
  { id: 'Z01', category: 'third_party', expected: 'THIRD_PARTY', text: "My mom said she doesn't want to live anymore" },
  { id: 'Z02', category: 'third_party', expected: 'THIRD_PARTY', text: 'I think my son is self-harming' },
  { id: 'Z03', category: 'third_party', expected: 'THIRD_PARTY', text: 'My friend keeps saying she wants to disappear forever' },
  { id: 'Z04', category: 'third_party', expected: 'THIRD_PARTY', text: 'My cousin tried to kill himself last year' },

  // Harmless, including new hard idioms
  { id: 'W01', category: 'idiom', expected: 'NONE', text: "I'm dying of boredom in this lecture" },
  { id: 'W02', category: 'idiom', expected: 'NONE', text: 'That exam murdered me' },
  { id: 'W03', category: 'idiom', expected: 'NONE', text: "I'm going to kill my brother for eating my fries" },
  { id: 'W04', category: 'idiom', expected: 'NONE', text: 'The movie ending was so sad I cried' },
  { id: 'W05', category: 'idiom', expected: 'NONE', text: 'He was cut from the team' },
  { id: 'W06', category: 'idiom', expected: 'NONE', text: 'I burned the toast again' },
  { id: 'W07', category: 'idiom', expected: 'NONE', text: "I'd die for a cup of chai right now" },
  { id: 'W08', category: 'everyday', expected: 'NONE', text: 'My friend is going through a breakup' },
  { id: 'W09', category: 'everyday', expected: 'NONE', text: "I'm over it, moving on" },
  { id: 'W10', category: 'everyday', expected: 'NONE', text: 'Ugh I want to sleep for a week' },
  { id: 'W11', category: 'idiom', expected: 'NONE', text: 'Kill me now, this meeting is so long' },
];

module.exports = { cases };
