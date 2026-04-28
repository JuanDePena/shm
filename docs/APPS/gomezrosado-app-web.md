# Gomez Rosado Static Website Brief

Date created: `2026-04-26`

Last updated: `2026-04-27`

## Scope

This document defines the visual foundation for the future `gomezrosado.com.do` website.

Current product assumptions:

- site type: static website
- stack posture: no database
- content sources: static HTML, CSS, JavaScript, and media assets
- media support: photos, GIFs, and videos
- tone: premium legal, restrained, editorial, trustworthy

## Brand Reference

Reference used for this palette:

- official brand package uploaded under `/srv/containers/apps/gomezrosado/app/public/media/brand`
- color guide: `GR-Codigo-Colores.jpg` and `GR-Codigo-Colores-Detalle.pdf`
- warm metallic gold monogram
- soft neutral gray wordmark
- restrained, elegant, high-contrast legal identity

The website should feel:

- refined, not flashy
- confident, not aggressive
- warm, not sterile
- premium, not luxury-for-luxury's-sake

Avoid:

- cold blues as the primary tone
- neon gold
- purple accents
- glossy gradients that feel corporate-tech
- pure black on everything

## Product Direction

This app should be treated as a content-led brand site, not a web application.

Implications:

- no database-backed UI assumptions
- no dashboard styling
- no admin-looking controls in the public site
- layouts should favor photography, attorney bios, service sections, trust signals, and contact calls to action
- videos and images should sit on calm, neutral surfaces that let gold accents stay special

## Core Palette

These are the official brand tones from the uploaded color guide, plus derived UI fills for the static site.

| Token | Hex | Intent |
| --- | --- | --- |
| `brand-gold-light` | `#E0B86D` | official light gold, primary accent |
| `brand-gold-deep` | `#B7975F` | official deeper gold, hover depth and lines |
| `brand-gray` | `#7F7F7E` | official gray wordmark tone |
| `gold-soft` | `#F0D6A3` | derived highlight for UI gradients |
| `amber-soft` | `#F1E2C4` | derived subtle warm fill |
| `brown-700` | `#4C3928` | dark warm brown |
| `brown-600` | `#6B5137` | secondary accent brown |
| `stone-900` | `#1E1A17` | near-black warm base |
| `stone-800` | `#2B2622` | dark surface text |
| `stone-700` | `#4A443D` | heavy body text |
| `stone-600` | `#70685F` | secondary body text |
| `stone-500` | `#90887F` | muted text |
| `stone-300` | `#D8D0C6` | borders on light theme |
| `stone-200` | `#EAE4DB` | soft panels on light theme |
| `stone-100` | `#F5F1EB` | warm light fill |
| `ivory-50` | `#FCFAF7` | main light canvas |
| `white` | `#FFFFFF` | elevated light surface |

## Typography

The uploaded editable logo PDF does not expose a clear licensed wordmark font; the
logo artwork appears to be mostly outlined. The live site therefore uses
`Montserrat`, self-hosted from `/assets/fonts/montserrat-latin.woff2`, as the
closest open web family for the wordmark direction.

Usage:

- body, navigation, buttons, headings, and cards: `Montserrat`
- brand name: uppercase, `600`
- tagline: uppercase, `400`
- hero and page headings: `600`
- body copy: `400`
- content copy sizing is isolated from the header through `--content-copy-size`
  and `--content-lede-size`, applied under `main` and content text selectors

## Light Theme

Recommended light theme variables:

```css
:root,
[data-theme="light"] {
  --bg-canvas: #FCFAF7;
  --bg-surface: #FFFFFF;
  --bg-surface-muted: #F5F1EB;
  --bg-panel: #EAE4DB;

  --line-soft: #E1D9CE;
  --line-strong: #CFC4B5;

  --text-strong: #1E1A17;
  --text-body: #4A443D;
  --text-muted: #70685F;
  --text-subtle: #90887F;

  --brand: #E0B86D;
  --brand-strong: #F0D6A3;
  --brand-deep: #B7975F;
  --brand-soft: #F1E2C4;
  --brand-neutral: #7F7F7E;

  --accent-brown: #6B5137;
  --accent-brown-deep: #4C3928;

  --link: #B7975F;
  --link-hover: #8B7044;

  --button-primary-bg: #E0B86D;
  --button-primary-text: #1E1A17;
  --button-primary-hover: #B7975F;

  --button-secondary-bg: transparent;
  --button-secondary-text: #4A443D;
  --button-secondary-border: #CFC4B5;

  --hero-overlay: linear-gradient(
    180deg,
    rgba(252, 250, 247, 0.18) 0%,
    rgba(252, 250, 247, 0.84) 100%
  );

  --shadow-soft: 0 18px 50px rgba(30, 26, 23, 0.08);
}
```

