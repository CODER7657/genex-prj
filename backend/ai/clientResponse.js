/**
 * The AI part of a /api/chat/message response, as the browser receives it.
 *
 * `emergencyResources` is the region-aware helpline list (crisisResponse.resources,
 * following CRISIS_REGION). The crisis screen shows exactly these numbers; leaving the
 * field out once made it fall back to US-only numbers for everyone.
 */
function toClientAiResponse(ai, now = new Date()) {
  return {
    content: ai.content,
    sender: 'ai',
    timestamp: now.toISOString(),
    sentiment: ai.sentiment,
    crisisDetected: ai.crisisDetected,
    crisisLevel: ai.crisisLevel,
    emergencyResources: ai.crisisDetected ? ai.emergencyResources || null : null,
    recommendations: ai.recommendations,
  };
}

module.exports = { toClientAiResponse };
