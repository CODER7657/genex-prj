/**
 * The crisis detector as it was in chatService.js before the safety rebuild,
 * frozen here so the evaluation can measure it against the new one.
 *
 * Copied from ChatService.detectCrisis (keyword lists, patterns and level logic).
 * The per-user "recent crisis history" bump is left out: it needs the database
 * and does not change how a single message is read. Do not use in the app.
 */

const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
  'self-harm', 'hurt myself', 'cut myself', 'overdose', 'pills',
  'hopeless', 'worthless', 'nobody cares', 'give up', 'can\'t go on',
  'end it all', 'no point', 'done with life', 'tired of living'
];

const CRISIS_PATTERNS = [
  /I (want to|will|am going to) (kill|hurt|harm) myself/i,
  /I'm (going to|planning to) (die|kill myself|end it)/i,
  /life isn't worth living/i,
  /(nobody|no one) would miss me/i,
  /planning to (hurt|harm|kill)/i,
  /have nothing to live for/i,
  /ready to give up/i
];

function legacyDetect(message) {
  const lowerMessage = message.toLowerCase();
  let detected = false;
  let level = 'none';
  const triggers = [];
  let confidence = 0;

  CRISIS_KEYWORDS.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      detected = true;
      triggers.push(keyword);
      confidence += 0.1;
    }
  });

  CRISIS_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(message)) {
      detected = true;
      triggers.push(`pattern_${index + 1}`);
      confidence += 0.15;
    }
  });

  const contextWords = lowerMessage.split(' ');
  let contextScore = 0;
  ['always', 'never', 'everything', 'nothing', 'everyone', 'nobody'].forEach(word => {
    if (contextWords.includes(word)) contextScore += 0.05;
  });
  ['tonight', 'today', 'now', 'soon', 'planning'].forEach(word => {
    if (contextWords.includes(word)) {
      contextScore += 0.1;
      triggers.push(`immediate_${word}`);
    }
  });
  confidence += contextScore;

  if (detected) {
    if (triggers.some(t => ['suicide', 'kill myself', 'end my life', 'overdose'].includes(t)) || confidence > 0.3) {
      level = 'high';
    } else if (triggers.some(t => ['self-harm', 'hurt myself', 'hopeless', 'worthless'].includes(t)) || confidence > 0.2) {
      level = 'medium';
    } else {
      level = 'low';
    }
  }
  return { detected, level, triggers, confidence };
}

/**
 * How the old chat flow treated each level. It had no idea of a third party,
 * and every detected level still went to the LLM; 'high' is mapped to CRISIS
 * here as the most generous reading.
 */
function legacyRoute(message) {
  const { level } = legacyDetect(message);
  return { route: level === 'high' ? 'CRISIS' : level === 'none' ? 'NONE' : 'CONCERN', imminent: false };
}

module.exports = { legacyDetect, legacyRoute };