Light theme usage notes:

- main pages should live on `--bg-canvas`, not on pure white edge-to-edge
- reserve pure white for cards, quote panels, modal surfaces, and content blocks over photography
- use gold mainly for CTAs, separators, monogram moments, active nav, and key numerics
- body copy should stay in warm charcoal and gray, not gold

## Dark Theme

Current status note:

- keep the current dark theme direction as the active baseline for now
- the palette is intentionally darker than the first draft and should stay in this deeper espresso range unless final brand assets later suggest otherwise
- in dark mode, the official mark image should sit slightly brighter than the surrounding header controls so the brand mark stays legible at a glance

Recommended dark theme variables:

```css
[data-theme="dark"] {
  --bg-canvas: #0B0908;
  --bg-surface: #110F0D;
  --bg-surface-muted: #171411;
  --bg-panel: #201A15;

  --line-soft: #2D261F;
  --line-strong: #3E342B;

  --text-strong: #F6F1E9;
  --text-body: #DDD2C4;
  --text-muted: #B1A698;
  --text-subtle: #8D8377;

  --brand: #E0B86D;
  --brand-strong: #F0D6A3;
  --brand-deep: #B7975F;
  --brand-soft: #4B3A1E;
  --brand-neutral: #C8C5BF;

  --accent-brown: #705638;
  --accent-brown-deep: #4C3B2A;

  --link: #F0D6A3;
  --link-hover: #E0B86D;

  --button-primary-bg: #E0B86D;
  --button-primary-text: #1A1612;
  --button-primary-hover: #F0D6A3;

  --button-secondary-bg: transparent;
  --button-secondary-text: #DDD2C4;
  --button-secondary-border: #3E342B;

  --hero-overlay: linear-gradient(
    180deg,
    rgba(11, 9, 8, 0.18) 0%,
    rgba(11, 9, 8, 0.88) 100%
  );

  --shadow-soft: 0 24px 60px rgba(0, 0, 0, 0.50);
}
```

Dark theme usage notes:

- the dark mode should feel espresso, stone, and bronze, not flat black
- it can run very dark as long as gold controls and the `GR` monogram remain crisp
- use gold to pull focal points forward against dark imagery
- avoid placing long body copy directly on pure dark backgrounds without a softened surface layer
- video and photo sections should use smoky warm overlays, not blue-black overlays

## Semantic Usage

Recommended mapping:

- `brand`: key CTA, active states, highlighted numbers, icon strokes
- `brand-soft`: subtle badges, quiet highlights, section wash backgrounds
- `accent-brown`: secondary CTA, eyebrow labels, legal-detail accents
- `text-strong`: headlines, navigation, card titles
- `text-body`: paragraphs, list items, biographies
- `text-muted`: captions, meta information, disclaimers
- `line-soft`: card borders, dividers, subtle form outlines

## Component Intent

### Header and Navigation

- light theme: ivory or white surface with charcoal text and gold active underline
- dark theme: warm charcoal surface with muted text and gold active underline

### Hero

- allow image or video backgrounds
- always apply a warm overlay, not a neutral black overlay
- hero CTA should be gold, never bright blue

### Cards and Content Blocks

- use off-white cards in light mode
- use espresso-to-stone cards in dark mode
- keep borders visible and refined

### Attorney Bios

- portraits should sit on calm neutral surfaces
- names in strong text
- titles and specializations in muted warm gray
- use gold sparingly for separators or small profile accents

### Footer

- dark theme footer is the preferred default
- gold lines or icons are appropriate
- avoid overdecorating with gradients

## Accessibility Notes

- keep gold accents dark enough in light mode to pass against ivory and white
- do not use gold as the only indicator of interaction or active state
- pair muted gray text with sufficient contrast, especially over video or photography
- for dark mode, prefer `--text-body` on `--bg-surface` instead of muted text on `--bg-canvas`

## Static Site Constraints

Because the site is expected to be static:

- all theme behavior should work with file-based or build-time content
- no database-driven palette switching is required
- theme variables should be centralized in a single stylesheet or token file
- media assets should be organized with predictable static paths

Recommended content posture:

- use build-time content files for both languages
- avoid client-side-only translation for primary page content
- keep JavaScript limited to navigation behavior, media interactions, language/theme persistence, and small animated touches
- treat photos, GIFs, and videos as editorial assets, not as decorative clutter

Suggested structure direction:

```text
/public/media/photos
/public/media/gif
/public/media/video
/public/media/brand
/public/css/tokens.css
```

## Logo Asset Status

Current note:

