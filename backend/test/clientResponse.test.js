const { toClientAiResponse } = require('../ai/clientResponse');
const { resources } = require('../ai/safety/crisisResponse');

const base = { content: 'reply', sentiment: 'negative', recommendations: [] };
const NOW = new Date('2026-11-08T12:00:00Z');

describe('the chat response the browser receives', () => {
  test('a crisis carries the region-aware helplines, with dialable numbers', () => {
    for (const region of ['IN', 'US', 'UK', 'INTL']) {
      const out = toClientAiResponse(
        { ...base, crisisDetected: true, crisisLevel: 'high', emergencyResources: resources(region) },
        NOW,
      );
      expect(out.emergencyResources).toEqual(resources(region));
      const first = out.emergencyResources.crisis_lines[0];
      expect(first.tel).toMatch(/^\d+$/);
    }
  });

  test('India gets Tele-MANAS and 112, never only US numbers', () => {
    const r = resources('IN');
    expect(r.crisis_lines.map(l => l.tel)).toEqual(['14416']);
    expect(r.emergency).toEqual([{ region: 'IN', number: '112' }]);
    const intl = resources('INTL');
    expect(intl.crisis_lines[0]).toMatchObject({ region: 'IN', tel: '14416' });
    expect(intl.crisis_lines.find(l => l.region === 'US')).toMatchObject({ tel: '988' });
  });

  test('the US text line is an sms: number, not a phone number', () => {
    expect(resources('US').crisis_lines.find(l => l.name === 'Crisis Text Line')).toMatchObject({ sms: '741741' });
  });

  test('no crisis, no helpline payload; a missing one becomes null, not undefined', () => {
    expect(toClientAiResponse({ ...base, crisisDetected: false, emergencyResources: resources('IN') }, NOW).emergencyResources).toBeNull();
    expect(toClientAiResponse({ ...base, crisisDetected: true }, NOW).emergencyResources).toBeNull();
  });

  test('keeps the existing fields', () => {
    expect(toClientAiResponse({ ...base, crisisDetected: false, crisisLevel: 'low' }, NOW)).toMatchObject({
      content: 'reply', sender: 'ai', timestamp: '2026-11-08T12:00:00.000Z', crisisLevel: 'low',
    });
  });
});
