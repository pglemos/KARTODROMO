# Public Site Production Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve one truthful, indexable and testable public Next.js application on Cloudflare Workers instead of redirecting canonical routes to client-rendered design documents.

**Architecture:** The catch-all App Router page owns route metadata while a single client boundary renders the public page selected from `usePathname()`. Canonical aliases are handled by permanent Next redirects. Mock Clube account operations are replaced with a truthful beta state until an authenticated backend exists.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3, Vitest 4, Playwright 1.60, OpenNext Cloudflare 1.20, Wrangler 4.

## Global Constraints

- Keep all existing admin routes and D1 bindings unchanged.
- Do not expose credentials or Cloudflare account identifiers in the repository.
- Do not proxy or clone MyLapTime.
- Use canonical Portuguese URLs and `pt-BR` metadata.
- No production route may present generated customer data as real.
- Pull-request verification must complete before deployment.

---

### Task 1: Canonical route registry and metadata

**Files:**
- Create: `src/config/publicRoutes.ts`
- Modify: `app/[[...slug]]/page.tsx`
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Test: `tests/public-routes.test.ts`

**Interfaces:**
- Produces: `PUBLIC_ROUTES`, `PUBLIC_ROUTE_BY_PATH`, `getPublicRoute(pathname)` and `PublicRouteDefinition`.
- Consumes: site base URL from `NEXT_PUBLIC_SITE_URL`, defaulting to `https://kartodromodebetim.com.br`.

- [ ] Write failing unit tests for unique canonical paths, metadata and route lookup.
- [ ] Implement the route registry with all institutional, championship and Clube routes.
- [ ] Add `generateMetadata` to the catch-all page.
- [ ] Add sitemap and robots route modules.
- [ ] Run `npm test -- tests/public-routes.test.ts` and verify PASS.

### Task 2: Remove browser-only public routing

**Files:**
- Modify: `src/App.tsx`
- Modify: `app/PublicSiteClient.tsx`
- Test: `tests/public-app-routing.test.tsx`

**Interfaces:**
- Consumes: `getPublicRoute(pathname)` and the existing page components.
- Produces: deterministic pathname-to-component resolution without `BrowserRouter`.

- [ ] Write failing tests for canonical and unknown pathname resolution.
- [ ] Replace `BrowserRouter`, `Routes`, `Route` and `useLocation` with `usePathname` and a route component map.
- [ ] Keep scroll restoration in a dedicated component receiving `pathname` and `hash`.
- [ ] Remove the white mount gate from `PublicSiteClient`.
- [ ] Run route unit tests and typecheck.

### Task 3: Normalize production redirects

**Files:**
- Modify: `next.config.ts`
- Test: `tests/next-config.test.ts`

**Interfaces:**
- Produces: permanent redirects for legacy aliases only.

- [ ] Write a failing test proving canonical routes are not redirected to `/design/`.
- [ ] Remove all temporary `.dc.html` redirects.
- [ ] Add permanent redirects from `/valores` to `/kart-locacao` and championship aliases to canonical short routes.
- [ ] Add security headers that do not break OpenNext or external booking links.
- [ ] Run the Next config tests.

### Task 4: Make Clube customer routes truthful

**Files:**
- Modify: `src/site-pages/ClubPages.tsx`
- Create: `src/components/club/ClubPortalUnavailable.tsx`
- Test: `tests/club-safety.test.tsx`

**Interfaces:**
- Produces: `ClubPortalUnavailable` and safe rendering for `cadastro`, `consulta`, `painel`, `corridas`, `pontuacao`, `catalogo`, `resgates`, `perfil`, and `campanhas`.
- Keeps: `vantagens` and `regulamento` informational content.

- [ ] Write failing tests that reject mock CPF, mock customer names, fake success messages and active redemption controls.
- [ ] Add a clear beta/unavailable state with WhatsApp and benefits links.
- [ ] Route customer-specific Clube pages to the safe state.
- [ ] Ensure no mock customer data is rendered or bundled through the public route component.
- [ ] Run club safety tests.

### Task 5: Expand production Playwright coverage

**Files:**
- Modify: `tests/pre-delivery-audit.spec.ts`
- Modify: `playwright.config.ts` if required.

**Interfaces:**
- Consumes: `PUBLIC_ROUTES` canonical path list through a duplicated stable test fixture to avoid browser bundling test config.

- [ ] Add all canonical public routes.
- [ ] Add assertions for unresolved `{{ ... }}` expressions and `.dc.html` navigation.
- [ ] Add metadata and canonical checks.
- [ ] Add Clube safety-state checks.
- [ ] Preserve responsive, focus, contrast and reduced-motion checks at 375, 768, 1024 and 1440 pixels.

### Task 6: Cloudflare CI/CD

**Files:**
- Create: `.github/workflows/cloudflare-worker.yml`
- Modify: `package.json`
- Modify: `wrangler.jsonc`
- Create: `public/_headers`
- Modify: `.gitignore`

**Interfaces:**
- Consumes GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Produces: pull-request verification and protected main-branch deployment.

- [ ] Add `preview`, `deploy`, `upload` and `cf-typegen` scripts aligned with OpenNext documentation while retaining compatibility aliases.
- [ ] Enable Cloudflare observability and update the compatibility date.
- [ ] Add immutable caching for fingerprinted Next assets and conservative caching for public media.
- [ ] Add CI steps: `npm ci`, typecheck, lint, unit tests, Next build and OpenNext build.
- [ ] Add deployment job on `main` after verification using `npm run deploy`.

### Task 7: Documentation and final verification

**Files:**
- Modify: `README.md`
- Create: `docs/deployment/cloudflare-workers.md`

- [ ] Replace obsolete Vite/Vercel deployment instructions with Next/OpenNext/Cloudflare instructions.
- [ ] Document required GitHub secrets and Cloudflare bindings without secret values.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run build:worker`.
- [ ] Run Playwright against the OpenNext preview.
- [ ] Open a pull request containing verification evidence and deployment notes.