- the logo currently available is a screenshot reference, not the final brand asset
- palette values in this document are directionally correct, but still provisional
- once the official light and dark logos arrive, update this document with exact brand colors, safe-area guidance, and file naming

Do not assume yet:

- final logo geometry
- exact stroke thickness
- official monochrome variant behavior
- minimum sizes
- spacing rules over imagery

## Site Structure Proposal

Recommended public sitemap for launch:

| Page | Primary goal | Suggested route ES | Suggested route EN |
| --- | --- | --- | --- |
| `Home` | communicate trust, positioning, and key calls to action | `/` | `/en/` |
| `About` | explain the firm, philosophy, and credibility | `/nosotros/` | `/en/about/` |
| `Services` | present practice areas and service framing | `/servicios/` | `/en/services/` |
| `Team` | introduce attorneys and support leadership | `/equipo/` | `/en/team/` |
| `Contact` | convert traffic into calls, WhatsApp, email, or consultations | `/contacto/` | `/en/contact/` |

Supporting static pages if needed later:

- `privacy-policy`
- `terms`
- `thanks`
- one page per practice area if the service list grows

## Runtime File Structure

Implementation note:

- unlike the earlier abstract proposal, the working tree for `gomezrosado.com.do` should follow the existing runtime convention already used by `adudoc`
- the live application root is `/srv/containers/apps/gomezrosado/app`
- this site is still static, but its filesystem should live directly under that runtime root

Recommended runtime tree:

```text
/srv/containers/apps/gomezrosado/app
  /.well-known
  /assets
    /site.css
    /site.js
  /content
    /es
      home.json
      about.json
      services.json
      team.json
      contact.json
    /en
      home.json
      about.json
      services.json
      team.json
      contact.json
  /public
    /uploads
    /media
      /brand
      /photos
      /gif
      /video
  /storage
    /cache
    /logs
    /uploads
  /nosotros
    index.html
  /servicios
    index.html
  /equipo
    index.html
  /contacto
    index.html
  /en
    index.html
    /about
      index.html
    /services
      index.html
    /team
      index.html
    /contact
      index.html
  /index.html
  /README.md
```

Why this shape:

- it mirrors the runtime style already proven in `/srv/containers/apps/adudoc/app`
- it keeps the public pages simple and explicit
- it avoids inventing a second source convention outside the deployed app root
- it stays compatible with a future build step if we later decide to generate the final HTML

## Global Layout System

Recommended desktop layout:

1. top utility bar
2. primary navigation
3. page hero or section intro
4. editorial content sections
5. call-to-action band
6. premium footer

Prelaunch note:

- the public home page should stay aligned with the real site structure, not collapse into a separate `site under construction` landing unless explicitly needed for an operational reason
- language buttons and the theme toggle should live on the upper-right side of the header

### Top Utility Bar

Place this group in the upper-right corner of the header:

- language selector group
- theme toggle

Recommended composition:

- one compact language selector that shows only the currently selected flag when closed
- the open selector should show `flag + language name`
- Spanish should use the Spain flag plus tooltip `Español`
- English should use the United Kingdom flag plus tooltip `English`
- theme toggle sits immediately to the right
- theme toggle is icon-only
- theme toggle uses tooltip text describing the next action, such as `Cambiar a tema oscuro` or `Switch to light mode`

Important accessibility note:

- do not use the flags as the only identifier
- the selector must still expose the language name through visible menu text plus `aria-label`
- tooltip text should be the language name, not the country name

### Primary Navigation

Suggested right-side navigation items:

- `Home`
- `About`
- `Services`
- `Team`
- `Contact`

Behavior:

- sticky header after scroll
- elegant underline or gold bar for active page
- CTA button can be `Book a consultation` / `Agendar consulta`

## i18n Strategy

This site should launch as bilingual from day one.

Recommended locales:

- `es`
- `en`

Recommended default behavior:

- default language for first-time visitors: `es`
- once the visitor chooses a language, always respect the saved preference unless they explicitly switch again

Recommended static routing:

- `es` lives on the root routes
- `en` lives under `/en/`

This is preferable to runtime-only string swapping because it:

- keeps pages indexable
- supports cleaner sharing of URLs
- works well without a database
- keeps copy easier to manage at build time

Recommended content structure:

```text
/src/content/es/home.json
/src/content/es/about.json
/src/content/es/services.json
/src/content/es/team.json
/src/content/es/contact.json
/src/content/en/home.json
/src/content/en/about.json
/src/content/en/services.json
/src/content/en/team.json
/src/content/en/contact.json
```

## Theme and Preference Persistence

Preferences should persist in `localStorage`.

Recommended keys:

- `gr_site_locale`
- `gr_site_theme`

Recommended values:

- locale: `es` or `en`
- theme: `light` or `dark`

