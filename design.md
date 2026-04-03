# The Design System: Editorial Wanderlust

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Concierge"**

This design system moves away from the "utility-first" clutter of traditional travel apps and moves toward a **High-End Editorial** experience. It treats every itinerary like a personalized travel magazine and every map as a bespoke cartographic tool.

The aesthetic is defined by **Atmospheric Depth** and **Intentional Asymmetry**. We break the "template" look by utilizing large, offset typography, overlapping image containers, and a layout that breathes. The goal is to reduce "travel anxiety" through a calm, sophisticated interface that feels premium, curated, and intentionally designed—not just "built."

---

## 2. Colors & Tonal Atmosphere
Our palette balances the authority of `primary` (#003FA3) with the vibrant energy of `secondary` (#AC3509).

### The "No-Line" Rule
To achieve a high-end feel, **1px solid borders are strictly prohibited** for sectioning. Boundaries must be defined through background color shifts. Use `surface-container-low` for secondary content areas sitting on a `surface` background. This creates a soft, modern transition that mimics architectural shadows rather than digital boxes.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. We use a "Nesting" approach to define importance:
- **Base Level:** `surface` (#F3FAFF) for the main application background.
- **Content Blocks:** `surface-container-low` (#E6F6FF) for broad sections or groupings.
- **Actionable Cards:** `surface-container-lowest` (#FFFFFF) to provide a "pop" of high-contrast elevation.
- **Interaction Overlays:** `surface-container-highest` (#CFE6F2) for subtle depth in nested elements.

### The "Glass & Gradient" Rule
For floating elements like "Quick Action" bars or Navigation Overlays, use **Glassmorphism**. Apply `surface` at 70% opacity with a `20px` backdrop-blur. This allows the vibrant travel imagery or maps to bleed through, maintaining a sense of place. For primary CTAs, use a subtle linear gradient from `primary` (#003FA3) to `primary-container` (#0055D4) at a 135-degree angle to add "soul" and dimension.

---

## 3. Typography: Editorial Authority
We utilize a dual-font strategy to balance character with extreme legibility.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "Editorial" voices. Use `display-lg` and `headline-lg` with generous tracking (-0.02em) to create a sophisticated, modern travel-journal feel.
*   **Body & Utility (Inter):** For data-heavy itineraries and flight details, Inter provides maximum readability. The tight apertures and neutral tone ensure that complex information (like `body-md`) remains clear even on small mobile screens.
*   **Labels (Inter Bold):** Use `label-md` in all-caps with +0.05em letter spacing for metadata (e.g., "PROPOSED" vs "CONFIRMED") to create an authoritative, "passport-stamp" aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often too "muddy." We convey hierarchy through light and atmosphere.

*   **The Layering Principle:** Instead of shadows, stack `surface-container-lowest` cards on top of `surface-container` backgrounds. The subtle shift from #DBF1FE to #FFFFFF is enough to signify a new layer to the human eye.
*   **Ambient Shadows:** For "Floating" elements (e.g., a draggable map pin or a floating action button), use a shadow with a blur of `32px`, an offset of `Y: 8px`, and an opacity of 6%. The shadow color must be a tinted version of `on-surface` (#071E27) to mimic natural ambient light.
*   **The "Ghost Border":** If a boundary is required for accessibility in Light Mode, use `outline-variant` (#C3C6D7) at **15% opacity**. It should be felt, not seen.
*   **Depth through Blur:** Use backdrop-blur on navigation headers to ensure they feel "anchored" while letting the user remain connected to the content scrolling beneath them.

---

## 5. Components

### Cards & Itinerary Items
*   **Rule:** Forbid divider lines.
*   **Execution:** Separate daily activities using `xl` (1.5rem) vertical spacing. Use a `surface-container-low` background for the "Travel Mode" (walking/driving) indicators to create a visual track between confirmed activities.
*   **Radius:** All cards must use `lg` (1.0rem) or `xl` (1.5rem) corner rounding for a soft, premium feel.

### Buttons
*   **Primary:** A gradient fill (`primary` to `primary-container`) with `full` (9999px) rounding.
*   **Secondary/Action Chips:** Use `secondary-container` (#FE6F42) with `on-secondary-container` (#631800) text for high-energy highlights like "Book Now."
*   **Ghost Actions:** Use `primary` text on a transparent background with a "Ghost Border" that appears only on hover.

### Status Indicators
*   **Proposed:** `surface-variant` background with `on-surface-variant` text. Low contrast to indicate "draft" status.
*   **Confirmed:** `tertiary-container` (#006A62) background with `on-tertiary-container` (#79EBDD) text. This high-contrast teal signifies "Green for Go."

### Specialized Travel Components
*   **The "Time-Line" Path:** A 2px dashed line using `outline-variant` to connect itinerary nodes. Avoid solid lines; dashes feel like a journey in progress.
*   **Map Overlays:** Use `surface-container-lowest` with a `0.75rem` padding and `md` rounding for map tooltips.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. For example, a headline might be indented more than the body text to create an editorial "ragged" look.
*   **Do** use `secondary` (#AC3509) sparingly as a "heartbeat" color—only for the most important calls to action.
*   **Do** leverage `surface-bright` for outdoor daylight modes to ensure the screen remains legible under direct sun.

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on-surface` (#071E27) to maintain the "Deep Travel Blue" brand soul.
*   **Don't** use standard "Material Design" cards with heavy shadows and 1px borders. If it looks like a generic template, it's wrong.
*   **Don't** overcrowd the map view. Use `surface-dim` for inactive map areas to keep the focus on the active itinerary route.
