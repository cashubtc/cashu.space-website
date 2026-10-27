# cashu.space

The landing page for [Cashu](https://github.com/cashubtc), an open Chaumian
ecash protocol for bitcoin. It exists to explain the protocol in under a
minute, point people at a wallet and at the spec, and signal through tone and
craft that this is a serious open protocol rather than a coin, a company, or a
product. No sign-ups, no email capture, no funnel.

Next.js 16 (App Router, Turbopack), React 19, Tailwind v4. Every route is
statically prerendered.

## Quick start

Requires Node 20.9+ (what Next 16 needs; there is no `engines` field pinning
it).

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build
npm start        # serve the production build
npm run lint     # eslint
```

You do **not** need the font toolchain below to run or build the site. The
subset faces are committed.

## Read the design docs before touching the UI

This repo keeps its reasoning in prose, and the prose is load-bearing rather
than decorative. Most of the visual decisions here have already been made
once, reversed, and remade, and the documents record why — including the
things that were tried and rejected, which is usually the part that saves you.

| File | What it is |
| --- | --- |
| [`PRODUCT.md`](PRODUCT.md) | Strategic spec: who this is for, brand personality, anti-references, design principles. |
| [`DESIGN.md`](DESIGN.md) | The visual system: tokens, type scale, components, and the named rules with their full amendment history. |
| [`CLAUDE.md`](CLAUDE.md) | The hard rules in short form, for agents and for anyone in a hurry. |
| [`AGENTS.md`](AGENTS.md) | A warning that this Next.js version has breaking changes against what you probably remember. |
| [`.impeccable/`](.impeccable) | Machine-readable design sidecar and critique history. |

The short version, so a first change does not have to be reverted:

- **Monochrome.** Greys shift by lightness, never by hue. Colour exists in
  exactly two places, both named in `DESIGN.md` §2.
- **No `border-radius`, no `box-shadow`, no glass.** Anywhere, buttons
  included. Each of these had exactly one licensed exception at some point and
  each was retired.
- **Three typefaces.** GT-Standard for everything readable, Geist Mono for
  technical notation, Geist Pixel Square for protocol artefacts.
- **The site is light only.** No dark mode, no `prefers-color-scheme` branch,
  no toggle. That is not the same as having no dark surfaces — several plates
  are fixed dark values on a light page.
- **Motion must be caused.** No ambient loops, no idle cycles, no timers, no
  parallax. See the Set-Once Rule in `DESIGN.md` §4.

## Fonts are a build step

The four shipped faces are subsets, cut down to the characters the site
actually sets. Together they are about 40KB, down from 135KB — the single
largest saving on the page.

```
assets/fonts/   licensed masters. Read only by the subset script.
                Never served. See assets/fonts/README.md.
src/fonts/      generated subsets. The only fonts a browser receives:
                next/font/local copies them into _next/static/media/
                with a content hash at build time.
```

Nothing goes in `public/fonts/`. That directory used to hold both, which
served all 13 masters at stable URLs nothing linked to and served each subset
a second time.

To regenerate:

```bash
pipx install "fonttools[woff]"     # or: pip install fonttools brotli
node scripts/subset-fonts.mjs
```

Brotli is not optional — woff2 compression needs it, and without it the script
fails at the last step.

**Re-run it when the rendered character set changes**: a keymap chord label, a
NUT id, the hero field's alphabets, or copy carrying a character outside
Latin-1. The codepoint ranges and the per-face reasoning are in the script's
header.

The trap worth knowing: **a character missing from a subset does not render as
tofu.** It falls through the fallback chain to a system font and still looks
broadly correct, which is the kind of defect that survives review. Verify by
rasterising with the fallback chain stripped, not by looking at the page.

One harmless oddity: the woff2 encoder is not deterministic, so re-running the
script leaves modified font files in `git status` even when nothing about the
inputs or the ranges changed. Two consecutive runs here produced 5192 and 5188
bytes for the same face. Discard the diff unless you meant to change something.

## Deploying

This repo deploys to a **personal Vercel project**. It is not what serves
`cashu.space` today — that domain belongs to the Cashu team and currently runs
an older Pages Router app on Fly.io. The team will point the domain here when
they are ready.

That gap has one consequence worth knowing about, because it is not obvious
from reading the code. `src/lib/site-url.ts` resolves `SITE_URL` to
`https://cashu.space` whenever `VERCEL_ENV === "production"`, and
`IS_PRODUCTION` follows the same flag. So a *production* deploy of the personal
project will:

- emit canonical URLs and Open Graph tags pointing at `cashu.space`, a site it
  is not, and
- emit a `robots.txt` that allows indexing and declares `host: cashu.space`.

Preview deploys are fine — they disallow indexing and resolve `SITE_URL` to
their own `VERCEL_URL`. Only the production environment of the staging project
has this shape.

Set `NEXT_PUBLIC_SITE_URL` in the Vercel project to override the host. It takes
precedence over everything else and is the intended escape hatch. Note that it
changes the URLs only; the indexing decision is `IS_PRODUCTION`, which is a
separate line in the same file.

None of this needs solving before the cutover. It needs solving before the
staging deploy gets indexed.

## Things that will surprise you

- **This is not the Next.js you remember.** Version 16 has breaking changes
  against most training data and most tutorials. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing anything non-trivial.
- **The hero's ground is hand-rolled WebGL2** (`src/components/hero-field.tsx`,
  `src/lib/hero-field/`): a frozen field of Geist Mono hex with a wake the
  pointer stirs through it. It has no `time` uniform and
  runs no `requestAnimationFrame` at rest — `window.__heroFieldFrames` exists
  so you can prove that rather than trust it. Do not add Three.js.
- **Two currency marks are drawn, not typed.** `₿` (U+20BF) and `₩` (U+20A9)
  are `.notdef` in Geist Mono, and `fillText` falls through to a system font
  silently, so both are synthesised from the face's own letterforms in
  `src/lib/hero-field/glyphs.ts`. Do not "simplify" that away, and do not trust
  `document.fonts.check` for coverage.
- **Entrances that always play run from CSS, not from React.**
  `.reveal--arrival` starts when the stylesheet parses. It begins at
  `opacity: 0.02` rather than `0`, which looks like a typo and is not: Chrome
  will not accept an element as an LCP candidate if its only main-thread paint
  is fully transparent. Changing it to `0` costs about 1.5 seconds of LCP. The
  reasoning is in `globals.css` beside the rule.
- **The homepage hero is centred and nothing else is.** It is the one
  deliberate departure from the left-aligned editorial register, and it is not
  a bug to be fixed for consistency.

### Kubernetes staging image

The `Build staging image` workflow builds pushes to `main` and publishes
`ghcr.io/cashubtc/cashu-space-website:staging`. It needs the repository Actions
secret `MOTION_TOKEN` for the private Motion+ package; it is supplied to Docker
as a BuildKit build secret and is not an image build argument. The GHCR package
must be public for anonymous Kubernetes pulls, or the cluster needs pull credentials.

This image is **for staging only**: Next.js prerenders metadata and robots rules
at build time with `NEXT_PUBLIC_SITE_URL=https://staging.cashu.space` and
`VERCEL_ENV=preview`, so it uses the staging canonical URL and disallows indexing.
Production needs a separately configured build. The infrastructure repository
pins the image digest and controls deployment; a moving tag alone does not deploy.
