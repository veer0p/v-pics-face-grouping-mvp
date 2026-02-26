# 📸 Photo PWA — Wireframe & Design Prompt
### Google Photos-Inspired · Minimal Touch · Modern 2025 UI

---

## DESIGN PHILOSOPHY

> **Core principle: Every meaningful action should require no more than 1–2 taps.**
> The UI should be invisible — users see their photos, not the interface.

Inspired by:
- Google Photos' masonry/justified grid and virtual scroll
- Apple's "Liquid Glass" depth and translucency
- Material You's adaptive, content-first layouts
- 2025 trend: "Exaggerated minimalism" — generous whitespace + sharp purposeful accents
- Gesture-first navigation: swipe, pinch, long-press replace buttons wherever possible

Design Character:
- **Palette**: Near-white background (#F9F9F9 light / #0D0D0D dark), deep neutral text, single electric accent (vivid indigo #5B4EFF or warm amber #FF9A3C — pick one, use sparingly)
- **Typography**: Display: "Instrument Serif" or "Fraunces" for headings; UI: "DM Sans" or "Geist" for labels; never Inter, never Roboto
- **Depth**: Frosted glassmorphism for overlays, bottom sheets, and floating toolbars — translucent blur panels, not solid cards
- **Motion**: 60fps physics-based gestures; fade-scale for panels (200ms); spring for photo open (350ms); no decorative animations
- **Corners**: 16px radius on cards; 24px on sheets; fully pill-shaped on small chips

---

## PWA REQUIREMENTS (Always-on)

- Installable (manifest.json + service worker)
- Works offline for already-loaded photos (cached thumbnails)
- Full-screen mode when installed (no browser chrome)
- Adaptive icon + splash screen
- Bottom safe-area padding (iPhone notch, Android gesture bar)
- Touch targets minimum 44×44px everywhere
- Dark mode: follows system setting; auto-switches

---

## PAGE INVENTORY

| # | Page | Route | Core Job |
|---|------|--------|----------|
| 1 | Home / Photos Grid | `/` | Browse all photos by date |
| 2 | Photo Viewer | `/photo/:id` | View, swipe, quick-edit |
| 3 | Albums | `/albums` | Browse collections |
| 4 | Album Detail | `/albums/:id` | View photos in an album |
| 5 | Search | `/search` | Find photos by AI/text/date |
| 6 | Memories | `/memories` | Auto-generated highlight reels |
| 7 | Upload / Import | `/upload` | Add new photos |
| 8 | Editor | `/edit/:id` | Adjust, crop, filter |
| 9 | Share Sheet | (bottom sheet overlay) | Share photo/album |
| 10 | Settings | `/settings` | Account, storage, preferences |
| 11 | Onboarding | `/welcome` | First-run setup |

---

## GLOBAL SHELL

```
┌──────────────────────────────────────────┐
│  HEADER (hidden on scroll down, reappears │
│          on scroll up — auto-hides)       │
│                                           │
│  [Search bar — full width, frosted glass] │
│  Placeholder: "Search your photos…"       │
│  Right: [Avatar pill]                     │
└──────────────────────────────────────────┘

│                                           │
│         PAGE CONTENT AREA                │
│         (full bleed, edge to edge)        │
│                                           │

┌──────────────────────────────────────────┐
│  BOTTOM NAVIGATION (fixed, frosted glass) │
│                                           │
│  [Photos]  [Search]  [Albums]  [Memories] │
│   house     search    grid      sparkle   │
│  Active: accent color icon + label bold   │
└──────────────────────────────────────────┘
```

**Header behavior**: Transparent over photos grid; gains frosted background when user scrolls. Never overlaps actionable content.

**Bottom nav**: Frosted glass (backdrop-blur 20px, bg opacity 70%). 5 tabs max. No floating action button. Active state: icon fills solid, label bold, tiny accent dot above icon.

---

## PAGE 1 — HOME / PHOTOS GRID

**Route:** `/`
**Job:** Show all photos, newest first. Let users scroll years of memories with zero friction.

```
┌──────────────────────────────────────────┐
│  🔍  Search your photos…          [👤]   │  ← Auto-hiding header
├──────────────────────────────────────────┤
│                                           │
│  TODAY                          June 12  │  ← Date section header (sticky while in view)
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │        │ │        │ │        │        │  ← 3-column justified grid
│  │  photo │ │  photo │ │  photo │        │     Row height: ~120px mobile
│  │        │ │        │ │        │        │     Photo fills cell, object-fit: cover
│  └────────┘ └────────┘ └────────┘        │
│  ┌─────────────────────┐ ┌──────┐        │
│  │                     │ │      │        │  ← Variable: wider photo gets 2/3 width
│  │      wide photo     │ │      │        │
│  └─────────────────────┘ └──────┘        │
│                                           │
│  YESTERDAY                      June 11  │
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │        │ │        │ │        │        │
│  └────────┘ └────────┘ └────────┘        │
│                                           │
│  JUNE 2025                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │  ← 4 columns for older months
│  │      │ │      │ │      │ │      │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                           │
└──────────────────────────────────────────┘
│ [Photos]  [Search]  [Albums]  [Memories]  │
└──────────────────────────────────────────┘
```

**Key interactions:**
- **Tap photo** → opens Photo Viewer with shared element transition (photo scales/flies to fullscreen)
- **Long-press photo** → enters multi-select mode; photo gets checkmark; toolbar slides up from bottom
- **Pinch out on grid** → zooms to 2-column view (larger thumbnails)
- **Pinch in on grid** → zooms to 5-column view (compact overview)
- **Scrub the right-edge scrollbar** → year/month fast-jump indicator floats on left
- **Pull down to refresh** → syncs new photos
- **Multi-select toolbar** (slides up, frosted glass):
  `[Share]  [Add to Album]  [Download]  [Delete]`

**Section headers:**
- "Today", "Yesterday", then "Month Year" for older
- Sticky during their section, fade out as next section enters
- Right side: photo count for that day (small, muted)

---

## PAGE 2 — PHOTO VIEWER

**Route:** `/photo/:id`
**Job:** Immersive photo view. All chrome hides. One photo fills the screen.

```
┌──────────────────────────────────────────┐
│                                           │
│              [← Back]        [ ⋮ More]   │  ← Auto-hides after 2s; tap to reveal
│                                           │
│                                           │
│                                           │
│           ████████████████               │
│           █                █             │
│           █    PHOTO       █             │  ← Photo fills full screen, pinch to zoom
│           █                █             │
│           ████████████████               │
│                                           │
│                                           │
│  June 12, 2025 · 3:42 PM                 │  ← Fades in/out with chrome
│                                           │
│ ┌──────────────────────────────────────┐ │
│ │  [❤️ Like]  [✏️ Edit]  [⬆️ Share]  [🗑️]│ │  ← Bottom action bar, frosted glass
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Key interactions:**
- **Swipe left/right** → previous/next photo (no buttons needed)
- **Swipe down** → close viewer, photo flies back to grid position
- **Double tap** → zoom to 2× on tap point
- **Pinch** → free zoom up to 5×
- **Tap anywhere (no button)** → toggle chrome show/hide
- **Long-press photo** → context menu: "Copy", "Set as wallpaper", "Info", "Share"
- **Swipe up** → reveals photo details panel (location map, EXIF data, people tags)

**Detail panel (swipe up):**
```
┌──────────────────────────────────────────┐
│  ── (drag handle)                         │
│                                           │
│  📍 Ahmedabad, Gujarat                    │
│  [mini map view]                          │
│                                           │
│  📷 Shot on iPhone 16 · f/1.8 · 1/120s   │
│  📐 4032 × 3024 · 3.2 MB                 │
│                                           │
│  👤 People detected: [face] [face]        │
│                                           │
└──────────────────────────────────────────┘
```

---

## PAGE 3 — ALBUMS

**Route:** `/albums`
**Job:** Browse all albums (user-created + auto-generated). Quick visual scan.

```
┌──────────────────────────────────────────┐
│  🔍  Search your photos…          [👤]   │
├──────────────────────────────────────────┤
│                                           │
│  Favorites                               │
│  ┌──────────────────────┐                │
│  │ ████  ████  ████ →   │  ← Horizontal  │
│  │ cover photos scroll  │    scroll row  │
│  └──────────────────────┘                │
│                                           │
│  Your Albums                             │
│  ┌──────────┐  ┌──────────┐             │
│  │          │  │          │             │  ← 2-column grid
│  │  cover   │  │  cover   │             │     Square aspect ratio
│  │          │  │          │             │     Album name below
│  └──────────┘  └──────────┘             │
│  Trip to Goa     Birthday 2024           │
│  48 photos       23 photos               │
│                                           │
│  ┌──────────┐  ┌──────────┐             │
│  │          │  │          │             │
│  └──────────┘  └──────────┘             │
│  Family          Work                    │
│                                           │
│              [ + New Album ]             │  ← Centered, pill button, accent color
│                                           │
└──────────────────────────────────────────┘
│ [Photos]  [Search]  [Albums]  [Memories]  │
└──────────────────────────────────────────┘
```

**Key interactions:**
- **Tap album** → Album Detail page
- **Long-press album** → context: "Rename", "Share", "Delete", "Add Cover"
- **\+ New Album** → inline bottom sheet: type name → done → immediately enter album

---

## PAGE 4 — ALBUM DETAIL

**Route:** `/albums/:id`
**Job:** View all photos in an album. Same grid as Home but scoped.

```
┌──────────────────────────────────────────┐
│  [←]  Trip to Goa               [ ⋮ ]   │
│        48 photos · Dec 2024              │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────────────────────────┐    │
│  │         Cover photo              │    │  ← Large hero, 16:9, tappable
│  └──────────────────────────────────┘    │
│                                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │      │ │      │ │      │ │      │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │      │ │      │ │      │ │      │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                           │
└──────────────────────────────────────────┘
│             [+ Add Photos]                │  ← Floating pill, above bottom nav
└──────────────────────────────────────────┘
│ [Photos]  [Search]  [Albums]  [Memories]  │
└──────────────────────────────────────────┘
```

**⋮ More menu (bottom sheet):**
`Edit Album Title` · `Change Cover` · `Share Album` · `Slideshow` · `Delete Album`

---

## PAGE 5 — SEARCH

**Route:** `/search`
**Job:** Find any photo instantly. AI-powered: search by face, place, object, text, date.

```
┌──────────────────────────────────────────┐
│  ← [  🔍  Search photos…            × ]  │  ← Full-width, focused on enter
├──────────────────────────────────────────┤
│                                           │
│  PEOPLE                                  │
│  ○ ○ ○ ○ ○ ○  →                          │  ← Face bubbles, horizontal scroll
│  Rahul  Priya  Mom  Dad                   │
│                                           │
│  PLACES                                  │
│  [Ahmedabad] [Mumbai] [Goa] [Delhi] →     │  ← Location chips
│                                           │
│  THINGS                                  │
│  [🍕 Food] [🌅 Sunsets] [🐾 Pets] →       │  ← Auto-detected category chips
│                                           │
│  YEARS                                   │
│  [2025]  [2024]  [2023]  [2022]  [2021]  │
│                                           │
│  RECENT SEARCHES                         │
│  🕐 "beach photos"                        │
│  🕐 "birthday"                            │
│  🕐 December 2024                         │
│                                           │
└──────────────────────────────────────────┘

        — After typing / tapping chip —

┌──────────────────────────────────────────┐
│  ← [  🔍  "Goa"                      × ] │
├──────────────────────────────────────────┤
│                                           │
│  47 results for "Goa"                    │
│                                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │  ← Same justified grid
│  │      │ │      │ │      │ │      │    │
│  └──────┘ └──────┘ └──────┘ └──────┘    │
│                                           │
└──────────────────────────────────────────┘
```

---

## PAGE 6 — MEMORIES

**Route:** `/memories`
**Job:** Auto-curated highlights. Emotional, cinematic, zero effort from user.

```
┌──────────────────────────────────────────┐
│  Memories                                │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────────────────────────┐    │
│  │  ▶                               │    │  ← Large featured memory card
│  │                                  │    │     Full-width, 9:16 aspect
│  │                                  │    │     Plays as short video/slideshow
│  │  "3 years ago in Goa"            │    │
│  │  Dec 2022 · 12 photos    [Play]  │    │
│  └──────────────────────────────────┘    │
│                                           │
│  FOR YOU TODAY                           │
│  ┌──────────┐  ┌──────────┐             │
│  │    ▶     │  │    ▶     │             │  ← 2-column memory cards
│  │          │  │          │             │
│  │"Birthday" │  │ "Sunsets"│             │
│  │ 2 yrs ago │  │ last yr  │             │
│  └──────────┘  └──────────┘             │
│                                           │
│  THIS MONTH IN PAST YEARS               │
│  ┌──────────┐  ┌──────────┐             │
│  └──────────┘  └──────────┘             │
│                                           │
└──────────────────────────────────────────┘
│ [Photos]  [Search]  [Albums]  [Memories]  │
└──────────────────────────────────────────┘
```

**Memory Player (tapping a memory card):**
- Full-screen slideshow/video with music
- Swipe left/right: skip photo
- Swipe down: exit
- Bottom controls (auto-hide): `[❤️ Save]  [✏️ Edit]  [⬆️ Share]`
- "Edit memory" allows reordering photos, changing music, title

---

## PAGE 7 — UPLOAD / IMPORT

**Route:** `/upload`
**Job:** Get photos into the app. As fast as possible.

```
┌──────────────────────────────────────────┐
│  [←]  Add Photos                        │
├──────────────────────────────────────────┤
│                                           │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  │   📷  Tap to select photos       │    │  ← Large tap zone, full width
│  │       or drag & drop here        │    │     Opens file picker / camera
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                           │
│  OR IMPORT FROM                          │
│  ┌────────────┐  ┌────────────┐          │
│  │ 📁 Files   │  │ 📷 Camera  │          │
│  └────────────┘  └────────────┘          │
│  ┌────────────┐  ┌────────────┐          │
│  │ 🔗 URL     │  │ ☁️ Drive   │          │
│  └────────────┘  └────────────┘          │
│                                           │
│  — After selection —                      │
│                                           │
│  3 photos selected                        │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │  ✓   │ │  ✓   │ │  ✓   │  +          │
│  └──────┘ └──────┘ └──────┘              │
│                                           │
│  Add to album:  [None ▾]                 │
│                                           │
│          [ Upload 3 Photos ]             │  ← Accent color, full-width button
│                                           │
└──────────────────────────────────────────┘
```

**Upload progress (inline, no modal):**
- Thumbnail gets a radial progress ring
- Checkmark fades in on complete
- Error state: red border + retry icon

---

## PAGE 8 — EDITOR

**Route:** `/edit/:id`
**Job:** Quick adjustments. No Photoshop complexity. 1–2 taps for good results.

```
┌──────────────────────────────────────────┐
│  [×  Cancel]              [Save Copy ✓]  │
├──────────────────────────────────────────┤
│                                           │
│                                           │
│           ████████████████               │
│           █                █             │
│           █   LIVE PREVIEW █             │  ← Photo takes 65% of screen height
│           █                █             │     Updates in real-time as sliders move
│           ████████████████               │
│                                           │
├──────────────────────────────────────────┤
│  [Auto] [Crop] [Adjust] [Filter] [Markup] │  ← Tab row, no icons needed
├──────────────────────────────────────────┤
│                                           │
│  — ADJUST tab —                           │
│                                           │
│  Brightness        ───●───────            │
│  Contrast          ─────●─────            │
│  Saturation        ──────────●            │
│  Warmth            ────●──────            │
│  Sharpness         ──●────────            │
│                                           │
│  — FILTER tab —                           │
│                                           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │  ← Filter chips with mini preview
│  │    │ │    │ │    │ │    │ │    │     │
│  └────┘ └────┘ └────┘ └────┘ └────┘     │
│  None  Vivid  Warm   Cool   Fade         │
│                                           │
└──────────────────────────────────────────┘
```

**Auto button:** One tap → AI suggests best brightness/contrast/crop → shows before/after split view → user confirms or cancels.

---

## PAGE 9 — SHARE SHEET (Bottom Sheet Overlay)

**Not a page — a bottom sheet that slides up over any page.**

```
┌──────────────────────────────────────────┐
│  (main content dimmed behind)            │
├────────────────────────── ───────────────┤
│  ── (drag handle)                         │
│  Share                                   │
│                                           │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │  📱  │  │  📷  │  │  ✉️  │  │  💬  │ │  ← Contacts row
│  └──────┘  └──────┘  └──────┘  └──────┘ │
│  Priya     WhatsApp   Email    Message   │
│                                           │
│  ─────────────────────────────────────  │
│                                           │
│  🔗 Copy link                            │
│  📥 Save to device                       │
│  🖨️ Print                                │
│  ℹ️ Photo info                            │
│                                           │
│  ─────────────────────────────────────  │
│  [ Cancel ]                              │
└──────────────────────────────────────────┘
```

---

## PAGE 10 — SETTINGS

**Route:** `/settings`

```
┌──────────────────────────────────────────┐
│  [←]  Settings                          │
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────┐    │
│  │  👤  Rahul Patel                 │    │  ← Account card
│  │  rahul@email.com                 │    │
│  │  ████████░░░░  8.2 GB / 15 GB    │    │  ← Storage bar
│  └──────────────────────────────────┘    │
│                                           │
│  STORAGE & BACKUP                        │
│  Auto backup              ●──── ON       │
│  Backup over WiFi only    ●──── ON       │
│  Upload quality           Original  >    │
│                                           │
│  APPEARANCE                              │
│  Theme                    System   >     │
│  Grid density             3 cols   >     │
│                                           │
│  PRIVACY                                 │
│  Face recognition         ON      ●──── │
│  Location in photos       ON      ●──── │
│                                           │
│  ABOUT                                   │
│  App version              1.0.0          │
│  Privacy policy                    >     │
│                                           │
│  [ Sign Out ]                            │  ← Destructive, muted red, bottom
│                                           │
└──────────────────────────────────────────┘
```

---

## PAGE 11 — ONBOARDING

**Route:** `/welcome`
**Job:** One-time setup. Get to photos in under 30 seconds.

```
Screen 1 of 3:
┌──────────────────────────────────────────┐
│                                           │
│           [App Icon / Logo]              │
│                                           │
│     Your photos.                         │
│     Beautiful and private.               │
│                                           │
│  [Continue with Google]                  │  ← Primary button
│  [Continue with Apple]                   │
│  [Use without account]                   │  ← Ghost/text button
│                                           │
└──────────────────────────────────────────┘

Screen 2 of 3 (Permission):
┌──────────────────────────────────────────┐
│           [Illustration]                 │
│                                           │
│  Let us access your photos               │
│  We need permission to show your         │
│  existing photos from this device.       │
│                                           │
│  [Allow Access]                          │
│  [Skip for now]                          │
└──────────────────────────────────────────┘

Screen 3 of 3 (Backup):
┌──────────────────────────────────────────┐
│           [Illustration]                 │
│                                           │
│  Back up automatically                   │
│  Never lose a photo again.               │
│  Backs up in background, WiFi only.      │
│                                           │
│  [Turn on backup]                        │
│  [Not now]                               │
└──────────────────────────────────────────┘
```

---

## COMPONENT LIBRARY (Reference for All Pages)

### Photo Thumbnail
```
┌────────────────┐
│                │  - object-fit: cover
│   [photo img]  │  - No border radius on grid (edge to edge feel)
│                │  - Subtle loading shimmer (skeleton)
│                │  - Multi-select: dark overlay + white circle checkmark (top-left)
└────────────────┘
```

### Bottom Sheet
- Slides up from bottom (translateY animation, spring physics)
- Frosted glass background (backdrop-filter: blur(20px), bg: rgba(255,255,255,0.85))
- Drag handle (40px × 4px pill, centered top)
- Drag down to dismiss
- Dark scrim behind (rgba(0,0,0,0.4)), tap to close

### Empty State
```
┌──────────────────────────────────────────┐
│                                           │
│              [Soft illustration]          │
│                                           │
│         No photos yet                    │
│         Tap + to add your first photo    │
│                                           │
│         [  + Add Photos  ]               │
│                                           │
└──────────────────────────────────────────┘
```

### Skeleton Loader
- Same grid layout as photos
- Gray shimmer blocks where photos will appear
- Animate: shimmer moves left-to-right (1.5s loop)

### Toast Notification
```
╭──────────────────────────────╮
│  ✓  Photo saved to album     │  ← Slides up from bottom (above nav)
╰──────────────────────────────╯   Auto-dismisses in 3s. No X button needed.
```

---

## GESTURE MAP

| Gesture | Where | Action |
|---------|-------|--------|
| Swipe left/right | Photo Viewer | Previous / Next photo |
| Swipe down | Photo Viewer | Close, return to grid |
| Swipe up | Photo Viewer | Open photo details panel |
| Pinch in | Photo Grid | Zoom out (more columns) |
| Pinch out | Photo Grid | Zoom in (fewer columns) |
| Long press | Any photo | Enter multi-select mode |
| Long press | Album | Album context menu |
| Double tap | Photo Viewer | Zoom 2× |
| Pinch | Photo Viewer | Free zoom |
| Drag handle down | Bottom sheet | Dismiss sheet |
| Swipe down | Bottom sheet | Dismiss sheet |

---

## WHAT TO AVOID

- No hamburger menus (everything via bottom nav + swipe)
- No full-screen modals for simple actions (use bottom sheets)
- No excessive loading spinners (prefer skeletons)
- No cluttered toolbars (max 4 icons in any toolbar)
- No tiny tap targets (minimum 44×44px)
- No persistent notifications or banners
- No onboarding tooltips after first-run
- No disabled states without explanation
- No deep navigation stacks (max 3 levels deep)
- No separate "confirm" dialogs for reversible actions
- No forced account creation (offer guest mode)