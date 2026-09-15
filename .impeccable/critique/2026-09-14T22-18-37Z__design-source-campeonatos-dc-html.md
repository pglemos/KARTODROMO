---
target: critique essas paginas (campeonatos, 100-milhas-light, home 100 Milhas block)
total_score: 23
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
timestamp: 2026-09-14T22-18-37Z
slug: design-source-campeonatos-dc-html
---
# Critique: /campeonatos · /100-milhas-light · home 100 Milhas block
Method: dual-agent (A design review · B detector + browser). Caveats: A lost shared browser mid-run; detector ran in regex fallback (no HTML parser, contrast checks skipped).

## Design Health Score — 23/36 (Acceptable, 64%; H7 n/a)
1 Visibility 3 · 2 Real world 3 ("Novo campeonato" for a race; "Time penalty" in English) · 3 Control 2 (no focus trap; only "remove last" pilot; modal close loses data) · 4 Consistency 2 (campeonatos modal says "Pix ou boleto"; 4 CTA labels) · 5 Error prevention 2 (no CPF/phone mask; "Kart nº (auto)") · 6 Recognition 3 · 7 n/a · 8 Aesthetic 3 · 9 Error recovery 2 (single bottom alert capped at 4) · 10 Help 3

## Design Specificity
Copy is product-specific; structure is template-generic (eyebrow + 2-line Anton + 4-cell stat strip + CTA box repeated across all 3 surfaces; home strip duplicates 100ML strip). No track map, stint/pit timeline or timing visual. Detector: off-scale font sizes 7/15/14, off-palette colors 6/9/2 (#c7cbc4, #667067, #20d466, generator #829083), dark-glow on floating WhatsApp button — mostly DESIGN.md drift.

## Priority Issues
- [P1] WhatsApp handoff can fail silently: window.open after await (100-milhas-light.dc.html:481) popup-blocked; failed /api/inscricao still shows success-like screen; campeonatos.dc.html:189 mentions boleto. Fix: WhatsApp button as primary action, honest failure copy, remove boleto. → clarify
- [P1] Modal accessibility: no focus move/trap/inert, no lang="pt-BR" (all 3 files), campeonatos labels without for= (:172–187), 24px checkboxes / 32–40px close on mobile. → harden
- [P1] Error recovery: merged bottom alert capped at 4 (:254, :439). Fix: inline per-field errors, aria-invalid, scroll/focus first invalid, CPF/phone masks. → harden
- [P2] {{ }} bindings leak: 404s for {{ c.logo }}, {{ opt.image }}, {{ g.image }}; SVG d="{{ t.icon }}" console errors on all 3 pages. → optimize
- [P2] Template sameness / no product visual; "Troféus para o top 5" block mixes 961 m and 20 equipes (:566–571); past races equal weight on /campeonatos. Fix: track layout + pit-stop timeline, group past races. → bolder, layout

## Persona Red Flags
Jordan: 9 jargon rule cards; "Kart nº (auto)" unclear. Casey: 75 stacked inputs, off-screen error, blocked popup, no draft persistence. Riley: backdrop/Tab escape, 4-error cap, positive screen on API failure. Team captain: 9+ pilots on phone, cannot remove a specific pilot, no e-mailed receipt.

## Minor Observations
"25 OUT" outline text 40% opacity carries real data; ~97ch line length on 100ML desktop; 11px body spans (campeonatos stats, home); home "Regulamento e cronograma" links to page not PDF; footer "Motorsport editorial experience"; off-palette colors undocumented; generic campeonatos hero claim.

## Questions to Consider
Registration as a stepped page instead of a modal? Why no track/stint visual on an endurance page? Should the 100 Milhas block own the home hero until 15/10?
