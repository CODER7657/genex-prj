# Security policy

Aura handles messages from people who may be in distress, so security and privacy
reports are taken seriously.

## Reporting a vulnerability

Please report privately through GitHub:
[Security → Report a vulnerability](https://github.com/CODER7657/genex-prj/security/advisories/new).
Do not open a public issue. You should get a reply within 7 days.

In scope: the API (`backend/`), the web app (`frontend/`), the crisis routing and its
fixed replies, and anything that could expose a user's messages or keys.

## How the project handles secrets and data

- Keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `JWT_SECRET`, `SESSION_SECRET`) are read from
  a git-ignored `.env`; none reach the browser bundle.
- The crisis judge logs failures without message text.
- Evaluation sets are synthetic; no real user messages are in the repository.
