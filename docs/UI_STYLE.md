# SimpleHost Control UI Style and Layout Guide

Date drafted: 2026-04-14
Scope: `SimpleHost Control` (`SimpleHost`) operator UI and shared UI primitives

## Purpose

This document captures the current visual system and layout conventions that are now considered the working baseline for `SimpleHost Control`.

It is intended to prevent future UI work from drifting back into:

- overloaded resource detail screens
- inconsistent spacing and card treatments
- mixed button palettes
- ad-hoc table behavior
- one-off layouts that ignore the shared `packages/ui` primitives

## Canonical implementation paths

The current implementation lives primarily in:

- `/opt/simplehostman/src/packages/ui/src/base-styles.ts`
- `/opt/simplehostman/src/packages/ui/src/admin-shell-styles.ts`
- `/opt/simplehostman/src/packages/ui/src/client-behaviors.ts`
- `/opt/simplehostman/src/packages/ui/src/admin-shell.ts`
- `/opt/simplehostman/src/packages/ui/src/panel-shell.ts`
- `/opt/simplehostman/src/packages/ui/src/data-table.ts`

The most visible `SimpleHost Control` workspace wiring currently lives in:

- `/opt/simplehostman/src/apps/control/web/src/dashboard-shell.ts`
- `/opt/simplehostman/src/apps/control/web/src/dashboard-page.ts`
- `/opt/simplehostman/src/apps/control/web/src/dashboard-packages.ts`
- `/opt/simplehostman/src/apps/control/web/src/desired-state-workspace.ts`
- `/opt/simplehostman/src/apps/control/web/src/desired-state-app-proxy.ts`
- `/opt/simplehostman/src/apps/control/web/src/desired-state-database.ts`
- `/opt/simplehostman/src/apps/control/web/src/desired-state-zone.ts`
- `/opt/simplehostman/src/apps/control/web/src/desired-state-tenant-node.ts`

## Shells

Two shells define the current `SimpleHost Control` UI structure.

### `AdminShell`

Used for the main operator product UI.

Current structure:

- sticky left sidebar
- right main content column
- compact page header at the top of the content column
- cards and section panels stacked below

Current behavior:

- desktop uses a two-column shell with sidebar plus content
- mobile collapses into a single-column shell
- sidebar includes search, grouped navigation, badges, and version footer

### `PanelShell`

Used for focused standalone views and fallback detail pages.

Current structure:

- single-column page
- hero header with eyebrow, title, and optional actions
- body content below

This shell is appropriate for direct, non-dashboard views such as preview pages and focused utilities.

## Visual tokens

Current palette and tokens are defined in `base-styles.ts`.

Important current colors:

- primary action fill: `#007FFF`
- primary action border: `#0F52BA`
- secondary action fill: `#FFC067`
- secondary action border: `#CE8946`
- main navy text and chrome: `#102744`
- deeper navy text: `#0A1730`
- lime attention/accent: `#B7F34D`

Current page background direction:

- layered radial accents
- cool gradient across light blue, gray-blue, teal, soft green, and lime tones

Do not flatten this back into a single-color background unless the whole product direction changes.

## Typography

Current type direction:

- UI copy: `IBM Plex Sans`
- technical/code content: `Iosevka Etoile` with `IBM Plex Mono` fallback

Current defaults:

- base scale is compact
- page titles are moderately large, not oversized
- card descriptions are intentionally smaller than titles
- code and operational identifiers should use monospace where clarity benefits

## Radius and spacing

Current radius system:

- cards and tables: `5px`
- control radius: `0.45rem`

Current spacing direction:

- compact by default
- cards should feel tight and dense rather than airy
- form controls should not regress into tall, padded default browser-style inputs

## Cards

### Base card treatment

Current card rules:

- soft light surface
- thin border
- modest shadow
- no oversized inner padding

### Card headers

Current header treatment for both parent and nested cards:

- soft gray header fill
- straight bottom edge
- 5px radius only on top corners
- compact title plus smaller description

This header treatment should remain consistent across:

- `Resource inventory`
- `Selected resource`
- nested cards like `Properties and status`
- nested modal preview cards

### Nested cards

Nested cards are used for secondary groupings inside a parent card.

Typical uses:

- properties
- actions
- configuration forms
- small related-resource summaries

## Buttons

Current button hierarchy:

- primary: blue fill with darker blue border
- secondary: soft orange fill with darker orange border
- danger: reserved only for destructive contexts

Current rules:

- action groups should use uniform widths where buttons are siblings
- button labels should be concise
- resource configuration should not mix save actions with operational dispatch actions when they belong to different conceptual groups

## Badges and pills

Current badge direction:

- count badges use lime where emphasis is needed
- selected-resource header badges also use lime
- borders should remain visible enough against light surfaces

Current pill usage:

- lightweight state markers inside tables and detail grids
- not full CTA chips

## Tables

Current table direction:

- dark navy header row
- compact controls above
- selected row highlighted in blue
- hover highlighted in lime
- any row with a focus link should be clickable across the full row

