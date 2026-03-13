# V Pics Product Recovery Plan

This document is the single source of truth for stabilizing, redesigning, and improving the product experience across Safari, performance, UI, and UX.

## Progress Tracker

Status: In progress

Completed on 2026-03-13:

1. Timeline boot changed from cache-first to network-first with cached fallback.
2. Browser storage reads and writes were hardened for safer Safari behavior.
3. Service worker route caching was restricted to static assets only.
4. Global animated background rendering was removed from the main shell.
5. Timeline video tiles were downgraded to a lighter behavior on coarse-pointer and reduced-motion devices.
6. Viewport and install metadata were cleaned up for better mobile behavior.
7. Global blur intensity was reduced to lower rendering cost.
8. Default light and dark theme tokens were reset to calmer photo-first defaults.
9. Shared surfaces were simplified across headers, nav, buttons, panels, cards, and overlays.
10. Mobile header hierarchy was restored with visible page title and cleaner account menu chrome.
11. Shared page-header, meta-card, and calmer section patterns were added and applied across the main route surfaces.
12. Timeline, albums, upload, trash, settings, search, people, face-tagging, login, memories, and photo viewer flows were reorganized for clearer hierarchy and action grouping.
13. All remaining direct browser storage access was moved onto safe helper wrappers.
14. Photo viewer controls were tightened with clearer context, drawer close actions, and safer storage boot behavior.

Next implementation slice:

1. Validate the current tranche on iPhone Safari and mobile Chrome with runtime traces.
2. Measure first-load, scroll, and interaction improvements on real devices.
3. Decide whether the immersive photo viewer needs a deeper second-pass redesign after device validation.

## 1. Purpose

The current app has three linked problems:

1. Reliability is weak on iPhone Safari and some users get stuck on loading after login.
2. Performance is too heavy for a photo app and the first-use experience feels slow and laggy.
3. The current visual language is not being received well by users and is hurting trust, clarity, and product quality perception.

This plan fixes the product in the right order:

1. Stop the product from feeling broken.
2. Make it feel fast and stable.
3. Redesign the UI so the media, not the decoration, becomes the hero.
4. Improve page-by-page UX flows so the app feels intentional and easy to use.

## 2. Scope

This plan covers:

1. iOS Safari stability.
2. Mobile performance and smoothness.
3. Visual redesign and theme correction.
4. UX improvements on all major pages.
5. Accessibility and mobile ergonomics.
6. Release criteria and validation steps.

This plan does not assume VPS architecture changes. The focus is the web app and shipped client behavior.

## 3. Inputs Behind This Plan

This plan is based on:

1. Recent user feedback that Safari keeps loading while Brave works.
2. User feedback that the app feels slow and laggy.
3. User feedback that the theme and visual style are not liked.
4. Code review findings across the app shell, timeline loading path, cache layer, service worker, theme system, and page interactions.

## 4. Product Recovery Goals

The product should feel:

1. Stable: login should always land users in a working timeline.
2. Fast: the first screen should appear quickly and scrolling should stay smooth.
3. Clear: actions, states, and labels should be obvious.
4. Trustworthy: the product should look premium, modern, and photo-first.
5. Mobile-native: interactions should feel natural on iPhone and Android.

## 5. Summary Report: What Is Ruining The Experience Today

### 5.1 Reliability problems

1. The timeline boot path depends on IndexedDB before the network fetch. If IndexedDB is slow, blocked, corrupted, or unavailable, the app can appear to load forever.
2. The service worker caches same-origin routes too aggressively, which increases the chance of stale HTML, stale redirects, stale shell state, and browser-specific bad cache behavior.
3. Web storage and browser state access are not hardened enough for Safari edge cases.

### 5.2 Performance problems

1. The feed performs too much work before users can simply browse photos.
2. Video tiles can trigger heavy work by pulling full video blobs into client cache.
3. The app keeps costly decorative backgrounds running on core pages.
4. Blur and glass effects are applied too broadly and are especially expensive on mobile Safari.
5. Some image and video object URL usage is not cleaned up properly, which can increase memory pressure over time.

### 5.3 UI problems

1. The visual direction feels gimmicky and inconsistent with a premium photo product.
2. The product overuses neon color, mono typography, glow, and novelty backgrounds.
3. The UI style competes with the photos instead of supporting them.
4. Some text and metadata have encoding issues, which makes the app feel less polished.

