<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Code: no comments

No `//`, `/* */`, JSX `{/* */}` or JSDoc, in code, CSS and inline styles alike. Code explains itself through names, small functions and types. If something is so unusual that it seems to need a comment, tell the user in chat instead of writing one. Tool directives (`eslint-disable…`, `@ts-expect-error`) are the only exception.

# UI: no explanatory text

If a screen needs a sentence to explain itself, the design is wrong: fix the layout, colour, ordering or grouping instead. No captions describing a section, no status prose where the data could be shown ("3 players in the lobby." → show the players by team), no statements of the obvious, no help text under fields, no labels repeating a value already on screen, no instructions for using a control. Empty states are a few words or nothing.

Check light and dark mode; use theme tokens (`var(--foreground)`, `var(--muted-foreground)`, …), never hard-coded colours.

# Checks

Run `npx tsc --noEmit` and `npm run lint` before finishing a change. `eslint-suppressions.json` holds the lint errors the code had when the repo opened: never add to it. When a change fixes some of them, run `npx eslint --prune-suppressions` so they can't come back.