Current toolbar behavior:

- filter on the left
- page-size selector, count, and pagination on the right
- `Rows per page` persists in `localStorage`

Current page-size rule:

- `Rows per page` stays native and should not use searchable custom select behavior

## Selects and inputs

Current control behavior:

- compact inputs and selects
- custom searchable select UI for most resource-form selectors
- native select retained where lightweight behavior is preferable

Current select refinements:

- chevron aligned tightly to the right edge
- hover state visible
- option hover inside custom dropdowns uses lime
- `Rows per page` intentionally stays without internal search

## Resource workspace layout

Current resource workspaces should prefer clarity over operational overload.

### General pattern

Recommended structure:

- inventory table first
- selected resource beside it on desktop and below it on mobile
- properties and editable configuration clearly separated inside the selected-resource container
- heavy operational history moved into global workspaces

Current desktop direction:

- inventory table in the left column
- selected resource in the right column
- selected resource built from nested cards instead of inner tabs

Current selected-resource structure:

- `Properties and status`
- `Actions`
- `Resource configuration`

### Operational separation

Current direction is to remove embedded long-form operational feeds from resource cards.

Prefer linking to:

- `Jobs`
- `Audit`
- `Resource drift`

Do not reintroduce long inline job and audit feeds into resource detail panels unless there is a strong product reason.

### Proxies workspace

Current proxy workspace direction:

### Packages workspace

`Operations > Packages` follows the operational workspace pattern rather than the resource pattern.

Current structure:

- filter form first
- inventory table second
- selected package detail on the left below the table
- action/install cards stacked on the right

Current action split:

- `Refresh inventory`
- `Install from repo`
- `Install from RPM URL`

Current product rule:

- package inventory and installs are operational actions on nodes, not desired-state resources
- package history should cross-link to `Jobs` and `Audit`
- if the product later grows package baselines or package enforcement, that should become a separate declarative feature instead of overloading this workspace

- no tabs
- single selected-resource container
- nested cards for `Properties and status`, `Actions`, and `Resource configuration`
- linked database represented as a compact card inside `Properties and status`
- `Actions` reserved for operational actions and deep links

### Apps, databases, zones, and tenants

Current direction now matches the proxy workspace:

- no `Summary / Spec / Activity` tabs in the object workspace
- one selected-resource container per record
- compact properties grid plus lightweight linked-resource cards
- operational actions routed outward to `Jobs`, `Audit`, `Resource drift`, or `Backups`
- forms kept separate from dispatch buttons

Do not reintroduce mixed layouts where some resource workspaces use compact single-panel mode and others fall back to dense tabbed stacks unless there is a deliberate product-level reason.

## Operational workspaces

Current operational workspaces should still share the same visual language as desired-state views.

Keep these aligned:

- lime count badges on section tables
- compact filters and page-size controls
- two-column desktop split between selected detail and secondary side panels
- navy table headers
- full-row click for selectable tables

This applies to:

- `Jobs`
- `Audit`
- `Backups`
- `Mail`

Backups should stay intentionally light in the operations workspace: keep the
run table, selected run detail, and selected policy context visible, but avoid
secondary summary cards for effective state, planned changes, related resources,
or duplicate backup-run lists when those links already exist in the primary
table and detail panels.

## Modals and overlays

Current overlay direction:

- modal overlays are allowed for focused technical previews
- `ESC` closes the active modal first
- if no modal is open, `ESC` can fall back to backwards navigation

## Apache vhost preview

Current Apache vhost preview behavior:

- opened from `Proxies`
- modal first, standalone page as fallback/direct route
- dual-view layout for `HTTP` and `HTTPS / SSL`
- equalized preview card headers
- code displayed in monospace
- line numbers shown in a dedicated gutter

Current preview styling:

- light gray code surface
- lime line-number gutter
- dark navy line-number text

## Responsive behavior

Current responsive rules:

- desktop keeps shell/sidebar and two-column detail patterns
- mobile collapses to one column
- action button groups stack on narrow screens
- modal preview columns collapse to a single column on smaller widths

## Interaction rules

Current interaction rules worth preserving:

- clicking a whole selectable table row should focus that resource
- top-level navigation remains in the sidebar, not inside resource cards
- global workspaces should own operational browsing
- modals should not break fallback navigation if opened directly by URL

## Change-management guidance

When changing `SimpleHost Control` UI:

- prefer updating shared primitives in `packages/ui` before patching individual screens
- keep color and radius decisions centralized in the shared style files
- preserve the current compact density unless the whole product is being relaxed intentionally
- update this document when the visual system or layout conventions materially change

## Quick checklist for future UI work

- Does the change preserve the current compact card rhythm?
- Does it respect the current primary/secondary button palette?
- Does it keep operational feeds in global workspaces instead of stuffing them back into resource cards?
- Does it use the shared shells and shared table primitives?
- Does it remain coherent on both desktop and mobile?
