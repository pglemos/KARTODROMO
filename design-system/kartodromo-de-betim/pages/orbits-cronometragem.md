# Orbits Cronometragem Page Overrides

> **PROJECT:** Kartodromo de Betim
> **Generated:** 2026-11-07 03:25:22
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** Hero (product + live preview or status) > Key metrics/indicators > How it works > CTA (Start trial / Contact)

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark or neutral. Status colors (green/amber/red). Data-dense but scannable.

### Component Overrides

- Avoid: Present 150-300ms or any cutoff as a universal requirement
- Avoid: Auto-advance slides without a stop control
- Avoid: Depend on animationend or transitionend for required state correctness

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Real-time chart animations, alert pulse/glow, status indicator blink animation, smooth data stream updates, loading effect
- Animation: Use shared motion tokens and test that feedback stays responsive
- Animation: Provide previous next and play/pause; stop on focus or hover and when reduced motion is requested
- Animation: Cancel or replace prior motion; set the final semantic state directly and handle cancellation cleanup
- CTA Placement: Primary CTA in nav + After metrics
