# ITwin Map (Nuxt 3)

## Setup

```bash
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

## Quality Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
npm run check
```

Component tests live in `tests/components` (vitest + @vue/test-utils + Vuetify, services mocked).

E2E smoke (Playwright) runs against a live stand (dev server :3040 + API :8040 on the DB copy) and is not part of CI:
`npm run e2e` — see `docs/e2e-smoke.md` (uses the already installed Chromium, no browser download).

## Production

```bash
npm run build
npm run preview
```
