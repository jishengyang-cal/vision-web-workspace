# vision-web-workspace

Spatial web development workspace for Apple Vision Pro style workflows.

The first target is not a monitoring wall. It is a head-locked, movable web
window desktop where each window can host a terminal, code editor, browser,
documentation, CI dashboard, or remote app.

## Hard boundary

Without macOS, Xcode, and the visionOS SDK this repository cannot compile,
sign, install, or run a native visionOS app in Apple's official simulator.

The Linux-first development loop is:

1. Define workspace, window, and session contracts.
2. Run the browser simulator.
3. Test movable web windows, terminal sessions, and remote browser sessions.
4. Generate native visionOS shell source later.
5. Send native build jobs to an audited Mac builder when one exists.

## Repository layout

```text
apps/
  web-simulator/       Browser-based spatial workspace simulator.

packages/
  contracts/           Shared specs for windows, sessions, and layouts.
  window-manager/      Pure TypeScript window state reducer.

services/
  gateway/             Minimal session gateway skeleton.

docs/
  architecture.md      Product and system architecture notes.
```

## Quick start

```bash
pnpm install
pnpm dev
```

Default local services:

```text
web-simulator: http://localhost:5180
gateway:       http://localhost:3001
```

The simulator opens a workspace with Terminal, Code, and Browser windows. The
default URLs can be changed with environment variables:

```bash
VITE_TERMINAL_URL=http://localhost:7681 \
VITE_CODE_URL=http://localhost:8080 \
VITE_BROWSER_URL=https://example.com \
pnpm dev
```

Run the gateway skeleton:

```bash
pnpm dev:gateway
```

Run the web simulator:

```bash
pnpm dev:web
```

Serve the built simulator:

```bash
pnpm build
pnpm serve:gateway
pnpm serve:web
```

Gateway session defaults:

```bash
TERMINAL_URL=http://localhost:7681
CODE_URL=http://localhost:8080
BROWSER_URL=https://example.com
```

## Current MVP

- Head-locked workspace simulation in a normal browser.
- Movable, resizable, focusable web windows.
- Terminal, Code, Browser, Docs, and Logs window kinds.
- Layout save and restore in local storage.
- Shared contracts for future Imperativ and visionOS adapters.
- Minimal gateway endpoints for controlled session creation.
- Tool doctor and workflow compliance checks.
- Docker-backed local terminal and code-server services.

## Workflow checks

```bash
pnpm tools:doctor
pnpm compliance:check
pnpm workflow:check
```

Start local developer surfaces for Terminal and Code windows:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) pnpm dev:services
```

## Next build targets

- Add real terminal gateway integration with ttyd or xterm.js.
- Add remote browser gateway integration with noVNC, KasmVNC, Xpra, or WebRTC.
- Add Playwright tests for move, resize, focus, and session creation.
- Add a native SwiftUI/RealityKit shell generator.
- Add an optional audited Mac builder adapter.