### 5.4 UX problems

1. Too many pages make users decode the UI instead of understanding it immediately.
2. Some actions are present but not explained enough when disabled, loading, or unavailable.
3. Error, empty, and loading states are inconsistent between pages.
4. The product lacks a clean hierarchy of primary action, secondary action, and supporting information.

## 6. UI Report Based On Core Design Principles

### 6.1 Principle: Content should be the hero

Current issue:
The interface pulls attention away from the photos with matrix effects, emoji backgrounds, glow, blur, and highly stylized color palettes.

Why this hurts:
In a photo app, users come for their media. When the chrome is louder than the content, the product feels less premium and harder to scan.

What to fix:
1. Remove decorative animated backgrounds from product pages.
2. Reduce strong accent usage to key actions only.
3. Move to quieter surfaces and let thumbnails, faces, and media carry the visual interest.

### 6.2 Principle: Visual hierarchy should be obvious

Current issue:
Headers, buttons, labels, cards, and utility controls often compete at the same visual weight.

Why this hurts:
Users should instantly know what the main action is. Right now the app often asks them to interpret too much.

What to fix:
1. Define one primary action per page.
2. Reduce secondary control prominence.
3. Standardize title, subtitle, content, and utility spacing.
4. Use stronger grouping for tools versus content versus metadata.

### 6.3 Principle: Consistency builds trust

Current issue:
The app mixes multiple personalities: matrix, cyber, cute emoji, glass, mono type, soft pink, and neon green.

Why this hurts:
A product that changes personality by theme or page feels less coherent and less trustworthy.

What to fix:
1. Pick one clear visual direction.
2. Use one main type system for UI and one optional display accent for headlines only.
3. Standardize button shape, card shape, icon size, form fields, and spacing rhythm.

### 6.4 Principle: Interaction cost should be low

Current issue:
Some flows require too much interpretation, especially around faces, people management, and media actions.

Why this hurts:
Users should not have to learn the UI just to manage photos or faces.

What to fix:
1. Turn multi-step flows into guided sequences.
2. Show the next step clearly after each action.
3. Replace system-centric language with user-centric language.

### 6.5 Principle: Motion should support meaning

Current issue:
Motion is being used as ambient decoration instead of as feedback or transition support.

Why this hurts:
Decorative motion consumes performance budget without improving usability.

What to fix:
1. Remove ambient animation from core browsing surfaces.
2. Keep motion only for feedback, transitions, and state changes.
3. Respect reduced-motion preferences.

### 6.6 Principle: Mobile ergonomics matter

Current issue:
The product has high rendering cost and too many dense controls competing on mobile screens.

Why this hurts:
A mobile-first photo product must feel easy to tap, scroll, and understand with one hand.

What to fix:
1. Increase spacing around dense control clusters.
2. Make destructive actions visually separate from safe actions.
3. Ensure tap targets and bottom nav behavior stay reliable on small screens.

### 6.7 Principle: Accessibility is product quality

Current issue:
The app disables pinch zoom, relies heavily on color styling, and has some contrast and state clarity concerns.

Why this hurts:
Accessibility failures are usability failures. They also damage perceived quality.

What to fix:
1. Re-enable user scaling.
2. Improve contrast and reduce visual noise.
3. Use explicit labels and helper text rather than color alone.
4. Ensure loading, success, error, and disabled states are readable.

## 7. Strategic Direction

The app should move to a photo-first design system with these characteristics:

1. Neutral base surfaces.
2. One restrained accent system.
3. High legibility.
4. Minimal motion.
5. Sharp hierarchy.
6. Fast interactions.
7. Clear action language.

This means:

1. No matrix rain on core pages.
2. No emoji particle backgrounds on core pages.
3. No neon-heavy default experience.
4. No decorative blur stack unless it has a functional reason.

## 8. Phased Execution Plan

## Phase 0: Baseline, Instrumentation, and Reproduction

Goal:
Remove guesswork and measure the problem before changing behavior.

Detailed steps:

