---
name: Obsidian Telemetry
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system delivers an austere, mission-critical workspace engineered for site reliability engineers, infrastructure architects, and chaos engineering specialists. The aesthetic fuses the meticulous utility of developer command hubs (Linear, Vercel) with the analytical clarity of deep telemetry environments (Datadog, Grafana). 

The emotional tone balances absolute system control with heightened vigilance: hyper-precise, quiet under normal operation, but surgical and unambiguous during active degradation or controlled fault injection. High visual density and strict geometric rhythm minimize cognitive friction during cascading infrastructure incidents.

The design philosophy combines **Technical Minimalism** with **Data-Dense Utility**:
- Low-sheen surfaces with deep zinc foundations reduce eye strain during extended war-room sessions.
- Spatial hierarchy is maintained through crisp structural borders (`#27272a`) and stepped neutral surfaces rather than noisy drop shadows.
- Visual weight is reserved strictly for real-time status cues: steady nominal emeralds, warning ambers during synthetic injection, and vivid rose beacons during critical breaches.
- Monospaced elements receive first-class hierarchy alongside typographic copy, reinforcing an uncompromising engineering posture.

## Colors

The palette operates under an uncompromising dark-mode-first paradigm, calibrated to make live infrastructure data and state transformations immediately legible across high-density panels.

### Core Canvas & Structure
- **Canvas Base (`#09090b`):** Deep charcoal void backing all viewports and deep root layouts.
- **Sidebar & Navigation (`#111113`):** Subtly lifted navigation rail separating global control contexts from workspace views.
- **Surface / Base Card (`#18181b`):** Foundation for functional widgets, inspector panels, and telemetry tiles.
- **Elevated / Modal Surface (`#202024`):** Highest local elevation tier for flyouts, command palettes, dropdown overlays, and contextual sheets.
- **Border / Divider (`#27272a`):** Rigid single-pixel hairline delineation defining component architecture without relying on diffuse shadows.

### Content & Typography
- **Text Primary (`#fafafa`):** High-readability pure contrast for active headings, metric values, and primary states.
- **Text Secondary (`#a1a1aa`):** Subdued contrast for field keys, trace tags, metadata, and static labels.
- **Text Tertiary / Muted (`#71717a`):** Low-contrast treatment for inactive controls, placeholder inputs, and passive axis ticks.

### State & Telemetry Semantics
- **Primary Accent (`#6366f1`):** Indigo indicator for synthetic workflows, focused form elements, primary CTA execution, and interactive graph nodes.
- **Informational (`#38bdf8`):** Sky blue for readouts, AI query hints, topology annotations, and baseline trace comparisons.
- **Healthy / Operational (`#10b981`):** Resilient emerald signifying zero drift, passing health checks, and stabilized target blast radiuses.
- **Chaos / Active Fault (`#f59e0b`):** High-visibility amber denoting live experiment orchestrations, simulated network latency, packet loss, and CPU pressure events.
- **Critical Incident (`#f43f5e`):** Uncompromising crimson for unexpected target termination, SLO/SLA violations, crash loops, and immediate system halt controls.

## Typography

The typographic hierarchy enforces a disciplined dual-font architecture:
- **Inter** orchestrates structured layout headings, operational narrative, form controls, and descriptive body copy. Its tight tracking and clean aperture preserve clarity at tight sizes.
- **JetBrains Mono** governs technical telemetry: stack traces, JSON schema definitions, microservice tags, IP/CIDR notations, latency percentiles (`p99`, `p95`), and raw CLI command strings.

All body sizes lean compact (`13px` base) to facilitate high information density. Uppercase styling is reserved strictly for `label-sm` technical pills, metric units, and status badges, always paired with expanded letter spacing to ensure immediate scannability.

## Layout & Spacing

The layout operates on a compact 4px grid system calibrated for high-density dashboards, multi-pane trace inspectors, and split-screen log/topology correlation.

### Grid & Canvas Structure
- **Sidebar & App Shell:** Fixed primary left rail (64px collapsed, 240px expanded) paired with a persistent 48px global breadcrumb and status header.
- **Workspace Layout:** Fluid grid system utilizing 12 or 24 fractional columns depending on pane complexity. Dashboards default to 12 columns with auto-snapping widget containers.
- **Split-Pane Architecture:** Splitters utilize a rigid 1px divider embedded within a 4px target buffer, supporting horizontal side-by-side (Topology / Metrics) and vertical stacked (Timeline / Logs) workflows.

### Breakpoints & Adaptive Reflow
- **Desktop Wide (≥1440px):** 24-column capability, persistent right-hand contextual inspector sheet (380px), multi-stream telemetry panels.
- **Desktop Standard (1024px – 1439px):** 12-column grid, collateral inspector panels collapse to an overlay drawer, sidebar auto-collapses to icon mode.
- **Tablet / Small Screen (768px – 1023px):** Single-column stacked widgets, telemetry cards switch to carousel or tabbed layouts, sub-navigation converts to horizontal scrolling chips.
- **Mobile (<768px):** Emergency read-only or kill-switch focus: complex charts yield to scalar KPIs, log streams convert to formatted single-line event lists, fixed bottom status sheet.

## Elevation & Depth

