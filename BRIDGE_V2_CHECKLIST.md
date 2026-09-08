# Bridge V2 implementation checklist

This is the handoff record for Bridge V2. If a new Codex context is needed,
start by reading this file and the current `git status`.

## Guardrails

- Keep Airtable `People` and the existing Auth.js magic-link flow as identity.
- Preserve existing activity sign-ups, `Submissions`, and `Hours` data.
- Activities are opportunities; Claims are commitments; Contributions are
  completed work; Hours are awarded credit.
- Airtable and future Supabase service credentials stay server-side.

## Status

- [x] Bridge 1 — simplify volunteer navigation and preserve legacy routes.
- [x] Bridge 2 — introduce first-class Claims and real My Activities.
- [x] Bridge 3 — build `/activities/[claimId]` activity viewer.
- [x] Bridge 4 — add Bridge-native contribution submissions.
- [x] Bridge 5 — create Hours from approved Contributions.
- [x] Bridge 6 — add completion type, platform, hours method, and external project configuration.
- [x] Bridge 7 — add Oppia certificate contribution flow.
- [x] Bridge 8 — add Monsoon placeholder and signed external contribution sync.
- [x] Bridge 9 — make the old hours form a Missing hours? fallback.

## Bridge 1 completed

- Volunteer sidebar is now: Home, Activities, Hours, My Profile.
- `/claim` redirects to `/activities` so existing claim bookmarks continue to work.
- `/activities` is now the real Bridge entry point for browsing new work on
  `activities.omelora.org`; it deliberately does not use mock data.
- Legacy mock activity-detail URLs redirect to `/activities`.
- `/submit-work` and `/request` remain available for existing direct links,
  but are no longer primary navigation.
- The dashboard no longer shows the generic Request Hours quick link.

## Next phase: Bridge 2

Create Airtable `Claims` additively, backfill one claim per existing
`Activities."Linked Sign Ups"` relationship, and retain those original linked
sign-ups as the compatibility source until the external activities board writes
Claims directly. Then replace the Activities landing screen with claimed
activities from the signed-in person's session-bound identity.

### Migration command

The additive Airtable migration creates `Claims`, then backfills only missing
person/activity pairs from `Activities."Linked Sign Ups"`. It never modifies
the original links or any `Submissions` or `Hours` data.

```bash
npm run bridge:backfill-claims
npm run bridge:backfill-claims -- --apply
```

### Follow-up: required submission counts

For repeatable deliverables such as the six-letter activity, keep one Claim
per person/activity and enforce the work requirement at Hours review instead
of allowing a second Claim. Add an optional numeric
`Activities."Required Submission Count"` field (set it to `6` for that
activity). Count the `Submissions` linked to the volunteer's Hours request for
the Activity, show progress such as `4 of 6 submissions received`, and block
server-side Hours approval while the count is below the required value. This
counts individual Submission records; if several letters may be bundled into
one record/file, use a separate verified units-completed field or reviewer
judgment instead.

## Bridge 4 completed

- `/activities/[claimId]` now accepts a work link and/or completion notes and
  displays the volunteer's submitted work for that claim.
- Contributions are stored in a new additive Airtable `Contributions` table;
  existing `Submissions` and `Hours` records are not changed.
- The API resolves the requested claim from the signed-in person's session
  before creating a contribution.

### One-time Airtable setup

Preview the additive table creation, then apply it:

```bash
npm run bridge:setup-contributions
npm run bridge:setup-contributions -- --apply
```

## Bridge 5 completed

- Leaders review submitted work at `/review-contributions`.
- Approving a contribution creates one already-approved `Hours` record with
  the linked Person and Activity, the activity's configured Hours Value, the
  contribution's work link/notes, and the approving leader as Reviewer.
- The contribution stores the generated `Hours Record ID`, so the UI does not
  award it again. Run the existing setup command once more to add this
  additive field if Contributions was created before Bridge 5.

## Bridge 6 completed

- Activities now support additive Completion Type, Platform, Hours Method,
  External Project ID, and External Project URL configuration.
- Existing activities default in code to Bridge submission, Bridge platform,
  and Activity value hours, so they retain their current behavior until
  configured otherwise.
- External activities show their platform/project link and deliberately do not
  use the generic Bridge work-submission form; Bridge 7 and Bridge 8 will add
  their platform-specific contribution paths.

### One-time Airtable setup

```bash
npm run bridge:setup-activity-completion-config
npm run bridge:setup-activity-completion-config -- --apply
```

## Bridge 7 completed

- Activities configured as `External certificate` on the `Oppia` platform now
  collect a shareable Oppia certificate link instead of the generic work form.
- When an activity uses `Certificate value` hours, volunteers also submit the
  number printed on the certificate. A leader verifies it before credit is
  awarded; otherwise the configured Activity value is awarded.
- The additive `Contributions."Certificate Hours"` field preserves the value
  that was reviewed without modifying legacy submissions or hours.

### One-time Airtable setup

Run the existing Contributions setup once to add the certificate-hours field:

```bash
npm run bridge:setup-contributions -- --apply
```

## Bridge 8 completed

- Activities configured as `External sync` on `Monsoon` now show a clear
  placeholder instead of a Bridge submission form. They may still link to the
  configured Monsoon project.
- `POST /api/contributions/external` accepts a signed Monsoon completion event
  and creates an already-approved Contribution plus its Hours record. The
  event is idempotent on its external contribution ID.
- Configure `MONSOON_WEBHOOK_SECRET` server-side. Sign the exact raw JSON body
  with HMAC-SHA256 using the string `${timestamp}.${rawBody}`, and send Unix
  seconds in `X-Bridge-Timestamp` plus `sha256=<hex digest>` in
  `X-Bridge-Signature`. Requests older than five minutes are rejected.
- The JSON payload requires `eventId`, `personEmail`, and `projectId`; optional
  fields are `workLink`, `notes`, `hours`, `completedAt`, and
  `externalClaimId`. The project must map to exactly one activity configured
  as Monsoon + External sync, and the person must already have that activity
  claimed.

### One-time Airtable setup

Run the existing Contributions setup once to add the additive `Verified Hours`
field used for externally verified hour values:

```bash
npm run bridge:setup-contributions -- --apply
```

## Bridge 9 completed

- `/request` remains available for legacy/direct links, but is now explicitly
  framed as a **Missing hours?** fallback rather than the normal completion
  path.
- The Hours Summary includes a secondary Missing hours? link to that form.
- Claimed work should be submitted and finalized from My Activities.
