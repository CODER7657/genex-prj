# Changelog

All notable changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No release has been tagged yet.

## [Unreleased]

### Added
- Crisis gate: recall floors and false-alarm ceilings on every evaluation set, with the
  LLM judge replayed offline from its committed outputs (#7).
- Clay Style web app, light only, with Playwright and axe tests at 375, 768 and 1280 px (#9).
- Frontend unit tests and type checking in CI (#8).
- Repository standards: security policy, contributing guide, code of conduct, issue and
  pull request templates, Dependabot, `.editorconfig`, `.gitattributes`.

### Changed
- README rewritten around measured crisis-routing results (#6).
- CI runs on Node 22; backend ESLint is configured and fails the build.

### Fixed
- The crisis screen showed US-only numbers to everyone; it now shows the region's
  helplines from the backend, plainly, with one large helpline button (#8).
- The Crisis Support tab listed only US services; it now lists India first (#10).
- No model key or Gemini client can reach the browser bundle (#11).
- `/api/chat/crisis-check` now has its intended rate limit; a duplicate
  `getConversationContext` that silently shadowed another was removed.
