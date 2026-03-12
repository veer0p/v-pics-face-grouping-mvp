# V Pics UX Roadmap (Immich-First)

This document is the single source of truth for page-wise UX quality work.

## Global standards
- Loading: use a visible spinner/skeleton with page context text.
- Empty: explain why content is empty and provide one primary next action.
- Error: show actionable message + retry button.
- Disabled actions: explain why with label/tooltip/helper copy.
- Mobile: minimum 40px tap targets and clear action spacing.

## /login
- Objective: fast and low-friction PIN access.
- Friction: unclear biometric behavior, weak mode guidance.
- Changes: disabled biometric button with explicit status, clearer unlock vs sign-in flow labels.
- Acceptance: user can identify available auth path in under 3 seconds; no dead-end button.

## /
- Objective: timeline browsing and multi-select actions.
- Friction: fetch errors were opaque; delete intent wording unclear.
- Changes: clearer fetch error text + retry action; delete confirmation changed to trash language.
- Acceptance: failed fetch state always has retry; delete action explicitly says Trash.

## /photo/[id]
- Objective: immersive viewer with metadata and comments.
- Friction: comment identity was text-only; avatar failures could show broken images.
- Changes: comment rows now use fallback-safe avatar component; better visual author identity.
- Acceptance: comments always show avatar or initials; no broken image icon.

## /photo/[id]/faces
- Objective: assign faces quickly with low confusion.
- Friction: multi-step flow can be missed.
- Changes: keep contextual hint copy and explicit save/assign callouts; preserve current helper text.
- Acceptance: user can complete "draw box -> pick person -> save" without leaving page.

## /people
- Objective: scan and manage person clusters.
- Friction: person operations are dense on mobile.
- Changes: maintain explicit labels, preview-first cards, and assignment feedback; continue reducing ID-heavy language.
- Acceptance: users can rename/merge/assign without needing raw IDs.

## /search
- Objective: fast discovery across media and people.
- Friction: failed search had no direct recovery action.
- Changes: search error panel now includes Retry Search.
- Acceptance: any failed query can be retried in one tap.

## /upload
- Objective: fast bulk ingest confidence.
- Friction: "processing" state did not explain disabled controls.
- Changes: processing helper text now explains queueing wait behavior.
- Acceptance: while disabled, user knows why actions are blocked.

## /albums
- Objective: create and open albums quickly.
- Friction: create CTA text was generic.
- Changes: "Create" renamed to "Create Album", with busy-state tooltip.
- Acceptance: CTA intent is explicit and unambiguous.

## /albums/[id]
- Objective: manage album contents safely.
- Friction: errors had no recovery action; empty state had no next step.
- Changes: retry action in error state; empty state includes Back to Timeline CTA.
- Acceptance: user can recover from errors or navigate forward from empty state.

## /trash
- Objective: safe restore/permanent delete workflow.
- Friction: destructive button label was vague.
- Changes: "Delete Selected" renamed to "Delete Permanently"; error panel includes retry.
- Acceptance: destructive action is explicit and recoverable states have retry.

## /settings
- Objective: reliable profile/account controls.
- Friction: avatar handling could show broken images and inconsistent removal updates.
- Changes: Immich-first avatar flow hardened, client preprocess/crop/compress, shared fallback-safe avatar rendering, immediate remove fallback.
- Acceptance: upload/remove persists after refresh; missing avatar renders initials with no broken image icon.

## /memories
- Objective: communicate memories value clearly.
- Friction: page context was not explicit.
- Changes: added supporting description under title for expectations.
- Acceptance: first-time user understands what this page represents.

## /edit/[id]
- Objective: complete image edit and save copy workflow.
- Friction: crop/markup were placeholder-only.
- Changes: real asset preview, crop+rotate+aspect controls, markup with undo/redo, save-copy upload pipeline, non-image unsupported state.
- Acceptance: edited copy saves as new asset while original stays unchanged.

## Next pass (after current cycle)
- Standardize page-level skeleton components for all list/detail pages.
- Add shared "disabled reason" helper pattern for all destructive and async actions.
- Run mobile tap-target audit with screenshot checklist across all listed routes.