1. Add basic performance timing around app bootstrap, auth resolution, timeline fetch start, timeline fetch success, first grid paint, and first interaction readiness.
2. Add error logging around IndexedDB open, IndexedDB read timeout, service worker state, and storage access failures.
3. Reproduce Safari issue on a real iPhone using remote Web Inspector.
4. Confirm whether the stuck state happens before `/api/auth/me`, before `/api/photos`, or after both.
5. Check whether Safari is serving a stale route or stale shell from the service worker.
6. Record baseline mobile metrics on at least one iPhone and one Android device:
   - time to login redirect
   - time to first photo grid
   - time to first interaction
   - scroll smoothness
   - memory pressure symptoms

Acceptance criteria:

1. We can reliably reproduce the issue or prove the current root cause with logs.
2. We have a baseline before performance and UI work starts.

## Phase 1: Safari Stability and Boot Reliability

Goal:
Make login-to-timeline reliable on iPhone Safari.

Detailed steps:

1. Remove blocking cache reads from the initial timeline boot path.
2. Make the first page request network-first and treat IndexedDB as optional.
3. Add a hard timeout for cache open and cache read operations.
4. If cache fails, continue rendering with network data and log the failure.
5. Stop the service worker from caching route HTML and dynamic app shell responses.
6. Keep service worker caching limited to safe static assets only, or disable it temporarily until a versioned strategy exists.
7. Wrap all `localStorage`, `sessionStorage`, and browser storage access in safe helpers with try/catch.
8. Add a visible recovery path if local cache/bootstrap fails:
   - reset local cache
   - retry
   - continue without offline cache
9. Remove any boot-time dependency that is not required for the first content render.
10. Re-enable pinch zoom in viewport settings.

Acceptance criteria:

1. Safari login reaches a working timeline consistently.
2. The app does not remain stuck on a loading screen because of cache state.
3. Clearing site data is no longer required as a normal recovery path.

## Phase 2: Performance Recovery

Goal:
Make the app feel fast and smooth on mobile.

Detailed steps:

1. Remove autoplay video behavior from gallery tiles on mobile.
2. Replace grid video playback with poster thumbnails or lightweight previews.
3. Stream full video only on the detail page where the user has shown intent.
4. Rework client caching strategy:
   - stop caching large video blobs in IndexedDB from the feed
   - reduce cache quotas
   - clean up blob URLs properly
   - avoid blob URL indirection for normal thumbnails when browser cache is enough
5. Defer non-critical work until after first content render.
6. Replace repeated heavy polling after uploads with a narrower refresh strategy.
7. Reduce console noise in production paths.
8. Audit expensive CSS:
   - reduce large blur radii
   - remove unnecessary backdrop-filter usage
   - simplify layered shadows and glow
9. Remove animated canvas backgrounds from all main product pages.
10. Only keep lightweight motion where it communicates state change.
11. Add skeletons and progressive loading so the app feels responsive while data is loading.
12. Audit image sizing and responsive delivery to avoid waste on mobile.

Acceptance criteria:

1. First timeline render feels materially faster on mobile.
2. Scrolling the grid remains smooth on iPhone.
3. CPU, memory, and bandwidth usage are lower during basic browsing.

## Phase 3: Design System Reset

Goal:
Replace the current novelty-heavy theme with a coherent, premium, photo-first UI system.

Detailed steps:

1. Define the new visual direction in words before changing code:
   - calm
   - modern
   - premium
   - photo-first
   - mobile-native
2. Replace current theme personalities with one primary system:
   - neutral background scale
   - strong readable foreground scale
   - restrained accent color
   - subtle dividers
3. Define typography roles:
   - display for rare editorial moments
   - UI font for navigation, actions, metadata
   - no mono as the default interface font
4. Define a spacing system that establishes clear hierarchy across all cards, headers, lists, and panels.
5. Standardize:
   - border radius scale
   - elevation scale
   - stroke/icon weights
   - primary, secondary, tertiary button styles
   - form field style
   - chips/tabs style
6. Remove encoding errors and inconsistent text artifacts.
7. Align metadata, manifest, share titles, and install surfaces with the new brand direction.
8. Update light and dark mode so they feel like the same product, not two different personalities.

Acceptance criteria:

1. The app looks cohesive in both light and dark modes.
2. Photos feel like the main visual element.
3. The interface no longer feels gimmicky or distracting.

## Phase 4: UX Standardization Across Core Flows

Goal:
Make the app easier to learn, browse, and act within.

