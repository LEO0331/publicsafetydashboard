# Design

## Direction

The UI uses a civic archive style: public-record typography, restrained institutional color, ledger-like panels, and neutral traffic-safety wording. Traditional Chinese remains the default interface language, with an English toggle for the frontend.

## Principles

- Use Traditional Chinese labels by default and provide English frontend copy without translating public source record values.
- Keep the product educational, not sensational.
- Prioritize dense but readable scanning for repeat use.
- Preserve source attribution and the government-data disclaimer.
- Keep name search out of the default workflow.

## Visual System

- Palette: paper, ink, civic green, civic blue, signal red, and amber.
- Typography: Traditional Chinese serif display treatment for primary headings, readable sans-serif body text.
- Components: ledger panels, public-notice stamps, bordered form controls, and clear focus rings.
- Motion: short ledger entry animation for page load only.

## Accessibility

- Root language is `zh-Hant`.
- Dashboard includes a skip link.
- Interactive controls have visible focus states.
- Tables preserve readable labels and source links.
- Lighthouse accessibility target is at least 90.

## Map Design

Map markers represent grouped locations, not individuals. To avoid a dense pin wall, the map tab uses a ranked location explorer:

- A searchable side list shows exact location names, incident counts, date ranges, and type breakdowns.
- The map defaults to the highest-incident geocoded locations and folds lower-ranked locations behind a show-all control.
- Map marks are scaled circles, not individual-person pins.
- Popups show location, incident count, type breakdown, and date range.
