# Tooling

This workflow is Linux-first. It uses GitHub/open-source tools that are useful
without macOS while preserving a clear boundary around tools that require Xcode.

## Current workflow

Run the local environment check:

```bash
pnpm tools:doctor
```

Run the architecture and workflow compliance check:

```bash
pnpm compliance:check
```

Run the visionOS workflow preflight and workflow planner:

```bash
pnpm visionos:preflight
pnpm visionos:workflow:plan
pnpm test:mac-builder
```

Run the full local workflow gate:

```bash
pnpm workflow:check
```

Start browser-based developer surfaces for the spatial windows:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) pnpm dev:services
```

The services bind to loopback only:

```text
ttyd:        http://127.0.0.1:7681
code-server: http://127.0.0.1:8080
```

## Tool classes

### Directly usable now

- Node.js, pnpm, Git, Docker, Docker Compose.
- Playwright for web simulator smoke tests and later visual regression.
- glTF Validator for future 3D asset checks.
- Mock Mac Builder for Linux-side build adapter lifecycle tests.
- ttyd through Docker for a browser terminal window.
- code-server through Docker for a browser IDE window.

### Useful but optional in this Linux environment

- SourceKit-LSP and swift-format when a Linux Swift toolchain is installed.
- OpenUSD when asset conversion/inspection is needed on Linux.

### Mac-builder only

- Xcode, xcodebuild, xcrun, simctl, xcresulttool, Reality Composer Pro,
  Apple Transporter, XcodeGen, Tuist, XcodeProj, and real visionOS
  simulator/device/release workflows.

These tools must not be required by `dev`, `build`, `typecheck`, or
`workflow:check` in the Linux workflow.

### Cloud Mac builder

- AWS EC2 Mac for real native build/test/archive execution.
- AWS CLI, SSM Session Manager, S3, CloudWatch, KMS, IAM, and Secrets Manager
  for provisioning, access, artifacts, logs, encryption, and secret boundaries.

The AWS workflow is documented in `docs/workflows/aws-ec2-mac-builder.md`.

## Hooks and MCP

- Install local hooks with `pnpm hooks:install`.
- MCP interface contracts live in `mcp/interfaces`.
- Run the local mock builder with `pnpm dev:mac-builder:mock`.
- Point the adapter client at it with
  `VISIONOS_MAC_BUILDER_URL=http://127.0.0.1:3101 pnpm visionos:mac-build:check`.
- The current repository does not execute native Xcode builds locally without
  a verified builder URL. Use `pnpm visionos:mac-build:check` to verify that
  boundary.

## Researched sources

- SourceKit-LSP: https://github.com/swiftlang/sourcekit-lsp
- swift-format: https://github.com/swiftlang/swift-format
- XcodeGen: https://github.com/yonaskolb/XcodeGen
- Tuist: https://github.com/tuist/tuist
- XcodeProj: https://github.com/tuist/XcodeProj
- Awesome visionOS: https://github.com/tomkrikorian/awesome-visionOS
- WebXR samples: https://github.com/immersive-web/webxr-samples
- WebKit Vision Pro WebXR natural input: https://webkit.org/blog/15162/introducing-natural-input-for-webxr-in-apple-vision-pro/
- Playwright: https://github.com/microsoft/playwright
- ttyd: https://github.com/tsl0922/ttyd
- code-server: https://github.com/coder/code-server
- noVNC: https://github.com/novnc/noVNC
- KasmVNC: https://github.com/kasmtech/KasmVNC
- OpenUSD: https://github.com/PixarAnimationStudios/OpenUSD
- glTF Validator: https://github.com/KhronosGroup/glTF-Validator