Detailed steps:

1. Standardize loading states across all pages.
2. Standardize empty states:
   - explain why the page is empty
   - give one clear next action
3. Standardize error states:
   - plain language
   - retry action
   - no vague failure text
4. Standardize disabled states:
   - if something cannot be tapped, explain why
5. Standardize confirmation patterns:
   - use clear destructive wording
   - show consequence and recovery
6. Standardize navigation behavior so every page has obvious exit and return paths.
7. Reduce UI density in face and people management flows.
8. Improve action naming so labels match user goals, not internal system language.

Acceptance criteria:

1. The product is easier to scan and learn.
2. Fewer states feel confusing or dead-ended.
3. Major actions are obvious within a few seconds of opening a page.

## Phase 5: Page-Wise UX and UI Enhancement Plan

### 5.1 `/login`

Objective:
Fast, calm, trustworthy access.

Problems:

1. The page currently inherits too much personality from the global theme.
2. It does not feel premium enough for the product entry point.
3. The auth modes are still not as crisp as they should be.

Improvement steps:

1. Make the login screen visually simpler than the rest of the app.
2. Use one hero message, one primary auth action, and one secondary path.
3. Make PIN entry the obvious default action.
4. Use clearer copy for remembered user versus switch user behavior.
5. Show validation and auth errors inline, not as vague failure feedback.
6. Remove decorative background motion from login.

Acceptance criteria:

1. A returning user can understand how to unlock in under three seconds.
2. A first-time user can understand sign-in versus sign-up immediately.

### 5.2 `/`

Objective:
Fast timeline browsing with minimal friction.

Problems:

1. The page is doing too much work before it becomes useful.
2. Visual chrome competes with the grid.
3. Multi-select and action hierarchy can still be improved.

Improvement steps:

1. Make the first screen prioritize photo thumbnails over chrome.
2. Reduce header visual noise.
3. Keep primary actions limited and obvious.
4. Improve loading skeletons to match the final grid.
5. Show explicit fetch failure recovery.
6. Rework selection mode so its state and actions are unmistakable.
7. Make favorites filter state more legible.

Acceptance criteria:

1. The timeline feels immediate and calm.
2. Users always know whether they are browsing or acting on a selection.

### 5.3 `/photo/[id]`

Objective:
Immersive media viewing with confident actions.

Problems:

1. Viewer controls and metadata compete for attention.
2. The experience can feel more technical than emotional.
3. Some gestures and viewer controls may be too aggressive for mobile browsing comfort.

Improvement steps:

1. Keep the media dominant and simplify surrounding controls.
2. Group viewer actions into a cleaner bottom or floating action area.
3. Reduce metadata clutter on initial open.
4. Move secondary details behind an expandable section when needed.
5. Ensure comments, likes, edit, trash, and face actions have clear priority.
6. Revisit iOS gesture behavior so it does not fight the platform.

Acceptance criteria:

1. The viewer feels immersive and easy to control.
2. Users can act on a photo without scanning a crowded interface.

### 5.4 `/photo/[id]/faces`

Objective:
Assign, rename, merge, and manage faces without confusion.

Problems:

1. This is one of the most cognitively demanding areas of the app.
2. Users should not have to infer the face-management model.
3. Manual add, assign, rename, merge, and remove need cleaner flow structure.

Improvement steps:

1. Split the page into clear sections:
   - detected faces on this photo
   - manual selection area
   - selected person details
   - unassigned faces inbox
2. Use preview-first design, not ID-first design.
3. Show person thumbnails, names, and counts in the picker.
4. Rename unknown people to placeholder names like `Person 1`, `Person 2`.
5. Expose rename directly where users already manage the person.
6. Add explicit explanations for:
   - assign to existing person
   - create a new person from a manual face
   - remove wrong detection
7. When a user draws a manual face on a new person, make the next step explicit:
   - create person
   - assign this face
   - show confirmation
8. Make destructive face removal separate from save and merge actions.
9. Add success feedback after each face action.

Acceptance criteria:

1. A user can complete face assignment without guessing the next step.
2. Face management uses names and previews, not system identifiers.

### 5.5 `/people`

Objective:
Browse people clusters and manage identities clearly.

Problems:

1. Dense controls and management actions can feel intimidating.
2. Person cards need better hierarchy.

