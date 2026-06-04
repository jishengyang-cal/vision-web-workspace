---
name: visionos-dev
description: Use when working on this repository's visionOS or Apple Vision Pro development workflow, including spatial web workspace behavior, native visionOS planning, Xcode/Mac-builder boundaries, simulator/device testing, deployment, debugging, or compliance checks.
---

# visionos-dev

Use this skill for `vision-web-workspace` tasks that touch visionOS, Apple
Vision Pro, Xcode, SwiftUI/RealityKit plans, simulator/device testing,
deployment, or the spatial web development workflow.

## First checks

1. Read `docs/architecture.md` for product and authority boundaries.
2. Read `docs/workflows/visionos-development.md` for the current staged
   workflow.
3. Run `pnpm visionos:preflight` before claiming a workflow is available.
4. Run `pnpm workflow:check` before committing workflow or architecture changes.

## Capability rules

- Treat the current environment as Linux-first unless a Mac builder is
  explicitly configured and verified.
- Do not claim native visionOS compile, signing, install, official simulator,
  device debug, TestFlight, or App Store submission works locally without
  macOS, Xcode, the visionOS SDK, and the required Apple credentials.
- Use web simulator, gateway, ttyd, code-server, Playwright, and static checks
  for current development.
- Delegate native Xcode work to the future Mac builder MCP. The Vision Pro
  client remains a UI/input surface and must not receive secrets or deployment
  authority.
- Keep Mac-only tools out of Linux-required scripts such as `dev`, `build`,
  `typecheck`, `workflow:check`, and `test:e2e`.

## Workflow selection

- For window behavior, layout, terminal/code/browser sessions, and remote web
  surfaces: use Linux workflows and tests.
- For SwiftUI/RealityKit source planning: update docs, contracts, generators,
  or future native source scaffolds, then stop at Mac-builder handoff.
- For Xcode project generation, xcodebuild, simulator, device install,
  `.xcresult`, signing, archive, TestFlight, or App Store work: use or extend
  the Mac builder/device MCP contracts. If no adapter exists, return a clear
  blocked state and the missing capability.
- For compliance changes: update `scripts/compliance-check.mjs` and keep the
  architecture boundary text intact.

## Useful commands

```bash
pnpm visionos:preflight
pnpm visionos:workflow:plan
pnpm workflow:check
pnpm test:e2e
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) pnpm dev:services
```

## References

- Boundary checklist: `skills/visionos-dev/references/boundaries.md`
- Workflow map: `docs/workflows/visionos-development.md`
- MCP and hook design: `docs/workflows/mcp-and-hooks.md`