Recommended first-load logic:

1. check `localStorage` for saved locale and theme
2. if none exist, use `es` plus `light` as the initial fallback
3. apply `data-theme` on the root element before the page fully paints when possible
4. apply the language route or localized content without overriding an explicit URL the visitor opened directly

Recommended HTML hooks:

```html
<html lang="es" data-theme="light">
```

Recommended JavaScript behavior:

- selecting a language option updates `localStorage`
- selecting a language option navigates to the localized route equivalent
- clicking the theme toggle updates `localStorage`
- clicking the theme toggle updates `data-theme` immediately
- the current selected language and theme should always look active in the UI

## Page-by-Page Structure

### Home

Primary purpose:

- establish trust fast
- show the firm as modern, serious, and consultative
- direct visitors toward contact or practice areas

Suggested section order:

1. hero with strong positioning statement
2. trust strip with credentials, years, jurisdictions, or consultation posture
3. short `About the firm` editorial block
4. featured practice areas
5. `Why Gomez Rosado` differentiators
6. selected attorney highlights
7. call-to-action band
8. contact preview
9. footer

Hero direction:

- use a restrained background image or subtle video
- left-aligned headline
- compact copy block
- one primary CTA and one secondary CTA

Example copy direction:

- ES: `Asesoría legal clara, estratégica y confiable.`
- EN: `Clear, strategic, and trusted legal counsel.`

### About

Primary purpose:

- tell the story of the firm
- explain its philosophy
- build human credibility

Suggested section order:

1. page intro
2. firm story
3. mission and values
4. legal approach or methodology
5. trust indicators
6. closing CTA

Copy direction:

- grounded, articulate, and human
- avoid inflated self-praise
- favor authority through clarity and discipline

### Services

Primary purpose:

- make legal services easy to understand
- help prospects self-identify their need

Suggested section order:

1. page intro
2. services overview grid
3. service-detail blocks
4. process or engagement model
5. CTA

Recommended service card anatomy:

- service name
- short plain-language summary
- representative situations
- clear next step

Possible practice-area groupings:

- corporate and commercial advisory
- civil litigation
- labor matters
- compliance and contracts
- immigration or international support if applicable

These should stay provisional until the firm confirms the exact portfolio.

### Team

Primary purpose:

- present the people behind the firm
- strengthen confidence before contact

Suggested section order:

1. page intro
2. leadership feature
3. team grid
4. attorney bios
5. CTA

Recommended bio structure:

- portrait
- full name
- role
- short biography
- focus areas
- languages if relevant

Because the site is static, team data should live in content files or frontmatter, not in a database.

### Contact

Primary purpose:

- create the easiest possible path to a conversation

Suggested section order:

1. page intro
2. contact methods grid
3. office location block
4. business hours or response expectation
5. consultation CTA
6. optional map embed

Recommended contact methods:

- phone
- WhatsApp
- primary email
- office address

If a contact form is needed later, prefer a static-compatible delivery path such as a mail endpoint or trusted third-party form handler, not a local database.

## Copy Direction

Overall writing style:

- elegant, plainspoken, and credible
- short paragraphs
- no inflated legal jargon unless necessary
- no startup-style hype language
- no generic corporate filler

Spanish voice:

- formal but warm
- direct and confident
- natural for Dominican and broader Latin American business readers

English voice:

- international and professional
- not overly Americanized in tone
- clear enough for cross-border clients and partners

Recommended messaging pillars:

- trust
- clarity
- strategic thinking
- responsiveness
- discretion

## Media and Layout Notes

Because this is a media-capable static site:

- use photography intentionally and sparingly
- prefer calm video loops over loud motion
- GIFs should be rare and only when they add meaning
- keep page weight under control by optimizing all media assets

Recommended visual rhythm:

- alternate between airy light sections and a few darker premium bands
- reserve gold for anchors and emphasis
- keep generous spacing around text blocks
- use subtle reveals, not aggressive animation

## Default Build Recommendation

Recommended v1 implementation posture:

- static site generator or static-first frontend
- route-based bilingual pages
- centralized design tokens
- no database
- no CMS dependency for the first launch unless content volume grows significantly
- very small JavaScript layer for header controls, theme persistence, and minor interactions

## Default Recommendation

If only one theme is prioritized first:

- build the public launch in light theme first
- include the dark palette in code from day one
- use dark mode mainly for premium sections, footer, overlays, and optional full-site toggle later

## Short Summary

`Gomez Rosado` should use:

- warm ivory backgrounds
- metallic amber and gold accents
- restrained browns
- sophisticated warm grays
- charcoal instead of pure black

This should feel like a modern legal editorial site with premium restraint, not a tech product and not a luxury boutique gimmick.
