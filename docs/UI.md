# User Interface & Design System Documentation

This document describes the design language, UI design patterns, custom primitives, and structural layout rules for the **What Do I Watch** application.

## Design Language: Netflix + Linear Blend

The app's interface blends the cinematic content presentation of **Netflix** with the crisp utility and high-contrast control surfaces of **Linear**.

*   **Netflix governs content**: High-density media assets, charcoal content tiles, red accents, full-bleed backdrop hero views, and poster overlays.
*   **Linear governs chrome**: Clean charcoal panels, sharp borders, section subtitles in low-contrast tertiary grey, uppercase micro-labels, and platform-native rounded UI details.

---

## 1. Color Palette & Semantic Tokens

Theme colors are defined in `whatdoiwatch-app/tailwind.config.js` and should be referenced using Tailwind classes:

| Token | Hex Value | Purpose |
| :--- | :--- | :--- |
| `canvas` | `#000000` | Root background color of the application. |
| `tile` | `#181818` | Media card background and placeholder tiles. |
| `tile-deep` | `#141414` | Shimmer/skeleton backdrops and empty image holders. |
| `panel` | `#0F1011` | Primary container surface (filters, search boxes, list cards). |
| `panel-raised` | `#1C1C1F` | Secondary background for active highlights, buttons, and badges. |
| `border` | `#28282C` | Default thin borders for panels, dividers, inputs, and chips. |
| `border-tile` | `#333333` | Borders for poster/media tiles to stand out against black. |
| `ink` | `#FFFFFF` | Primary text and high-importance icon fills. |
| `ink-secondary`| `#B3B3B3` | Secondary text (year, subtitle, search placeholder). |
| `ink-tertiary` | `#8A8F98` | Section headings, metadata labels, and captions. |
| `accent` | `#E50914` | Netflix red brand accent (toggles, active state, links). |
| `accent-hover` | `#C11119` | Hover/press highlight red. |
| `success` | `#27A644` | Safe positive indicators (e.g. watchlist "Want to Watch" states). |
| `warning` | `#F0BF00` | Alert and caution text color (e.g. fallback warning alerts). |
| `overlay` | `rgba(0,0,0,0.64)` | Linear gradient overlay used on media cards to protect text legibility. |

---

## 2. Core Primitives (`src/components/ui.tsx`)

To maintain theme consistency and prevent style drift, the project extracts four reusable layout elements in [ui.tsx](file:///Users/samirhusain/Personal/code_projects/Whatdoiwatch/whatdoiwatch-app/src/components/ui.tsx):

### `Panel`
A container primitive for wrapping grouped elements.
*   **Style**: Rounded corner radius (`rounded-xl` / 12px), charcoal color background (`bg-panel`), thin charcoal border (`border border-border`).
*   **Usage**: Wraps search forms, filters blocks, list items, and empty state boxes.

### `Chip`
A rounded pill button used for selectors, filtering, and tag badges.
*   **Active State**: Filled red background (`bg-accent border-accent`), white text (`text-white font-semibold`).
*   **Inactive State**: Elevated background (`bg-panel-raised border-border`), grey text (`text-ink-secondary`).
*   **Usage**: Genre options, release eras, media type badges, and selected item tokens.

### `PrimaryButton`
A high-priority call-to-action button styling based on Netflix's layout.
*   **Style**: Red background (`bg-accent`), sharp corners (`rounded` / 4px), minimum touch target height (`py-4` / 48px), bold uppercase white text (`text-white font-bold tracking-wider`).
*   **Usage**: High-value actions like triggering recommendation calculation ("Find Our Pick") or random select ("Surprise Me").

### `SectionLabel`
A low-emphasis uppercase header label.
*   **Style**: Small, uppercase, letter-spaced, tertiary-grey text (`text-ink-tertiary text-xs uppercase tracking-wide`).
*   **Usage**: Top-level identifiers for details blocks like "OVERVIEW", "CAST", "STREAM", "TRAILER", or form fields.

---

## 3. UI Patterns & View Guidelines

### Screen Headers
All primary screens (Home, Surprise, Swipe, Movie Night, Watchlist) use **left-aligned** header labels rather than centered layouts to match both Netflix and Linear interfaces:
*   Header titles: `text-white text-2xl font-bold` (or `text-3xl`).
*   Header subtitles: `text-ink-secondary text-sm`.

### Media Cards (`TitleCard.tsx`)
Card poster layouts are optimized for readability:
*   Aspect ratio: `aspect-[2/3]` with `rounded-2xl bg-tile border border-border-tile`.
*   **Gradient Mask**: A bottom overlay using `LinearGradient` (colors: `["transparent", "rgba(0,0,0,0.64)"]`) covers the lower 40% of the poster to ensure the overlayed rating text is readable on light posters.
*   Badge: TV series get a small badge in the top-right corner (`bg-panel-raised text-white text-[10px] font-bold`).

### Backdrop Hero (`TitleDetailSheet.tsx`)
The details screen features a movie backdrop hero layout:
*   If `backdrop` exists: Renders a full-width `16/9` backdrop image with a bottom gradient fade. The movie title and year overlap the bottom edge.
*   If no `backdrop` exists: Falls back gracefully to a side-by-side row showing the poster alongside the title metadata.
*   Action buttons (Want to Watch, Seen It, Not Interested) use color-coded active states:
    *   **Want to Watch (Active)**: Green (`bg-success border-success`).
    *   **Seen It (Active)**: Red (`bg-accent border-accent`).
    *   **Not Interested / Inactive**: Elevated grey (`bg-panel-raised border-border`).

### Swipe Cards (`SwipeCard.tsx`)
The swipe screen displays media items as overlay cards with gesture-driven swipe actions:
*   **LIKE**: Green text stamp (`text-success`).
*   **NOPE**: Red text stamp (`text-accent`).
*   **SKIP**: Neutral grey stamp (`text-ink-secondary`).

---

## 4. Typography

The application uses **Inter** as its core typeface.
*   **Native**: Configured via `@expo-google-fonts/inter` (`Inter_400Regular`, `Inter_600SemiBold`, `Inter_700Bold`) loaded in the root layout ([_layout.tsx](file:///Users/samirhusain/Personal/code_projects/Whatdoiwatch/whatdoiwatch-app/src/app/_layout.tsx)).
*   **Web**: Cascades through standard CSS fallback systems configured in `global.css` using system UI fonts first.
*   **Weights**: Restricted mainly to 400 (Regular/Book), 600 (Semi-bold titles), and 700 (Bold headings).
