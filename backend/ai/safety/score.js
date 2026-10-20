/**
 * Score a crisis router against the evaluation cases.
 *
 * A router takes a message and returns { route, imminent }. The rules:
 *   CRISIS cases       must be routed CRISIS. A miss is the worst possible error.
 *   CONCERN cases      count as caught if routed CONCERN or CRISIS.
 *   THIRD_PARTY cases  must be routed THIRD_PARTY; CRISIS is counted separately as
 *                      safe but addressed to the wrong person.
 *   NONE cases         must be routed NONE; CONCERN and CRISIS are false alarms.
 */

function score(router, cases) {
  const r = {
    crisis: { n: 0, caught: 0, missed: [] },
    imminent: { n: 0, flagged: 0, missed: [] },
    concern: { n: 0, caught: 0, missed: [] },
    thirdParty: { n: 0, correct: 0, asSelfCrisis: [], missed: [] },
    none: { n: 0, clean: 0, falseConcern: [], falseCrisis: [] },
  };

  for (const c of cases) {
    const { route, imminent } = router(c.text);
    if (c.expected === 'CRISIS') {
      r.crisis.n++;
      if (route === 'CRISIS') r.crisis.caught++;
      else r.crisis.missed.push(`${c.id} (${route}): ${c.text}`);
      if (c.imminent) {
        r.imminent.n++;
        if (route === 'CRISIS' && imminent) r.imminent.flagged++;
        else r.imminent.missed.push(`${c.id}: ${c.text}`);
      }
    } else if (c.expected === 'CONCERN') {
      r.concern.n++;
      if (route === 'CONCERN' || route === 'CRISIS') r.concern.caught++;
      else r.concern.missed.push(`${c.id} (${route}): ${c.text}`);
    } else if (c.expected === 'THIRD_PARTY') {
      r.thirdParty.n++;
      if (route === 'THIRD_PARTY') r.thirdParty.correct++;
      else if (route === 'CRISIS') r.thirdParty.asSelfCrisis.push(`${c.id}: ${c.text}`);
      else r.thirdParty.missed.push(`${c.id} (${route}): ${c.text}`);
    } else {
      r.none.n++;
      if (route === 'NONE') r.none.clean++;
      else if (route === 'CRISIS') r.none.falseCrisis.push(`${c.id}: ${c.text}`);
      else r.none.falseConcern.push(`${c.id}: ${c.text}`);
    }
  }
  return r;
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : 'n/a');

function summaryRows(r) {
  return [
    ['Crisis messages routed to the safety response', `${r.crisis.caught}/${r.crisis.n}`, pct(r.crisis.caught, r.crisis.n)],
    ['Crisis messages with a time, plan or means flagged imminent', `${r.imminent.flagged}/${r.imminent.n}`, pct(r.imminent.flagged, r.imminent.n)],
    ['Distress messages given support (concern or crisis)', `${r.concern.caught}/${r.concern.n}`, pct(r.concern.caught, r.concern.n)],
    ['Someone-else-at-risk messages answered as such', `${r.thirdParty.correct}/${r.thirdParty.n}`, pct(r.thirdParty.correct, r.thirdParty.n)],
    ['Harmless messages left alone', `${r.none.clean}/${r.none.n}`, pct(r.none.clean, r.none.n)],
    ['Harmless messages treated as a crisis', `${r.none.falseCrisis.length}/${r.none.n}`, pct(r.none.falseCrisis.length, r.none.n)],
  ];
}

module.exports = { score, summaryRows };
