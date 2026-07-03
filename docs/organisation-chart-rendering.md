# Organisation Chart Rendering Notes

The organisation slideout chart is rendered from Settings -> Organisation, Bases & Areas and Settings -> Units & Ownership. The chart must keep working as customers define different numbers of organisation levels and different parent/child relationships.

## Connector Geometry

Use one consistent orthogonal connector pattern for every parent/child level:

1. Draw a vertical drop from the parent box.
2. Draw the horizontal rail below the parent.
3. Draw a vertical drop from the rail to each child box.
4. Place child boxes lower than the rail so the elbow is visible.

Do not let connector lines run through boxes. The current implementation does this by:

- drawing horizontal rails on the child `li` pseudo-elements
- drawing incoming vertical drops on the child `.org-chart-box::before`
- drawing stacked vertical-list continuation lines on `.org-chart-box::after`
- keeping boxes opaque and above the connector layer with `z-index`
- using `box-sizing: border-box` and fixed level box sizes where alignment matters

The key lesson is that vertical connector endpoints should be attached to the box border, not guessed from the list item height. Guessing creates the visual faults we saw: lines finishing short, lines overshooting into the middle of the box, or two separate lines almost meeting but not quite aligning.

## Level Layout Rules

The chart supports a flexible organisation hierarchy, but it deliberately does not show every configured level at once.

Default view:

- Level 0: single organisation root, centred.
- Level 1: command level, horizontal.
- Level 2: group level, horizontal, fixed-size compact boxes.
- Level 3: wing level, horizontal, fixed-size compact boxes.

Interactive drill-down:

- Clicking any entity highlights that entity and its full parent chain with a green border.
- Clicking Level 0, 1, or 2 keeps the default Level 0-3 view visible while showing the selected chain.
- Clicking Level 3 or deeper focuses the view on that chain of command only.
- In focused mode, siblings outside the selected chain disappear.
- The selected Level 3+ entity displays only its immediate children underneath it.
- Those children are listed vertically to save width.
- The same pattern repeats until the lowest configured level is selected.

The vertical stacking starts at the focused Level 3+ entity. The older `SQN`/`Squadron` fallback remains available for unfocused structures that need vertical stacking beyond the configured organisation levels.

## Maintenance Guidance

When changing this chart:

- Keep connector drawing split by responsibility: rails on list items, vertical drops on boxes.
- Avoid rounded-corner connector hacks unless the rail/drop endpoints are mathematically tied together.
- Avoid hard-coded assumptions about RAAF-specific names except the current `SQN`/`Squadron` stacking detection.
- If adding another fixed-size level, add both `org-chart-node-level-N` and `org-chart-box-level-N` rules.
- Test with branches that have one child, several children, vertically stacked children, and deeper-than-Level-4 children.
- Test both default view and focused drill-down view.