Improvement steps:

1. Make person cards more visual and less control-heavy.
2. Show name, representative face, asset count, and last activity clearly.
3. Keep rename and merge available, but not visually loud by default.
4. Separate quick browsing from management mode if needed.
5. Improve loading and empty states for new libraries with few detected people.

Acceptance criteria:

1. People browsing feels simple.
2. Management actions are discoverable without overwhelming the page.

### 5.6 `/search`

Objective:
Fast discovery with clear intent and result quality.

Problems:

1. Search quality and capability are not always obvious to users.
2. Results need better empty and fallback messaging.

Improvement steps:

1. Clarify what search can do:
   - people
   - metadata
   - semantic content
2. Make the search bar the visual focus.
3. Improve empty-state suggestions with example queries.
4. Differentiate no results from search unavailable from search failed.
5. Keep result cards visually aligned with timeline cards.

Acceptance criteria:

1. Users understand what kinds of searches are supported.
2. Failed or empty searches still guide the next action.

### 5.7 `/upload`

Objective:
Confident bulk upload with minimal anxiety.

Problems:

1. Upload is one of the most trust-sensitive flows in a photo product.
2. Users need confidence that their files are safe and progressing.

Improvement steps:

1. Make upload status more visual and easier to scan.
2. Group pending, active, failed, and completed items clearly.
3. Show exactly what is happening during processing and server import.
4. Improve duplicate and retry messaging.
5. Keep the primary next action obvious after upload completes.

Acceptance criteria:

1. Users understand the state of every upload batch.
2. Failure recovery is obvious.

### 5.8 `/albums`

Objective:
Create and browse albums easily.

Problems:

1. Album creation should feel more intentional.
2. Empty state needs stronger guidance.

Improvement steps:

1. Make the create action unambiguous.
2. Improve the information scent for what albums are for.
3. Show richer album cards with count, recent cover, and updated time.
4. Make empty-state guidance action-oriented.

Acceptance criteria:

1. Users can create and open albums without hesitation.

### 5.9 `/albums/[id]`

Objective:
Manage album contents with confidence.

Problems:

1. The page needs stronger state handling and clearer action grouping.

Improvement steps:

1. Separate album metadata from album actions.
2. Make add/remove actions obvious and safe.
3. Improve empty-state, error, and recovery flows.
4. Reduce ambiguity around what action affects the album versus the underlying media.

Acceptance criteria:

1. Users do not confuse album actions with destructive media actions.

### 5.10 `/trash`

Objective:
Safe restore and permanent delete flow.

Problems:

1. Trash is a high-risk area and must be extremely explicit.
2. The UI should feel safe before it feels fast.

Improvement steps:

1. Make restore the safest and most visible recovery action.
2. Make permanent delete visually distinct and clearly irreversible.
3. Use explicit confirmation language.
4. Improve bulk selection clarity.
5. Improve empty-state explanation of retention behavior if applicable.

Acceptance criteria:

1. Users can clearly tell restore from permanent delete.

### 5.11 `/settings`

Objective:
Reliable account and preferences management.

Problems:

1. Settings must feel dependable, not fragile.
2. Avatar behavior must be fully trustworthy.

Improvement steps:

1. Keep avatar rendering fallback-safe everywhere.
2. Ensure upload, replace, and remove update the UI immediately.
3. Group profile, preferences, storage/cache, and session controls into clear sections.
4. Add clear copy for cache reset and troubleshooting actions when needed.
5. Reduce visual clutter and improve information architecture.

Acceptance criteria:

1. Avatar behavior feels reliable.
2. Settings is easy to scan and easy to trust.

### 5.12 `/memories`

Objective:
Make memories feel valuable, not placeholder-like.

Problems:

1. The page currently risks feeling thin compared with the rest of the app.

Improvement steps:

1. Give the page a stronger narrative structure.
2. Improve explanation of what memories represent.
3. Design empty and low-content states more intentionally.
4. Make memory cards more emotional and less system-like.

Acceptance criteria:

1. The page feels purposeful even with limited content.

### 5.13 `/edit/[id]`

Objective:
Deliver a clean, modern, trustworthy edit-save-copy experience.

Problems:

1. Editing is a high-expectation flow and must feel polished.
2. Controls and preview area should feel precise and responsive.

