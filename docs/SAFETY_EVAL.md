# Crisis routing: safety evaluation

How reliably the chat recognises that someone may be at risk, measured before and
after the safety rebuild. Regenerate the numbers with:

```bash
cd backend
node scripts/safety-eval.js              # main set, every miss listed
node scripts/safety-eval.js --holdout    # held-out set
npx jest test/safety.test.js             # the guarantees, as tests
```

## What changed in how the chat responds

| Message routed | Before | Now |
|---|---|---|
| **CRISIS**: the user may be at risk of suicide, or is self-harming | Gemini wrote the reply, with the risk level added to its prompt | A **fixed, reviewed reply**, never generated: it takes the message seriously, asks if they are safe, and gives the right helpline. If the message has a time, plan or means, it adds the emergency number first |
| **THIRD_PARTY**: worried about someone else | Not recognised; treated as the user's own crisis or ignored | A fixed reply on how to help them: ask directly, listen, helplines, emergency number, look after yourself |
| **CONCERN**: distress, past self-harm, negated ideation | Gemini reply | Gemini reply, plus a helpline line that is always appended |
| **NONE** | Gemini reply | Unchanged |

Helplines follow `CRISIS_REGION` (`IN`, `US`, `UK`). With no region set, replies list
India (Tele-MANAS 14416, emergency 112), the US (988, 911) and findahelpline.com.
Before, every user saw US-only numbers, including the retired 1-800-273-8255.

## Results

### Main set: 107 cases

Written and committed **before** the new detector (commit `ce7a0b2`), then used to
build it. One rule was corrected after a miss: negation must not reach across a
clause, so "it won't matter because I won't be here" is not read as negated.

| Check | Before (keyword matching) | After (safety rebuild) |
|---|---|---|
| Crisis messages routed to the safety response | 9/49 (18%) | 49/49 (100%) |
| Crisis messages with a time, plan or means flagged imminent | 0/7 (0%) | 7/7 (100%) |
| Distress messages given support (concern or crisis) | 6/14 (43%) | 14/14 (100%) |
| Someone-else-at-risk messages answered as such | 0/8 (0%) | 8/8 (100%) |
| Harmless messages left alone | 32/36 (89%) | 36/36 (100%) |
| Harmless messages treated as a crisis | 0/36 (0%) | 0/36 (0%) |

### Held-out set: 41 cases

Written **after** the detector and committed before it was ever run on them
(commit `6e69fe8`). Never used to tune it. These are the numbers to trust.

| Check | Before (keyword matching) | After (safety rebuild) |
|---|---|---|
| Crisis messages routed to the safety response | 0/20 (0%) | **3/20 (15%)** |
| Crisis messages with a time, plan or means flagged imminent | 0/2 (0%) | 0/2 (0%) |
| Distress messages given support (concern or crisis) | 1/6 (17%) | 1/6 (17%) |
| Someone-else-at-risk messages answered as such | 0/4 (0%) | 1/4 (25%) |
| Harmless messages left alone | 11/11 (100%) | 11/11 (100%) |
| Harmless messages treated as a crisis | 0/11 (0%) | 0/11 (0%) |

## What this shows

**Phrase rules catch the phrasings they were written for, and little else.** 100% on
the main set and 15% on held-out cases is the gap between memorising examples and
understanding them. Held-out messages it still misses include "I'm ready to die",
"I want to stop existing", "I hope I don't wake up", "I've been cutting again" and
"jeene ka mann nahi karta". Adding those phrases now would only repeat the problem.

**What the rebuild does guarantee,** checked by `test/safety.test.js` in CI:

- Every message it does route CRISIS gets the fixed safety reply. A crisis never
  depends on the LLM being up, or on how the LLM would have worded it.
- It never fails a case, in either set, that the old detector handled.
- No harmless message in either set is treated as a crisis.
- Helplines match the user's region.
- A past suicide attempt is never softened to concern by "years ago".

**What it does not guarantee:** that a person in crisis is recognised. On new
phrasings, most are not.

## Next step

Add a meaning-based second layer and measure it on the held-out set: an LLM risk
classifier with a strict rubric, or a sentence-embedding classifier. Route CRISIS if
*either* layer says so, so the rules stay as a floor that works offline. Then write a
new held-out set, because this one will have been seen.

## Limits of this evaluation

- **One author.** The same person wrote the cases and the detector. The held-out set
  limits how much that matters, but does not remove it.
- **Synthetic messages.** Real messages are longer, messier and spread over a
  conversation; this scores single messages.
- **Small.** 49 + 20 crisis cases cannot estimate real-world recall with any
  precision.
- **Hindi rules are unreviewed** by a native speaker.
- **Not a clinical tool.** This routes chat messages to fixed safety replies. It does
  not assess anyone's risk.
