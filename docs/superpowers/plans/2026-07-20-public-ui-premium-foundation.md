# Public UI Premium Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Establish a single premium, responsive visual system for the public Next.js pages and deliver the first production slice covering shared shell and Home.

**Architecture:** Preserve the Next/OpenNext route registry and page components. Replace conflicting global light-theme rules with explicit dark tokens, consolidate shared primitives, and use automated screenshot comparison against the `.dc` visual references. Changes remain isolated from admin modules and the transactional Clube backend.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3, Lucide React, Playwright 1.60, OpenNext Cloudflare 1.20.

## Global Constraints

- The canonical public URLs must continue to render through Next/OpenNext.
- Never redirect public routes to `/design/*.dc.html`.
- Preserve current public copy, official prices and booking URLs unless the source is demonstrably inconsistent.
- Maintain WCAG 2.2 AA focus and contrast.
- Support 320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440 and 1600 px.
- Respect `prefers-reduced-motion` and data-saving conditions.
- Do not modify admin styling through global selectors.

---

### Task 1: Visual baseline capture

**Files:**
- Create: `tests/capture-public-ui.spec.ts`
- Create: `.github/workflows/public-ui-baseline.yml`
- Create: `docs/design/public-ui-baseline.md`

**Produces:** screenshot artifacts for current Next pages and `.dc` references at mobile, tablet and desktop sizes.

- [ ] Capture Home, Pista, Locação, Reservas, Eventos, Campeonatos, História, Dúvidas, KAC, KAC Super, 200 Milhas, 500 Milhas and Clube.
- [ ] Disable animations and wait for fonts before capture.
- [ ] Capture full-page PNGs using deterministic names.
- [ ] Upload screenshots and a JSON manifest.
- [ ] Inspect representative screenshots and document the mismatch ledger.

### Task 2: Consolidate visual tokens

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Create: `src/styles/public-tokens.css`
- Test: `tests/public-production-stabilization.test.ts`

**Produces:** one dark public theme without light-theme global overrides.

- [ ] Add a failing test rejecting light body background and color utility overrides with `!important`.
- [ ] Define public color, typography, container, border, shadow and motion tokens.
- [ ] Scope public rules under `.public-site` so admin pages remain isolated.
- [ ] Remove conflicting Inter/Montserrat and light-surface hardening rules.
- [ ] Keep focus and reduced-motion behavior.

### Task 3: Shared navigation shell

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Footer.tsx`
- Create: `src/components/site-ui/MobileNavigation.tsx`
- Create: `src/hooks/useFocusTrap.ts`
- Test: `tests/pre-delivery-audit.spec.ts`

**Produces:** unified premium Header/Footer across every public page.

- [ ] Add sticky dark header with active route state and one primary booking CTA.
- [ ] Add accessible mobile drawer with Escape, focus trap and body scroll lock.
- [ ] Simplify topbar density for tablet/mobile.
- [ ] Refactor Footer into responsive columns with readable 14 px minimum auxiliary text.
- [ ] Add Playwright assertions for menu focus and close behavior.

### Task 4: Shared premium primitives

**Files:**
- Modify: `src/components/site-ui/AngledButton.tsx`
- Modify: `src/components/site-ui/SectionHeading.tsx`
- Modify: `src/components/site-ui/BigCTA.tsx`
- Create: `src/components/site-ui/MediaFrame.tsx`
- Create: `src/components/site-ui/MetricRail.tsx`

**Produces:** reusable component family matching the approved dark motorsport direction.

- [ ] Standardize button variants and touch targets.
- [ ] Standardize heading scale and text widths.
- [ ] Remove one-off gradients and generic rounded cards.
- [ ] Add media crop/fallback behavior.
- [ ] Add responsive metrics that collapse without compression.

### Task 5: Home premium migration

**Files:**
- Modify: `src/site-pages/Home.tsx`
- Modify: `src/components/Hero.tsx`
- Modify: `src/components/EventFormats.tsx`
- Modify: `src/components/HowItWorks.tsx`
- Modify: `src/components/About.tsx`
- Modify: `src/components/Booking.tsx`
- Modify: `src/components/Services.tsx`
- Modify: `src/components/Promotions.tsx`
- Modify: `src/components/Gallery.tsx`
- Modify: `src/components/WhyBetim.tsx`
- Modify: `src/components/Contact.tsx`

**Produces:** Home matching the premium `.dc` reference while remaining server-rendered and responsive.

- [ ] Rebuild first viewport with dark media-led composition and clear booking CTA.
- [ ] Separate corrida avulsa, grupos/aniversários and eventos corporativos.
- [ ] Vary section rhythm instead of repeating card grids.
- [ ] Optimize video behavior for mobile, reduced motion and data saving.
- [ ] Preserve lead and booking interactions.

### Task 6: Verification and PR

**Files:**
- Modify: `tests/pre-delivery-audit.spec.ts`
- Create: `docs/design/public-ui-foundation-fidelity-ledger.md`

- [ ] Run typecheck, lint, unit tests and Next build.
- [ ] Run Playwright at the required viewports.
- [ ] Build OpenNext.
- [ ] Capture after screenshots at the same baseline dimensions.
- [ ] Compare at least five points per representative viewport.
- [ ] Open a draft PR linked to Issue #2 with screenshots and remaining page groups.
