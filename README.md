# counting.gg frontend

[![ci](https://github.com/counting-dot-gg/frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/counting-dot-gg/frontend/actions/workflows/ci.yml)
[![licence](https://img.shields.io/badge/licence-Apache--2.0-blue)](LICENSE)

The website at [counting.gg](https://counting.gg): threads, the count box,
stats, bingo, the home page park and everything else you see in the browser.
Written in TypeScript with Next.js and React.

The site gets its data from the API and the live socket in
[counting-dot-gg/backend](https://github.com/counting-dot-gg/backend). Without
the backend running the site still opens, with a banner saying it can't reach
the server.

- [Quickest: let an AI assistant do it](#quickest-let-an-ai-assistant-do-it)
- [Windows](#windows)
- [Linux (Ubuntu / Debian)](#linux-ubuntu--debian)
- [Mac](#mac)
- [With the backend](#with-the-backend)
- [Check a change](#check-a-change)
- [If something goes wrong](#if-something-goes-wrong)

## Quickest: let an AI assistant do it

[Claude Code](https://claude.com/claude-code) and
[Codex](https://developers.openai.com/codex) can install everything and start
the site for you. This repo includes instructions they read automatically.

1. Install one of them, following its install page.
2. Open a terminal (see step 1 for [Windows](#1-open-a-terminal),
   [Linux](#1-open-a-terminal-1) or [Mac](#1-open-a-terminal-2)) and start it
   by typing `claude` or `codex`.
3. Paste this and follow along, approving each step it asks about:

   ```
   Clone https://github.com/counting-dot-gg/backend and
   https://github.com/counting-dot-gg/frontend, set up both on my computer by
   following their READMEs, start them, and open the site.
   ```

## Windows

### 1. Open a terminal

Press the **Windows key**, type `PowerShell`, and click **Windows
PowerShell**. A window with a blinking cursor opens. That's the terminal:
you type a command, press **Enter**, and wait for it to finish.

### 2. Install the tools

Copy each line into the terminal, press **Enter**, and wait for it to finish
before the next one. Click **Yes** if Windows asks for permission.

```
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
```

- **Git** downloads the code.
- **Node.js** runs the site.

Then close PowerShell and open it again, so it finds the new tools.

### 3. Download the code

```
cd ~\Documents
git clone https://github.com/counting-dot-gg/frontend.git
cd frontend
copy .env.example .env.local
```

### 4. Install and run

```
npm ci
npm run dev
```

The first `npm ci` takes a few minutes. When you see `Ready`, open
[http://localhost:3000](http://localhost:3000). Leave the terminal open while
you use the site.

## Linux (Ubuntu / Debian)

### 1. Open a terminal

Press **Ctrl + Alt + T**, or open **Terminal** from your apps.

### 2. Install the tools

```
sudo apt update
sudo apt install -y git curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close the terminal and open a new one, then:

```
nvm install --lts
```

Type your password if asked (nothing shows while you type; that's normal).

### 3. Download the code

```
cd ~
git clone https://github.com/counting-dot-gg/frontend.git
cd frontend
cp .env.example .env.local
```

### 4. Install and run

```
npm ci
npm run dev
```

When you see `Ready`, open [http://localhost:3000](http://localhost:3000).

## Mac

### 1. Open a terminal

Press **Cmd + Space**, type `Terminal`, and press **Enter**.

### 2. Install the tools

```
xcode-select --install
```

Click **Install** in the window that pops up; that gives you Git. Then
install the **LTS** version of [Node.js](https://nodejs.org) and close and
reopen Terminal.

### 3 and 4

Same as [Linux, step 3](#3-download-the-code-1) onwards.

## With the backend

Set up the backend by following
[its README](https://github.com/counting-dot-gg/backend#readme) and leave it
running. The defaults in `.env.local` already point at a backend on the same
computer, so start the site as above and it connects.

| Setting in `.env.local` | Points at | Default |
|---|---|---|
| `API_HOST`, `NEXT_PUBLIC_API_HOST` | the API | `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_HOST`, `NEXT_PUBLIC_SOCKET_LOCAL` | the live socket | `http://localhost:8805` |

The other settings are optional: each page that needs one shows nothing
without it.

- **Stop the site:** press **Ctrl + C** in its terminal.
- **Start it again:** `npm run dev`

## Check a change

```
npx tsc --noEmit
npm run lint
npm run build
```

Every pull request runs all three. `npm run build` runs the lint first. In VS
Code, install the recommended ESLint extension when asked: it underlines
problems as you type and fixes what it can when you save. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## If something goes wrong

| You see | Do this |
|---|---|
| `git` / `npm` / `node` is not recognized, or command not found | Close the terminal and open a new one. If that doesn't help, restart the computer. |
| `Unsupported engine` or `required: { node: …` | Your Node.js is too old. Install the current LTS version (step 2). |
| `EADDRINUSE` … `3000` | Something else uses port 3000. Stop it, or run `npm run dev -- -p 3002` and open `http://localhost:3002`. |
| A red banner saying the server can't be reached | The backend isn't running, or `.env.local` points somewhere else. See [With the backend](#with-the-backend). |
| `npm ci` stops with an error | Copy the last 20 lines and open an issue on GitHub. |

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
