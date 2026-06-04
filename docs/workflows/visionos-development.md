# visionOS Development Workflow

This document turns the official Apple visionOS development path into project
workflows. It is a workflow map, not a replacement for Apple's documentation.

## Hard boundary

Native visionOS compilation, signing, installation, official simulator runs,
device debugging, TestFlight upload, and App Store submission require macOS,
Xcode, the visionOS SDK, signing assets, and in some stages Apple Developer
Program access.

The Linux environment can prepare source, contracts, web simulator behavior,
remote web development surfaces, static checks, and workflow plans. It must not
pretend to run Apple's native visionOS toolchain.

## Capability labels

- `linux-runnable`: can run in this repository today.
- `mac-builder-required`: requires a Mac host with Xcode and the visionOS SDK.
- `apple-account-required`: requires Apple Developer Program or App Store
  Connect access.
- `device-required`: requires Apple Vision Pro or another Apple target device.
- `mcp-candidate`: should later be exposed through an audited MCP adapter.

## Workflow stages

| Stage | Capability | Current command | Outcome |
| --- | --- | --- | --- |
| Tool preflight | linux-runnable | `pnpm visionos:preflight` | Confirms Linux tools, repo rules, and Mac-builder boundary. |
| Workflow plan | linux-runnable | `pnpm visionos:workflow:plan` | Prints the staged development path and required capabilities. |
| Web simulator | linux-runnable | `pnpm dev:web` | Tests spatial web windows, movement, resize, focus, and session URLs. |
| Gateway sessions | linux-runnable | `pnpm dev:gateway` | Exposes controlled terminal/code/browser session descriptors. |
| Developer surfaces | linux-runnable | `pnpm dev:services` | Starts ttyd and code-server loopback services for window content. |
| Local gate | linux-runnable | `pnpm workflow:check` | Runs tool doctor, compliance check, typecheck, and build. |
| Web e2e | linux-runnable | `pnpm test:e2e` | Verifies browser simulator and gateway smoke behavior. |
| Mock Mac builder | linux-runnable, mcp-candidate | `pnpm dev:mac-builder:mock` | Simulates Mac builder job lifecycle without running Xcode. |
| Mac builder e2e | linux-runnable, mcp-candidate | `pnpm test:mac-builder` | Verifies build job request, polling, logs, artifacts, `.xcresult`, and failure handling. |
| AWS EC2 Mac builder plan | mac-builder-required, mcp-candidate | documented workflow | Defines Dedicated Host, bootstrap, artifact, audit, and teardown workflow. |
| Swift source intelligence | optional-swift-toolchain | none yet | Future SourceKit-LSP and swift-format checks when Swift exists on Linux. |
| Native project generation | mac-builder-required | future Mac builder MCP | Generates or updates Xcode project state. |
| Native build | mac-builder-required | `pnpm visionos:mac-build:check` | Checks that native build must be delegated to Mac builder. |
| Official simulator debug | mac-builder-required | future Mac builder MCP | Runs visionOS simulator, captures logs, screenshots, and `.xcresult`. |
| Device test | mac-builder-required, device-required | future device lab MCP | Installs and tests on paired Apple Vision Pro. |
| TestFlight/App Store | mac-builder-required, apple-account-required | future release MCP | Archives, signs, exports, and uploads through Apple tooling. |

## Development loop in this repository

1. Edit contracts, window model, gateway behavior, and simulator UI.
2. Run `pnpm visionos:preflight`.
3. Run `pnpm dev:services` when Terminal/Code windows need real local content.
4. Run `pnpm dev:gateway` and `pnpm dev:web`.
5. Validate window behavior with `pnpm test:e2e`.
6. Validate the Mac builder control plane with `pnpm test:mac-builder`.
7. Run `pnpm workflow:check` before pushing.
8. When native SwiftUI/RealityKit source exists, send build/test jobs to the
   Mac builder MCP instead of running Xcode commands locally.

## Official Apple flow mapped to repo flow

Apple's documented path starts with Xcode and the visionOS SDK, then uses Xcode
to run in Simulator or on device, debug with Xcode tools, capture results, and
submit builds through Apple distribution tooling. This repository maps that
path into three planes:

- Linux preparation plane: web simulator, gateway contracts, tests, docs, and
  asset validation.
- Mac builder plane: Xcode project generation, `xcodebuild`, Simulator,
  signing, `.xcresult`, archive, and export.
- Device/release plane: Vision Pro pairing, install, debug capture,
  TestFlight, and App Store Connect.

AWS EC2 Mac is the preferred remote Mac builder deployment target for the Mac
builder plane. See `docs/workflows/aws-ec2-mac-builder.md`.

The Vision Pro client remains a UI/input surface. It does not receive SSH keys,
GitHub tokens, signing identities, provisioning profiles, App Store Connect
credentials, or deployment authority.

## Apple references

- visionOS documentation: https://developer.apple.com/documentation/visionos
- Build for visionOS: https://developer.apple.com/visionos/
- visionOS Get Started: https://developer.apple.com/visionos/get-started/
- Run apps in Simulator or on device:
  https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device
- Diagnose appearance issues:
  https://developer.apple.com/documentation/xcode/diagnosing-issues-in-the-appearance-of-your-running-app
- Submit apps for Apple Vision Pro:
  https://developer.apple.com/visionos/submit/
