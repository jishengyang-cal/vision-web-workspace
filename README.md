# vision-web-workspace

Spatial remote web workspace shell for Apple Vision Pro style workflows.

The first target is not a monitoring wall and not an IDE built into the app. It
is a Vision Pro web-window shell for remote development surfaces. Each window
opens a browser-addressable remote URL or session: terminal, code editor,
browser, documentation, CI dashboard, logs, or remote app.

The Vision Pro app owns window management, input, copy/paste, bookmarks,
navigation, opacity, and layout persistence. Remote servers own the rendered
content and business logic.

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
- Native system-window remote web surface source using `WindowGroup`.
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
pnpm visionos:testflight:plan
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

For the corrected first-stage remote web window plan, including native window
mode, mixed screen-locked mode, opacity, input, and gateway boundaries, use
`docs/workflows/remote-web-window-workspace.md`.

AWS baseline setup is guarded by a 100 USD budget cap and does not start EC2
Mac:

```bash
pnpm aws:mac:plan
pnpm aws:mac:doctor
pnpm aws:mac:deploy-baseline
pnpm aws:mac:worker:prelaunch
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

Current release mode: Apple account access has an existing issue under review.
The project continues in implementation-first mode. Build the full feature set,
run local and Mac Builder control-plane checks, and keep completed features
ready for TestFlight. Upload, tester assignment, and local Vision Pro acceptance
resume after Apple approval.

Without a local Mac, real Vision Pro device testing is driven through the cloud
Mac Builder and TestFlight:

```bash
VISIONOS_MAC_BUILDER_URL=http://<mac-builder-host>:3201 \
APPLE_TEAM_ID=<team id> \
pnpm visionos:testflight:preflight

VISIONOS_MAC_BUILDER_URL=http://<mac-builder-host>:3201 \
APPLE_TEAM_ID=<team id> \
pnpm visionos:testflight:archive
```

TestFlight upload is a separate opt-in gate. Set
`VISIONOS_TESTFLIGHT_UPLOAD=1` on the operator side and
`MAC_BUILDER_ENABLE_TESTFLIGHT_UPLOAD=1` on the Mac Builder only after signing
and App Store Connect API key material are configured on the Mac Builder.

Install local git hooks:

```bash
pnpm hooks:install
```

## Next build targets

- Extend the shared window contract with opacity, remote surface mode,
  bookmark references, 3D pose, and lock mode.
- Add max-10 window enforcement across the window manager and gateway.
- Validate native remote web windows on Mac Builder and TestFlight with system
  keyboard, dictation, copy/paste, bookmarks, navigation, and opacity controls.
- Convert the mixed workspace prototype from one panel into a menu plus
  independent spatial remote web windows.
- Add real terminal gateway integration with ttyd or xterm.js.
- Add remote browser gateway integration with noVNC, KasmVNC, Xpra, or WebRTC.
- Add Playwright tests for move, resize, focus, opacity, and session creation.
- Add device-lab and release adapters after Apple Developer Program setup.