Improvement steps:

1. Simplify tool grouping across adjust, crop, filter, and markup.
2. Improve tool affordances and active-state clarity.
3. Make save-copy behavior and outcome obvious.
4. Show progress clearly when rendering and uploading the edited copy.
5. Use stronger unsupported-state messaging for non-image assets.

Acceptance criteria:

1. Editing feels focused and modern.
2. Users understand they are creating a copy, not overwriting the original.

## 9. Detailed UI Redesign Workstreams

### 9.1 Color

1. Replace neon-heavy defaults with a restrained neutral palette.
2. Reserve accent color for selection, active states, and primary actions.
3. Keep error, warning, success, and info colors conventional and readable.
4. Validate all text contrast levels in light and dark themes.

### 9.2 Typography

1. Stop using monospace as the default UI typeface.
2. Use one highly readable UI font for labels, metadata, buttons, and forms.
3. Keep display typography rare and intentional.
4. Define a clear text scale for title, subtitle, section label, body, helper, and metadata text.

### 9.3 Surfaces

1. Reduce glass and blur.
2. Use solid or lightly translucent surfaces for reliability and performance.
3. Give cards a clearer border and spacing system rather than relying on glow.

### 9.4 Buttons and controls

1. Define primary, secondary, tertiary, ghost, and destructive variants.
2. Standardize icon-only button sizing and hit area.
3. Keep disabled states explanatory.
4. Make loading states visible but non-disruptive.

### 9.5 Motion

1. Remove decorative infinite animation from browsing pages.
2. Use subtle transition motion for overlays, drawers, selection changes, and confirmation feedback.
3. Respect reduced-motion preferences everywhere.

## 10. UX Improvement Standards

Every page and component should follow these rules:

1. One primary action per view.
2. One clear explanation when content is missing.
3. One clear recovery action when something fails.
4. No dead buttons.
5. No decorative motion that costs more than it helps.
6. No destructive action without explicit wording.
7. No system identifiers shown where previews and names are possible.
8. No page should require users to guess the next step.

## 11. Release Plan

### Release 1: Stability hotfix

Includes:

1. Network-first boot.
2. Safe storage wrappers.
3. Service worker route cache removal.
4. Safari recovery paths.
5. Viewport accessibility fix.

### Release 2: Performance recovery

Includes:

1. Video tile behavior changes.
2. Cache cleanup.
3. Animated background removal.
4. CSS rendering-cost reduction.
5. Lighter first render path.

### Release 3: Visual redesign

Includes:

1. New theme system.
2. New typography and color system.
3. New surface and button hierarchy.
4. Global page chrome cleanup.

### Release 4: Page-by-page UX refactor

Includes:

1. Timeline refinement.
2. Viewer refinement.
3. Faces and people UX cleanup.
4. Search, upload, albums, trash, settings, memories polish.

## 12. Validation And QA Plan

### Device matrix

Test on:

1. iPhone Safari.
2. iPhone Chrome or Brave.
3. Android Chrome.
4. Desktop Safari if available.
5. Desktop Chrome.

### Scenario matrix

Test:

1. first login
2. returning login
3. cold boot
4. warm boot
5. timeline scroll
6. video thumbnail browse
7. photo open
8. face assignment
9. search
10. upload
11. album create and edit
12. trash restore and permanent delete
13. avatar upload and remove

### Acceptance gates

Do not ship the redesign until:

1. Safari issue is verified fixed.
2. Timeline feels faster on mobile than the current baseline.
3. Main task flows pass smoke and manual QA.
4. The new visual system is coherent across all main pages.

## 13. Priority Order

The correct order is:

1. Stability.
2. Performance.
3. Visual system.
4. Page-by-page UX refinement.
5. Final polish and rollout.

No additional feature work should outrank these fixes until the product feels stable and credible.

## 14. Immediate Next Build Plan

The next implementation cycle should focus only on:

1. Remove blocking IndexedDB boot dependencies.
2. Restrict or disable problematic service worker caching.
3. Remove animated backgrounds from core pages.
4. Stop heavy video behavior in the feed.
5. Reduce blur and glass rendering cost.
6. Establish the new base theme tokens and typography direction.

Once that is stable, continue with page-wise UX/UI refactor using the standards in this document.
