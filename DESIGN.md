---
version: alpha
name: agent-workbench
description: Dark-first, developer-focused design system for a local-first agent TUI workbench with mobile-web and dashboard companions.
colors:
  primary: "#0F172A"
  on-primary: "#F1F5F9"
  secondary: "#94A3B8"
  tertiary: "#3B82F6"
  on-tertiary: "#FFFFFF"
  neutral: "#1E293B"
  neutral-hover: "#334155"
  border: "#475569"
  surface: "#1E293B"
  surface-alt: "#334155"
  success: "#22C55E"
  error: "#EF4444"
  info: "#3B82F6"
  plugin: "#A855F7"
  link: "#60A5FA"
  code-bg: "rgba(0, 0, 0, 0.3)"
  code-inline-bg: "rgba(255, 255, 255, 0.08)"
  overlay: "rgba(0, 0, 0, 0.5)"
typography:
  h1:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
  h2:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 0.875rem
    lineHeight: 1.5
  body-sm:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 0.75rem
    lineHeight: 1.4
  code:
    fontFamily: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace
    fontSize: 0.85em
    lineHeight: 1.5
  label-caps:
    fontFamily: ui-sans-serif, system-ui, -apple-system, sans-serif
    fontSize: 0.7rem
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.neutral-hover}"
    textColor: "{colors.on-primary}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 8px
  button-ghost-hover:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-primary}"
  card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 16px
  card-hover:
    backgroundColor: "{colors.neutral-hover}"
  input:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px
  input-focus:
    textColor: "{colors.on-primary}"
  badge:
    backgroundColor: "{colors.neutral-hover}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.pill}"
    padding: 4px
  badge-success:
    backgroundColor: rgba(34, 197, 94, 0.15)
    textColor: "{colors.success}"
  badge-error:
    backgroundColor: rgba(239, 68, 68, 0.15)
    textColor: "{colors.error}"
  badge-info:
    backgroundColor: rgba(59, 130, 246, 0.15)
    textColor: "{colors.info}"
  nav-drawer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-primary}"
    width: 280px
---

## Overview

agent-workbench has a dark-first, minimal, developer-focused visual identity.
The web UI serves two purposes: a **mobile companion** (PWA for on-the-go
interaction with agent sessions) and a **dashboard** (desktop observability
hub). Both share the same color palette and typography — a subdued slate
foundation with bright accent colors reserved for semantic signals (success,
error, info, plugin). The interface treats code output and agent messages as
first-class content, rendered with monospace typography and minimal chrome.

## Colors

- **Primary (#0F172A):** Deep navy — page background, input surfaces,
  scrollbar track. Maximum contrast area.
- **Neutral (#1E293B):** Card and panel surfaces. The default container
  background.
- **Neutral-hover (#334155):** Elevated surfaces, hover states, badge
  backgrounds.
- **Secondary (#94A3B8):** Muted text, metadata labels, placeholder
  content. Supports hierarchy without competing with primary text.
- **Tertiary (#3B82F6):** Primary interaction accent — buttons, links,
  focus rings, info indicators.
- **Success (#22C55E):** Green for healthy status, online indicators,
  passing checks.
- **Error (#EF4444):** Red for errors, failed operations, destructive
  actions.
- **Plugin (#A855F7):** Purple for plugin-related UI elements, extension
  markers.
- **Border (#475569):** Subtle dividers, input borders, card outlines
  in dark mode.
- **Overlay (rgba(0,0,0,0.5)):** Modal and drawer backdrops.

## Typography

The system UI font stack (`ui-sans-serif, system-ui, -apple-system`)
provides native OS typography with no external font dependencies — ensures
fast rendering on mobile networks. Hierarchy is carried by weight (600/700)
and size (1.5rem → 0.75rem) rather than font family changes.

Code uses a dedicated monospace stack for agent output, diffs, and
inline code snippets with a semi-transparent background.

## Layout & Spacing

A 4px baseline scale drives all spacing. The `sm`-`md`-`lg`-`xl`-`xxl`
progression (8px → 12px → 16px → 24px → 48px) maps to Tailwind's native
spacing scale for consistency.

The mobile-web PWA uses full viewport height (`100dvh`) with safe-area
insets for notched and rounded-screen devices. The nav drawer expands to
60vw on landscape phones, 35vw on tablets.

## Elevation & Depth

The dark color scheme relies on color contrast rather than box shadows
for depth. Surfaces are distinguished by lightness steps (slate-900 →
slate-800 → slate-700). Modals and drawers use a semi-transparent
overlay (`rgba(0,0,0,0.5)`). The only elevation signals are:

- Subtle border (`#475569`) on interactive elements
- 200ms opacity + translateX transitions for panel slides

## Shapes

- 4px (`sm`): Scrollbar thumb, inline code padding
- 6px (`md`): Buttons, inputs, cards, code blocks
- 8px (`lg`): Larger surface containers
- 12px (`xl`): Modals, elevated panels
- `pill`: Badges, avatar indicators, status dots

## Components

- **`button-primary`:** Blue accent, white text. Single high-emphasis action
  per view. Used for "Connect", "Retry", "Submit".
- **`button-ghost`:** No background, muted text. Low-emphasis actions like
  "Cancel", "Dismiss", navigation triggers.
- **`card`:** Slate-800 container for grouped content — sessions list,
  activity log, metrics panels.
- **`input`:** Deep navy background, slate border. Focus shifts border to
  tertiary blue with no ring (Tailwind v4).
- **`badge`:** Default neutral badge for labels and counts.
- **`badge-success/error/info`:** Semantic badges with tinted backgrounds and
  colored text for status indicators.
- **`nav-drawer`:** Fixed-position side panel (280px width on portrait,
  35-60vw landscape) with sliding overlay for mobile navigation.

## Do's and Don'ts

- **Do** use token references (`{colors.primary}`) in component definitions
  to keep the palette single-source.
- **Do** extend the palette via the `@theme` block in
  `apps/mobile-web/src/styles/index.css` when new colors are needed.
- **Don't** introduce colors outside the palette without first adding them
  to this file and the CSS `@theme` block.
- **Don't** nest component variants — `button-primary-hover` is a sibling
  entry, not a child.
- **Do** use 200ms ease-out for all transitions — consistent motion language.
- **Don't** use box shadows for depth; use color steps instead.
- **Do** respect safe-area-inset-* on mobile to avoid notch/clip conflicts.
