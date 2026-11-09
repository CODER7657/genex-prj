# Contributing

Aura's crisis routing decides whether a person at risk gets a reviewed safety reply, so
it is held to measured results.

## Ground rules

- **Recall may not drop.** `backend/test/crisisGate.test.js` fixes floors on the
  evaluation sets. Raise a floor when a number improves; never lower one to make a
  change pass. Never route a crisis message to an LLM-generated reply.
- **The crisis screen stays plain:** white, one helpline button, no styling.
- One issue, one branch, one pull request, with tests including failure paths.
- No secrets or real personal data. Keys go in a git-ignored `.env`.

## Set up and test

```bash
cd backend && npm ci && npm run lint && npx jest
cd ../frontend && npm ci && npm run typecheck && npm test && npm run build
npx playwright install chromium && npm run test:e2e
```

## Pull requests

Say what changed and why, and paste the real test output. UI changes need screenshots
at 375 and 1280 px. Security issues: see [SECURITY.md](SECURITY.md).
