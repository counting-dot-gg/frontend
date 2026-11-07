# Contributing

Thanks for helping. Start with the [README](README.md) to get the site
running. Using Claude Code or Codex is the easiest way in: both read
`AGENTS.md`, which holds the project's rules.

## Making a change

1. Fork the repo and make a branch.
2. Make your change. Keep it to one thing.
3. Run the checks:

   ```
   npx tsc --noEmit
   npm run lint
   npm run build
   ```

4. Check what you changed in both light and dark mode.
5. Open a pull request saying what changed and why, with a screenshot if it
   changes what's on screen.

## What CI checks on every pull request

- **Types:** `npx tsc --noEmit` finds nothing.
- **Lint:** `npm run lint` finds no new errors.
- **Build:** `npm run build` succeeds.
- **Setup:** a fresh clone installs with `npm ci`, starts, and serves the
  home page.

The code had lint errors when the repo opened. They're recorded in
`eslint-suppressions.json`, so lint only fails on new ones. Don't add to that
file. If your change fixes some of them, run
`npx eslint --prune-suppressions` and commit the smaller file.

## Code style

- No comments. Names, small functions and types should make the code
  clear. If something truly needs explaining, say so in the pull request
  instead. Tool directives such as `eslint-disable-next-line` are the only
  exception.
- Use theme tokens (`var(--foreground)`, `var(--muted-foreground)`,
  `var(--card)`, …), never hard-coded light or dark colours.
- No explanatory text in the UI: if a screen needs a sentence to explain
  itself, change the layout, colour or grouping instead.
- Lint: VS Code fixes what it can on save once you install the recommended
  ESLint extension. Otherwise run `npm run lint` before you commit.

## Conduct and security

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Where things are

| Folder | Contents |
|---|---|
| `app` | pages and route handlers |
| `components` | shared React components (`thread`, `home`, `bingo`, `layout`, …) |
| `lib` | client and server helpers: API and socket clients, formatting, macros |
| `public` | static files |
| `scripts` | small maintenance scripts |
