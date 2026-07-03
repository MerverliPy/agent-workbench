---
version: alpha
name: agent-workbench
description: Dark-first, developer-focused design system for a local-first agent
  TUI workbench with mobile-web and dashboard companions.
colors:
  primary:       "#0F172A"     # Deep navy — page background, input surfaces
  on-primary:    "#F1F5F9"     # High-contrast body text on dark surfaces
  secondary:     "#94A3B8"     # Muted text, metadata, placeholders
  tertiary:      "#3B82F6"     # Primary interaction accent (single accent rule)
  on-tertiary:   "#FFFFFF"     # White text on tertiary backgrounds
  neutral:       "#1E293B"     # Card/panel surfaces, message bubbles
  neutral-hover: "#334155"     # Hover states, badge BGs, model chip fill
  border:        "#475569"     # Dividers, input borders, card outlines
  surface:       "#1E293B"     # Alias for neutral — drawer + panel backgrounds
  surface-alt:   "#334155"     # Elevated surface variant
  success:       "#22C55E"     # Connection pulse, healthy indicators
  warning:       "#EAB308"     # Warnings, in-progress states
  error:         "#EF4444"     # Errors, destructive actions
  info:          "#3B82F6"     # Info badges, tab counts (same as tertiary)
  plugin:        "#2DD4BF"     # Plugin/extension markers (teal — not default LLM purple)
  link:          "#60A5FA"     # Hyperlinks in agent messages
  code-bg:       rgba(0,0,0,0.3)       # Multi-line code blocks
  code-inline-bg: rgba(255,255,255,0.08) # Inline code snippets
  overlay:       rgba(0,0,0,0.5)       # Modal/drawer backdrops

typography:
  family:  ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif
  mono:    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace
  h1:      1.5rem  / 700 / 1.3
  h2:      1.25rem / 600 / 1.3
  h3:      1.125rem / 600 / 1.3
  body-md: 0.875rem / 400 / 1.5
  body-sm: 0.75rem  / 400 / 1.4
  code:    13px / 400 / 1.5        # Mobile-optimized code block size
  label-caps: 10px / 600 / 0.06em letter-spacing (agent badge)

rounded:
  sm:   4px     # Scrollbar, inline code, toolbar buttons
  md:   6px     # Buttons, inputs, cards, code blocks, message bubbles
  lg:   8px     # Surface containers, phone frame
  xl:   12px    # Modals, elevated panels
  pill: 9999px  # Badges, model chip, agent badge, tab badges

spacing:        # 4px baseline
  xs:  4px      sm: 8px      md: 12px
  lg:  16px     xl: 24px     xxl: 48px

motion:
  transition: 200ms ease-out (single token for all interactive states)

elevation:
  color-steps: slate-900 → slate-800 → slate-700 (no box-shadows on cards/inputs)
  shadow: 0 10px 15px -3px rgba(0,0,0,0.3) — dropdowns + drawer only
  overlay: rgba(0,0,0,0.5) — drawer/modal backdrop

components:
  button-primary:
    bg: tertiary, text: white, radius: md, padding: 12px
    hover: opacity 0.9, active: #2563EB, focus: 2px accent outline
  button-ghost:
    bg: transparent, text: secondary, radius: md, padding: 8px
    hover: neutral bg, focus: 2px accent outline
  card:
    bg: neutral, radius: md, padding: 16px
  input:
    bg: primary, border: border, radius: md, padding: 10px 14px
    focus: accent border + 3px rgba ring, auto-resize: 1-7 rows (120px max)
  badge:
    base: neutral-hover bg, secondary text, pill radius, 10px/600
    success: rgba(34,197,94,0.15) bg, success text
    error:   rgba(239,68,68,0.15) bg, error text
    info:    rgba(59,130,246,0.15) bg, info text
  message-user:
    right-aligned, accent bg, white text, radius md + bottom-right 4px
  message-assistant:
    left-aligned, neutral bg, 1px border, radius md + bottom-left 4px
  tab-active:
    accent text, 36px×3px top indicator bar, aria-selected=true
  tab-inactive:
    muted text, no indicator, 11px/500
  model-chip:
    pill shape, neutral-hover bg, blue dot + label + chevron
    dropdown: opens upward, shadow, 3 model options with color-coded dots
  nav-drawer:
    280px portrait, 60vw landscape (max 360px), border-right
    active item: 2px left accent border + rgba(59,130,246,0.08) bg
  scroll-fab:
    40px circle, accent bg, fade-in animation
    hover: scale 1.05, active: scale 0.95, focus: 3px accent outline
  code-block:
    dark inset bg (code-bg), 13px mono, radius sm, white-space: pre
  code-inline:
    0.85em mono, code-inline-bg, radius 3px, padding 1px 5px
  time-separator:
    centered label between horizontal rules, 11px muted text
  connection-bar:
    3px, success bg, 2s pulse animation (opacity 0.6→1→0.6)
  typing-indicator:
    3 bouncing dots, 1.4s staggered, 7px diameter

interaction-states:         # REQUIRED for every interactive element
  Element            Hover              Active/Press       Focus-visible
  ─────────────────────────────────────────────────────────────────
  Send button        opacity 0.9        darker blue        2px accent outline
  Toolbar buttons    surface-hover bg   surface-hover bg   2px accent outline
  Hamburger          surface-hover bg   surface-hover bg   2px accent outline
  Tab items          secondary text     accent text        2px accent outline (inset)
  Suggestion btns    accent border      accent border      2px accent outline
  Drawer items       surface-hover bg   surface-hover bg   2px accent outline (inset)
  Model chip         accent border      open dropdown      2px accent outline
  Scroll FAB         scale 1.05         scale 0.95         3px accent outline
  Input field        —                  —                  accent border + 3px ring

accessibility:
  ARIA:
    - Tab bar: role="tablist", role="tab" + aria-selected (JS-synced)
    - Drawer: role="navigation", aria-label="App navigation"
    - Hamburger: aria-expanded + aria-controls="drawer" (JS-synced)
    - Overlay: aria-hidden (JS-synced)
  focus-visible: all buttons + interactive elements (2-3px accent outline)
  reduced-motion: @media (prefers-reduced-motion: reduce) strips all animations
  touch: 34-40px minimum targets, -webkit-tap-highlight-color: transparent
  contrast: WCAG AA — #F1F5F9 on #0F172A, #3B82F6 for large text/icons

anti-patterns:                 # Do NOT:
  ❌ Gradients anywhere         ❌ Emoji as icons (use SVG)
  ❌ Box-shadows for depth      ❌ Second accent color
  ❌ External font deps         ❌ Generic filler text
  ❌ Decorative blobs/flourishes ❌ Unbounded color palette
  ❌ Default LLM purple (#A855F7) — use #2DD4BF for plugin

do:
  ✅ Single accent (tertiary) for all interaction signals
  ✅ 200ms ease-out for every transition
  ✅ env(safe-area-inset-*) on mobile chrome
  ✅ user-select: none on all chrome elements
  ✅ Hand-authored SVG icons (stroke-only, 1.5-2px, currentColor)
  ✅ Color-step depth instead of box-shadows
  ✅ Complete interaction state matrix (hover/active/focus-visible/disabled)
---
