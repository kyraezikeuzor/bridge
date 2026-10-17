# Bridge Education Action build

Source of requirements: Kyra's “Bridge Feature List” Apple Note supplied September 28, 2026, plus the clarification that projects are individual. This supersedes the Supabase migration direction. This checklist is implementation status, not a claim that everything is shipped.

## Fixed decisions
- Operational data stays in Airtable. Preserve the existing authentication database. Google authentication is deferred.
- Keep Activities and types Submission / Participation / Attendance. An explicit Creates Project flag controls project creation; attendance never creates a project.
- One individual project per volunteer signup. Default capacity: five projects per activity. No team flow.
- School Kits and Care Kits: minimum 30. Kits go directly to centers; Omelora has no PO box.
- Letters: write/paste drafts in Bridge, submit for review; directors print/mail and verify delivery.
- Project completion is independent of Hours approval. Only completed, verified new-model projects enter impact totals.
- Target: 1,000 completed projects by December 2027. Never backfill legacy projects as new-mission impact automatically.

## Build checklist
- [x] Additive Airtable schema, backup and repeatable verification (preserve legacy Projects/Campaigns/Contributions).
- [x] Activities show center/location, requirements, deadline and five-slot availability.
- [x] Native Bridge signup creates a claim and individual project; server-side capacity and stable signup key. External activities-board integration remains pending.
- [x] My Projects with deadlines and separate completion state, plus a personalized dashboard project summary.
- [x] Guided completion: work, quantities, delivery evidence, reflection, final submission.
- [x] Images of donated items; shipping/tracking details or in-person associate photo/consent-safe confirmation alternative.
- [ ] Online letter drafts are complete; the dedicated director mailing queue is still pending.
- [x] Director project review, changes requested, awaiting delivery, verified completion and a separate Submitted Hours record. No automatic credit awards.
- [x] Volunteer project proposals: activity, beneficiary, adult/organization contact, need, cost and completion date.
- [x] Activity creation inside Bridge with Track, center, category-specific instructions, guides and capacity.
- [x] Home: project counts, next steps/deadlines and hours. Existing navigation remains intact; the new top-bar visual redesign is tracked separately below.
- [ ] Hours certificate request button (preserve general certificate; retire Oppia-only workflow).
- [x] Admin member lookup with volunteer hours.
- [x] Impact metrics: active volunteers, active/completed projects, countries, verified items; completed goal 1,000 by Dec 2027.
- [x] Active = approved work completed in trailing six months, not existence in legacy Contributions.
- [ ] Design: top bar/sidebar reference styles only, shared typography, search, Discord, notifications, blue hours orb; no calendar or Free/Upgrade UI.
- [ ] Activity availability emails, signup confirmations, deadline reminders with preferences and duplicate prevention.
- [ ] AMA email campaign / daily Discord countdown / Basecamp workflow: build configuration and previews before enabling outbound campaigns.
- [ ] Audit Contributions consumers across Bridge, activities repo, forms and automations before archival/deletion.
- [ ] Retire unused Supabase migration entry points and Oppia-specific input, preserving historical records and certificates.
- [ ] Public gallery visibility/consent controls and safe default project title (first name, last initial, activity, center).

## Safe launch and verification
- Do not publish sample opportunities, fabricate completed projects or send bulk messages during development.
- Never rewrite historical hours or delete old project records to start new metrics at zero.
- New schema fields are additive. New-project routes must fail safely if setup is incomplete.
- Check authentication, ownership, reviewer authorization, duplicate requests, full capacity, immutable submitted evidence, and review retries.
- Test workflow locally without awarding real volunteer credit. Test existing hours regression suite and TypeScript/lint.
- Fetch the care/school kit guides before implementing detailed instructions. Attached reference images must be inspected before copying visual styles.

## Reference guides
- Care kits: https://docs.google.com/document/d/13Vm3mCnkjCBIay0WWpdI4QEVns4jTTcsNDk4rSaMLtw/edit
- School kits: https://docs.google.com/document/d/1u6P73nRq_GnW9ad-z45RvmPX_ZTstA6SqSNfjE-hqeQ/edit

## Still configurable, not assumed
Fundraising split; fractional quantity rounding; reflection award policy; verification standard for mail receipt. Project/Campaign tables remain separate until a concrete migration is agreed. Default public visibility is private.

## First implementation — September 28, 2026
- Added 39 fields across existing Airtable tables; verified from live schema. No existing records changed and no test volunteer credits created.
- `/projects`: individual project list and native available-project tab. Only explicitly enabled, active activities at Accepted centers are listed; existing opportunities were not enabled automatically.
- `/projects/[id]`: draft work/letters, item photos, shipping/in-person/service evidence, reflection and requested hours. Submitted evidence is locked; each submission attempt preserves an attachment-backed snapshot in Submissions.
- `/project-reviews`: live director role checks, no self-review, changes requested, approve work, verify delivery. Uses existing Hours review for awards.
- Legacy activity finalization excludes project-linked claims to avoid a second hours workflow.
- Distributed signup/review locks use the already-existing authentication Postgres connection; all project records and evidence remain in Airtable. Confirmed lock support with a read-only diagnostic. Writers outside Bridge do not automatically share these safeguards.
- Browser verified My Projects and empty available-project tab on the actual Bridge development server at localhost:3003. Port 3000 currently serves another app. Signed-in session is a volunteer; director UI and nonempty end-to-end live workflow have not been exercised with real records.
- At the end of this first slice, remaining work included native activity creation/publishing, external-board handoff, proposals, metrics/member lookup, email/AMA workflows, design references/top bar, certificate requests, and Supabase/Oppia retirement.

## Second implementation — October 2, 2026
- Added 12 more Airtable fields for project categories/guides/creator, center country, and proposal details. All 51 new fields were created additively and re-verified; no existing record values were changed.
- `/create-activity`: director-only, native activity creation with reusable Letters, Care Kits, School Kits, Service Day, and Center Wish templates. New activities are created as `Submitted` and still require the existing activity-review approval before they can appear to volunteers.
- `/projects/propose`: volunteer proposal form with organization/adult contact, need, estimated cost, and target date. Proposals explicitly do not authorize spending, organization contact on Omelora's behalf, or impact credit.
- `/insights`: director-only live impact totals and member lookup. Active volunteers are calculated from Approved Hours completed in the trailing six months; only verified completed new-model projects count toward the 1,000-project goal.
- Home now displays individual Education Action project counts, next deadlines, and next steps alongside the existing hours/activity summary.
- Tightened activity publishing and cross-volunteer hours lookup to exact Executive Director / Track Director roles.
- Added proposal idempotency, validation, and director-decision regression tests. Verified TypeScript, ESLint, 15 project-workflow tests, 19 hours-workflow tests, and whitespace checks.
- `/project-reviews` now includes proposed projects, shows the contact/need/cost/timeline, and lets a director approve a concept for planning or decline it. A decision does not create a claim, award hours, approve spending, publish an activity, or count impact.
- Visually verified the updated dashboard and proposal form on the local Bridge development server. The signed-in Google identity maps to a Volunteer record (`kyraezikeuzor@gmail.com`), while the Executive Director record uses `kyra@omelora.org`; director-only pages correctly refuse the volunteer identity.
- Remaining work includes the director letter-mailing queue, activity-board handoff, emails/AMA automation, top-bar/search/notifications redesign, certificate requests, and Supabase/Oppia retirement.
