# LiveTime LED Scoreboard Epic

## Epic

**ID:** EPIC-LIVETIME-LED-SCOREBOARD  
**Title:** LiveTime LED scoreboard project  
**Status:** Implemented  

### Outcome

Deliver a documented implementation trail for the LiveTime LED scoreboard project so the work can be planned, implemented, validated, and handed off with clear acceptance criteria and QA coverage.

### Scope

- LiveTime LED scoreboard project documentation.
- One implementation story with acceptance criteria, tasks, QA checklist, file list placeholder, and status.

### Out of Scope

- Requirements not provided by the user.
- Code, design, infrastructure, or operational changes outside documentation.

## Implementation Story

**ID:** STORY-LIVETIME-LED-SCOREBOARD-001  
**Title:** Implement LiveTime LED scoreboard 2048x512  
**Status:** Ready for QA / Field Validation  

### Story

As a project contributor, I need a concise AIOX-style epic/story trail for the LiveTime LED scoreboard project so implementation work can proceed with shared expectations, traceable tasks, and an explicit QA checklist.

### Acceptance Criteria

- An epic exists for the LiveTime LED scoreboard project.
- The epic includes one implementation story.
- The implementation story includes:
  - Acceptance criteria.
  - Implementation tasks.
  - QA checklist.
  - File list placeholder.
  - Current status.
- The document stays concise and uses only the requirements provided by the user.
- Documentation edits are limited to `docs/` or root operational documentation if needed.

### Tasks

- [x] Create the LiveTime LED scoreboard epic.
- [x] Implement Next.js page `/placar-telao`.
- [x] Implement 2048x512 fixed layout.
- [x] Implement 6 groups x 5 rows with `P | # | Nome | Time`.
- [x] Implement polling every 2 seconds.
- [x] Implement normalized snapshot contract.
- [x] Implement DOM scraper service for the LiveTime Blazor page.
- [x] Implement `/api/livetime-snapshot`.
- [x] Add fallback/demo state.
- [x] Add unit tests for normalizer, layout distribution, and DOM extraction.
- [x] Add TB50 and HDMI operational documentation.

### QA Checklist

- [x] Confirm the document contains exactly one epic.
- [x] Confirm the document contains exactly one implementation story.
- [x] Confirm acceptance criteria are present and concise.
- [x] Confirm tasks are present and actionable.
- [x] Confirm QA checklist is present.
- [x] Confirm file list is present.
- [x] Confirm status is present for both epic and story.
- [x] Confirm no unprovided requirements were added.
- [x] Confirm `npm test` passes.
- [x] Confirm `npm run build` passes.
- [x] Confirm `npm audit --omit=dev` reports zero vulnerabilities.
- [x] Confirm Playwright scraper reads real LiveTime DOM.
- [x] Confirm rendered page is 2048x512 with no scroll.
- [x] Confirm status shows `AO VIVO` with real snapshot data.

### File List

- `app/placar-telao/page.tsx`
- `app/api/livetime/route.ts`
- `app/api/livetime-snapshot/route.ts`
- `components/telao/TelaoClient.tsx`
- `components/telao/LiveTimingTable.tsx`
- `components/telao/StatusBar.tsx`
- `components/telao/telao.css`
- `lib/livetime/types.ts`
- `lib/livetime/demo-data.ts`
- `lib/livetime/normalize-drivers.ts`
- `lib/livetime/client.ts`
- `lib/livetime/layout.ts`
- `lib/livetime/dom-extractor.ts`
- `lib/livetime/snapshot-cache.ts`
- `services/livetime-scraper.ts`
- `services/livetime-scraper-server.ts`
- `README-TELAO.md`
- `CHECKLIST-TB50.md`
- `CHECKLIST-CAPTURA-ENDPOINT.md`
- `PLANO-CONTINGENCIA-HDMI.md`

### Notes

- This trail is intentionally documentation-only.
- Status can be updated as implementation progresses.
