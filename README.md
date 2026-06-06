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
  mac-builder-mock/    Mock Mac builder control-plane service.
  mac-builder-agent/   Native macOS worker for XcodeGen and xcodebuild.

native/
  visionos/            SwiftUI/RealityKit app shell and XcodeGen spec.

docs/
  architecture.md      Product and system architecture notes.
  workflows/           visionOS, MCP, and hook workflow documents.

skills/
  visionos-dev/        Agent skill source for this repository.

mcp/
  interfaces/          Planned MCP capability contracts.

workflows/
  visionos-development.json
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
- Native visionOS SwiftUI/RealityKit source skeleton and XcodeGen project spec.
- Full immersive office and water lounge RealityKit environment prototypes.
- Structured Mac Builder request metadata for the native project path.
- Native Mac Builder Agent package for the real macOS execution plane.

## Workflow checks

```bash
pnpm tools:doctor
pnpm compliance:check
pnpm visionos:preflight
pnpm visionos:workflow:plan
pnpm visionos:native:plan
pnpm workflow:check
pnpm test:mac-builder
```

Start local developer surfaces for Terminal and Code windows:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) pnpm dev:services
```

Start the mock Mac builder and send a build job through the adapter:

```bash
pnpm dev:mac-builder:mock
VISIONOS_MAC_BUILDER_URL=http://127.0.0.1:3101 pnpm visionos:mac-build:check
```

On a real Mac Builder host, bootstrap the native agent:

```bash
scripts/mac-builder-bootstrap.sh
VISIONOS_MAC_BUILDER_URL=http://<mac-builder-host>:3201 pnpm visionos:mac-build:check
```

For a real remote Mac execution plane, use the AWS EC2 Mac builder workflow in
`docs/workflows/aws-ec2-mac-builder.md`.

For the office and water lounge environment reconstruction, use
`docs/workflows/immersive-environments.md`. The current native app exposes the
original mixed web workspace plus two full immersive scene entries.

AWS baseline setup is guarded by a 100 USD budget cap and does not start EC2
Mac:

```bash
pnpm aws:mac:plan
pnpm aws:mac:doctor
pnpm aws:mac:deploy-baseline
pnpm aws:mac:worker:quota-status
pnpm aws:mac:worker:cost-status
pnpm aws:mac:worker:price-check
```

When AWS approves the EC2 Mac quota, launch and connect through SSM:

```bash
AWS_MAC_WORKER_CONFIRM=allocate-24h-mac-host pnpm aws:mac:worker:launch
pnpm aws:mac:worker:ssm-tunnel
```

Release the worker only through the guarded teardown command:

```bash
AWS_MAC_WORKER_CONFIRM=terminate-and-release-mac-host pnpm aws:mac:worker:teardown
```

For App Store/TestFlight release planning, signing checks, IPA validation, and
optional upload-tool evaluation, use `docs/workflows/app-store-release.md`.

Install local git hooks:

```bash
pnpm hooks:install
```

## Next build targets

- Add real terminal gateway integration with ttyd or xterm.js.
- Add remote browser gateway integration with noVNC, KasmVNC, Xpra, or WebRTC.
- Add Playwright tests for move, resize, focus, and session creation.
- Add a Mac Builder worker that generates the Xcode project and runs `xcodebuild`.
- Add device-lab and release adapters after Apple Developer Program setup.