Visual depth is achieved through **Tonal Layering** and **Subtle Structural Hairlines** rather than diffused drop shadows, maintaining crisp contrast in low-light environments.

- **Surface Ground (`#09090b`):** The canvas canvas baseline. Used for canvas backgrounds, root viewport framing, and graph stage workspaces.
- **Surface Level 1 (`#18181b`):** Default card and widget surface. Framed with a 1px solid border (`#27272a`).
- **Surface Level 2 (`#202024`):** Interactive hover states, expanded table rows, and secondary utility blocks within a Level 1 container.
- **Surface Overlay (`#202024`):** Modals, global command palettes (`⌘K`), dropdown menus, and popovers. Elevated with a refined, tight ambient drop shadow: `0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px #27272a`.
- **Fault Glow Effect (Active State):** High-priority or degraded cards do not use generic shadows; they leverage a directional 1px perimeter glow tied to the alert status:
  - Critical: `inset 0 0 0 1px rgba(244, 63, 94, 0.4), 0 0 12px -2px rgba(244, 63, 94, 0.25)`
  - Active Injection: `inset 0 0 0 1px rgba(245, 158, 11, 0.4), 0 0 12px -2px rgba(245, 158, 11, 0.25)`

## Shapes

The design system enforces a disciplined, low-radius shape geometry (`roundedness: 1`). The aesthetic is technical, sharp, and structured.

- **Base Elements (0.25rem / 4px):** Form inputs, buttons, metric cards, status badges, table row highlights, and log view lines.
- **Containers & Overlays (0.5rem / 8px):** Flyout sheets, modal dialogues, graph canvas viewports, and primary dashboard metric panels (`rounded-lg`).
- **Pills / Status Dots (Full / 9999px):** Live indicator dots, heartbeat status pulses, and isolated numeric counters within compact tabs.

## Components

Components follow dense, high-utility patterns inspired by shadcn/ui and enterprise developer platforms.

### Buttons & Interactive Controls
- **Primary:** Background `#6366f1`, text `#fafafa`, 1px border `rgba(255, 255, 255, 0.1)`. Subtle brightness transition on hover (`#4f46e5`).
- **Secondary / Default:** Background `#18181b`, text `#fafafa`, border 1px solid `#27272a`. Hover state transitions background to `#202024`.
- **Emergency Kill Switch (Halt Experiment):** High-visibility destructive CTA. Solid `#f43f5e` background with white text, or hollow crimson outline (`1px solid #f43f5e`) with a blinking heartbeat dot. Requires explicit hold-to-confirm or secondary prompt when live faults are active.
- **Sizing:** Standard heights are compacted (`32px` default, `24px` micro/table, `36px` primary modal actions).

### Status Badges & Chips
- **Design:** Compact height (`20px`), font `JetBrains Mono` (`label-sm`), uppercase with letter spacing.
- **Healthy:** Background `rgba(16, 185, 129, 0.1)`, text `#10b981`, border `1px solid rgba(16, 185, 129, 0.2)`. Preceded by an emerald 6px circular indicator.
- **Injecting / Fault Active:** Background `rgba(245, 158, 11, 0.1)`, text `#f59e0b`, border `1px solid rgba(245, 158, 11, 0.25)`. Features a pulsing amber dot.
- **Critical / Degraded:** Background `rgba(244, 63, 94, 0.1)`, text `#f43f5e`, border `1px solid rgba(244, 63, 94, 0.3)`.

### Input Fields & Technical Filters
- **Inputs:** Height `32px`, background `#111113`, border `1px solid #27272a`, text `#fafafa`. Placeholder text in `#71717a`.
- **Focus State:** 1px stroke in `#6366f1` with zero blurred drop shadow.
- **Query / KQL Filter Bar:** Embedded monospaced prefix tags (`service:`, `cluster:`, `error.code:`) rendered with background `#202024` and text `#38bdf8`.

### Telemetry Cards & Metric Panels
- **Structure:** Surface `#18181b`, border `1px solid #27272a`, padding `space-md` (`12px`).
- **Header:** Metric label in `body-sm` (`#a1a1aa`), accompanying live value in `headline-md` (`#fafafa`), aligned with inline percentile delta tags (`+14.2% p99`).
- **Body Area:** Sparklines and time-series line charts rendered against faint `#27272a` horizontal grid lines with absolute zero vertical grid noise.

### Technical Tabs & Breadcrumbs
- **Tabs:** Clean underline or segmented control style. Segmented tabs use background `#111113`, active tab sits raised with background `#202024` and text `#fafafa`. Underline style features a 2px `#6366f1` bottom border indicator.
- **Breadcrumbs:** Path structure rendered in `JetBrains Mono` `code-sm` (`prod-us-east-1 / k8s-mesh-04 / chaos-pod-kill`), separated by `#27272a` slashes, trailing node highlighted in `#fafafa`.

### Incident & Chaos Log Streams
- **Log Viewer:** Background `#09090b`, row height `22px`, font `JetBrains Mono` `code-sm`.
- **Columns:** Fixed-width timestamp (`ISO-8601` in `#71717a`), log level pill (`INFO`, `WARN`, `CRIT`), trace ID (`#38bdf8`), followed by the raw log payload (`#fafafa`).
- **Hover Row:** Background shifts to `#18181b` with a copy-to-clipboard action pinned to the right edge.