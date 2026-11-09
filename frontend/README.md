# Frontend

The web client for the AI wellness companion: React 19, Vite 6, Tailwind CSS 3 and
TypeScript. It talks to the Express API in `../backend` (default
`http://localhost:5000/api`, override with `VITE_API_URL`).

## Run it

```bash
npm ci
npm run dev          # dev server
npm run build        # production build into dist/
npm run preview      # serve the build
```

## Checks

| Command | What it runs |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (`components/__tests__`), including the crisis screen |
| `npm run test:e2e` | Playwright against the production build on port 4319, every `/api` call mocked |

The Playwright suite (`e2e/`) checks the welcome screen, the chat screen, the mood
check-in and the goals, resources and analytics dialogs at 375, 768 and 1280 px:
no serious or critical axe violations, no horizontal scroll, touch targets of at least
44 px, Nunito loaded, no dark mode left behind. It also checks that a crisis reply
still opens the plain crisis screen with the region's helpline as the first link.
It needs Chromium for Playwright 1.65 (`npx playwright install chromium`, or point
`PLAYWRIGHT_BROWSERS_PATH` at an existing install). `e2e/screenshots.spec.ts` writes
screenshots to `D:/repos/genex-shots` (`SHOT_PREFIX=before|after`).

## Design: Clay Style

Soft, matte "clay" surfaces on a mint background, light only.

- **Tokens** live in one file, `tokens.css`: mint `#BFE8DA`, coral `#F28B6E`, leaf
  `#6FAF6B`, sand `#E8C39E`, clay `#D94B3D`, white, and ink `#2E2A24` / ink-soft
  `#554B40` for text (ink is at least 5.4:1 on every surface it sits on). Font sizes use
  `clamp()`, and the clay shadows (soft outer drop plus a light top-left and a darker
  bottom-right inset) are defined there too.
- **Tailwind** (`tailwind.config.js`) replaces the default theme with those tokens, so
  only token colours, weights 600/700/800 and the fluid type scale exist.
- **Components** in `index.css`: `.clay-card`, `.clay-btn` (+ `.clay-coral`, `.clay-mint`,
  `.clay-sand`, `.clay-leaf`), `.clay-input`, `.clay-well`, `.clay-dialog`, `.clay-switch`.
  `components/clay.tsx` holds the shared dialog shell and switch.
- **Type**: Nunito, self-hosted with `@fontsource/nunito` (600, 700, 800).
- **Icons**: `lucide-react`. No emoji as icons.
- **Motion**: hover and press transitions only, and only under
  `prefers-reduced-motion: no-preference`.

The crisis screen (`components/CrisisAlert.tsx` and the `.crisis-*` rules at the end of
`index.css`) is deliberately not themed: white, near-black text, one large helpline
button, no animation.
