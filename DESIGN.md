# DESIGN.md — llmrouter docs site (recorded from the built world)

## World: dark-zinc instrument (user-corrected: design 1's palette)
The page is a precision instrument, not a brochure. A near-black zinc ground
(#09090b) carries a faint plotted grid and a blue vignette; soft matte
surfaces hold content; one electric blue owns every primary moment.

## Palette (roles)
| Token | Value | Role |
|---|---|---|
| ink | #09090b | page ground (near-black zinc) |
| panel / raised / sunk | #111114 / #17171b / #0b0b0d | surfaces, code wells |
| line / line2 | white @ 8% / 14% | hairlines, borders |
| bone / mute / dim | #f4f4f5 / #a1a1aa / #71717a | text ramp |
| accent | #3b6bff | the single accent: CTA, winner, selection, focus |
| accent-hi | #6b8fff | accent as text (headings line 3, kickers, labels) |
| ok | #2dd4a7 | live/picked states (demo winner row, pulse dot) |
| bad | #f0576a | circuit-open / failure only |

## Type
- Display: Outfit 600–800, tracking -0.025/-0.03em, hero clamp(1.95–3.9rem)
- Body: Plus Jakarta Sans 15px/1.65, mute for prose secondary
- Mono: JetBrains Mono — every measured value, kicker, label (uppercase, 0.1–0.14em tracking), code
- Selection: accent on #fafafa; focus-visible: 2px accent outline, offset 3px

## Shape language (the "smooth" mandate)
- One plate radius: 14px; fields/chips 10px; controls are pills (99px)
- Plate material: solid panel + 1px line border + inset 1px top highlight +
  long soft shadow (0 24px 56px -30px). No glass except the frosted nav.
- Hairline dividers between rows/rails, never boxed cards inside cards

## Motion
- Reveal-on-scroll once (translateY 14px, 0.55s cubic-bezier(.16,1,.3,1), staggered by column)
- Hero console: SVG runner dots along flow paths + 2.2s pulse dot; static fallback
- One marquee (46s linear, masked edges); stage-plate 0.4s content fade
- prefers-reduced-motion: all animation off, reveals visible by default

## Components
nav (frost pill links + Source button) · hero 5/7 grid · console plate
(head/body/foot) · telemetry rail (4 cells, hairline grid) · editorial rows
(01–03) · formula plate · sticky stage viewer with pill progress · copy chips
(accent hover, copied state) · segmented code tabs · lab (real engine, ok
picked row w/ 3px inset bar) · bento (delegation hero tile + 11 tiles, mono
file-name kickers) · scroll-snap policy strip · CLI grid · parity table ·
honest-expectations plate (accent-hi tint) · CTA gradient plate

## Committed exceptions
- Plotted grid background: kept (pinned design-2 world; it is the
  instrument's measurement field, detector advisory acknowledged).
- No photography; hero visual is an SVG console explicitly labeled
  "illustrative fleet, synthetic scores".
