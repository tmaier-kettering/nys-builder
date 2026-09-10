# Branding Guide

## Colors

| Name | Hex |
| --- | --- |
| teal | `#089bab` |
| green | `#7dd958` |

Header/footer bars and full-bleed cover photos use a diagonal teal-to-green gradient
(`assets/gradient_bar.png`, `assets/toc_background.png`). Section headings use solid teal.

## Fonts and paragraph formatting

- **Line spacing:** 1.15
- **Paragraph spacing:** 3pt before and 3pt after
- **Alignment:** Justified

| Text style | Font |
| --- | --- |
| Normal | Montserrat, 11pt |
| Title | Antonio Bold, 24pt |
| Subtitle | Montserrat Light, 14pt |
| HEADING 1 | Antonio Bold, 20pt |
| HEADING 2 | Antonio Bold, 18pt |
| HEADING 3 | Antonio Regular, 14pt |

Antonio only ships as a variable font from Google Fonts, so static Bold/Regular instances are
pulled from the Fontsource jsdelivr mirror instead (see `pdf-config.js`'s `fonts` block).

The cover, chapter-cover (International/Domestic), narrative front-matter (Preface, Overview,
Preamble), and closing pages are copied in directly from the source Canva PDF export rather than
redrawn — they use Canva's in-house "Object Sans" font, which is preserved as-is in those pages'
embedded font data and never needs to be re-embedded by the generator.

## PDF export requirements

- Title comes from the static cover page: **National Youth Statement on Climate**.
- Selected policies are split into two chapters by `Scope` — **International** and **Domestic** —
  each behind its own static chapter-cover page. A chapter (and its cover page) is omitted
  entirely when no selected policy has that scope.
- Within a chapter, policies are grouped: International by `UNFCCC Pillar`
  (Mitigation / Adaptation / Just Transition), Domestic by `Jurisdiction`
  (national → "Federal", subnational → "Subnational").
- Numbered policies keep the alternating band layout (`policyBlocks.bandAColor`/`bandBColor` in
  `pdf-config.js`), reskinned to the teal/green palette.
- Remove the **Policy** label and format policy text left-aligned across full width with the
  first word bolded.
- Number policies consecutively in the order shown in the PDF.
- Format tools as a bulleted, underlined hyperlink list that opens the tools page with the
  selected tool shown in the right-hand panel.
