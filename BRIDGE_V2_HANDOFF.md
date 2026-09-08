# Bridge V2 handoff

## Current state

This workspace is intentionally dirty. Do not reset, checkout, or discard
uncommitted work: it includes the in-progress Bridge V2 refactor and related
data migration scripts.

Primary volunteer routes:

- `/dashboard` — volunteer home and active-work preview
- `/activities` — My Activities list
- `/activities/[claimId]` — full-screen Activity Viewer workspace
- `/summary` — hours summary and certificate print view
- `/profile` — profile view/edit

## Product rules

- Activity = opportunity; Claim = signup/commitment; Contribution = completed
  qualifying work; Submission = volunteer artifact; Hours = awarded credit.
- Workflow is determined by `Activities.Type + Activities.Platform`.
- `Submission Format` has only two valid values: `Text` or `File`. Do not add
  a combined or fallback option.
- Keep historical People, Claims, Activities, Contributions, Submissions, and
  Hours records intact. Do not modify Airtable schema from application code.
- Do not revive `Hours Method`, `Completion Type`, or old completion values.

## Activity state shown to volunteers

`ClaimedActivity.completionState` is derived in `src/lib/airtable.ts`:

- `In progress`: no submitted/approved Contribution.
- `Submitted`: a Contribution is awaiting review.
- `Completed`: Claim is marked complete or a Contribution is approved.

`/activities` groups work into In progress and Completed. `/dashboard` shows
only in-progress activities in its compact “Your activities in progress” area.

## Viewer and contribution workflow

- Claimed activity cards link to `/activities/[claimId]`.
- The Viewer is a fixed full-screen overlay over Bridge, exited with
  `← My Activities`.
- Inside the Viewer, the outer activity card is two-column on desktop:
  information/instructions left, action workspace right; it stacks on mobile.
- Bridge Submission activities save one `Submissions` record per saved item,
  link it to Person + Activity + physical Claim where available, enforce the
  target server-side, and accept only the configured Text or File format.
- On finalization, Bridge creates/reuses one submitted Contribution and one
  submitted Hours record. The Contribution stores quantity, calculated hours,
  linked Submissions, and the Hours record ID. A retry reconnects interrupted
  finalization to avoid duplicate Hours records.
- Contribution approval updates the existing submitted Hours record; historical
  Contributions without an Hours link retain the legacy fallback creation path.
- Oppia certificate PDF uploads are stored through the existing Submissions
  attachment field and linked to the Contribution as evidence.
- Monsoon is only an outbound workspace/action placeholder in the viewer.

## UI system and current decisions

Shared tokens are in `src/styles/typography.ts`:

- `typography.pageTitle`, `sectionTitle`, `cardTitle`, `body`, `bodySmall`,
  `label`, `metadata`, `helper`, `button`, `buttonSecondary`, and `status`.
- `textColor.card` is the softened gray title color used by activity cards.
- `buttonSecondary` is the neutral, light-gray button surface. Use it for
  Refresh, Edit, certificate, and similar secondary actions.

Current visual conventions:

- Card hover is medium gray (`#9A9A9A` border plus muted background), never
  orange.
- Mobile uses a fixed bottom navigation with icons and names. It is rendered
  by `MobileNavigation` outside the PageShell sidebar slot; do not move it back
  into that slot.
- The desktop sidebar is hidden below `md`; mobile nav automatically chooses
  volunteer or director items from the session role.
- Dashboard: Discord quick link is “Discord Community” / “Connect with more
  volunteers”; Omelora Website was removed; Volunteer Activities Board is the
  first Quick Link.
- Dashboard “Your Activity” icon uses `bg-green-500`.

## High-value files

- `src/lib/airtable.ts` — Airtable mapping, Claims/Contributions/Submissions
  and completion-state derivation.
- `src/app/api/person-activities/[claimId]/route.ts` — save/finalize API.
- `src/app/api/contributions/review/route.ts` — review/Hours update behavior.
- `src/app/activities/page.tsx` — activity groups.
- `src/app/activities/[slug]/page.tsx` — full-screen viewer.
- `src/app/dashboard/page.tsx` — active activity preview and quick links.
- `src/components/AppShell.tsx` and `src/components/AppSidebar.tsx` — desktop
  shell and mobile bottom navigation.
- `src/app/summary/page.tsx`, `src/app/(leader)/profile/page.tsx` — shared
  heading and secondary-button adoption.

## Validation and known limitation

Run `npx tsc --noEmit` and `git diff --check`. Both passed after the latest
changes.

`npm run build` previously stopped before the Next.js build because Prisma's
remote migration/schema engine failed against the configured database. Treat
that as an environment/database connectivity issue to investigate separately;
it was not a TypeScript failure.

## Suggested next checks

1. In a signed-in browser session, verify that submitted and approved
   Contributions move activities from In progress to the completed group.
2. Check the viewer for each Type + Platform combination with real Airtable
   records, especially a Text submission and a File submission.
3. Continue applying `typography` / `textColor` / `buttonSecondary` to older
   untouched pages only when they are being worked on; avoid a broad redesign.
