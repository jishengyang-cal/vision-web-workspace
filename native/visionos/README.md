# Native visionOS Shell

This directory contains the first native SwiftUI/RealityKit shell for the
workspace. It is source and project metadata only. Linux workflow commands may
inspect these files and create Mac Builder requests, but native project
generation and `xcodebuild` execution must run on a Mac Builder or local Mac
with Xcode and the visionOS SDK.

## Mac Builder inputs

```text
sourceRoot: native/visionos
generator: xcodegen
generatorSpecPath: native/visionos/project.yml
projectPath: native/visionos/VisionWebWorkspace.xcodeproj
scheme: VisionWebWorkspace
configuration: Debug
destination: platform=visionOS Simulator,name=Apple Vision Pro
sdk: xrsimulator
```

## Native execution commands

These commands are documented for the Mac Builder worker. They are not Linux
workflow commands.

```bash
xcodegen generate --spec native/visionos/project.yml

xcodebuild \
  -project native/visionos/VisionWebWorkspace.xcodeproj \
  -scheme VisionWebWorkspace \
  -configuration Debug \
  -destination "platform=visionOS Simulator,name=Apple Vision Pro" \
  -sdk xrsimulator \
  build
```

The current app exposes both public-API window paths:

- `WorkspaceConstants.nativeWebWindowGroupID`: native system windows that host
  remote web surfaces. The system owns window movement, resizing, focus,
  keyboard input, and dictation. The app owns URL navigation, bookmarks, copy
  URL, opacity, and window lifecycle state.
- `WorkspaceConstants.immersiveSpaceID`: mixed passthrough web workspace.
- `WorkspaceConstants.officeEnvironmentSpaceID`: full office environment.
- `WorkspaceConstants.loungeEnvironmentSpaceID`: full water lounge environment.

The environment prototypes are procedural RealityKit blockouts under
`ImmersiveEnvironmentSceneFactory.swift`. They are intentionally source-first
so the Linux workflow can review and version them before the Mac Builder
replaces high-risk pieces with USDZ or Reality Composer Pro scene assets.

`WKWebView` is included for native webpage window prototyping; if attachment
stability becomes a blocker on device, the same panel can display a remote
browser stream from the gateway instead.

## Current product direction

The native client is a remote web window shell. It does not own the terminal,
IDE, dashboard, or remote app content. Each window displays a browser-based
remote server surface, while the Vision Pro app owns the local window shell:
navigation, bookmarks, opacity, input, copy/paste, layout, and spatial
placement.

Native Web Window Mode is the first validation target because it gives the
closest public-API behavior for keyboard input, system dictation, copy/paste,
focus, and system-level window adjustment. The mixed immersive workspace
remains the follow-up target for screen-locked custom windows with independent
scale, rotation, angle, opacity, and lock state.

The detailed first-stage plan is
`docs/workflows/remote-web-window-workspace.md`.
