# Immersive Environment Reconstruction Workflow

This workflow maps the local reference images into native visionOS full
immersive environments. It keeps the Linux repository useful for source,
contracts, scene planning, and validation, while preserving the Apple boundary:
Reality Composer Pro, Xcode, the visionOS simulator, device install, and
profiling run on the Mac Builder.

## Source references

Local source directory:

```text
/home/jisheng-yang/桌面/待落地项目/VisionPro项目开发/visionpro环境搭建
```

Reference groups:

- `办公室环境`: dark ordered office, repeated desks, concrete columns, black
  walls, polished desktops, desk lamps, typed terminal props, strong central
  runway line.
- `会客厅环境`: warm stone water lounge, central platform, meeting table, sofas,
  surrounding water, wall/ceiling/furniture water caustic reflections, warm
  ceiling light wells.

## visionOS presentation model

The app keeps three presentation modes:

- Mixed workspace: `WorkspaceConstants.immersiveSpaceID`, existing mixed
  passthrough mode for head-locked web windows.
- Office environment: `WorkspaceConstants.officeEnvironmentSpaceID`, full
  immersive mode.
- Water lounge environment: `WorkspaceConstants.loungeEnvironmentSpaceID`, full
  immersive mode.

Full spaces are required for the two reconstructed rooms because the app needs
to replace passthrough and control the visual world. The web workspace remains
available inside each environment as a RealityKit attachment, so terminal,
code-server, browser, logs, and docs windows still run through the Gateway.

## Current implementation

The first implementation is procedural RealityKit source:

```text
native/visionos/VisionWebWorkspace/Models/ImmersiveEnvironmentSceneFactory.swift
native/visionos/VisionWebWorkspace/Models/WaterLoungeSceneSpec.swift
native/visionos/VisionWebWorkspace/WaterLoungeSceneSpec.json
native/visionos/VisionWebWorkspace/Views/ImmersiveEnvironmentView.swift
```

This gives the Mac Builder a native source target without requiring binary
assets in the repository. It also creates a clear asset replacement path:
procedural room blockout first, USDZ/Reality Composer Pro scene second.

The water lounge now uses a reference-driven scene spec for the room scale,
water surface, central square platform, separated bridge slabs, furniture, and
caustic density. The Swift factory owns only the native rendering projection:
stone wall panels, black-gold water, leather sofas, concrete tea table, warm
ceiling light wells, and animated water-caustic projection strips.

The dynamic projection pass is driven from `ImmersiveEnvironmentView` through
`TimelineView(.animation)`. It animates only entities named with the lounge
water/caustic prefixes, so the Gateway-backed workspace panel and remote web
window controls remain outside the scene animation logic.

## Asset pipeline

1. Build procedural blockouts in Swift/RealityKit.
2. Capture simulator screenshots and device captures from Mac Builder.
3. Convert approved model assets to USDZ or Reality Composer Pro scenes.
4. Replace repeated programmatic props with packaged assets:
   desks, lamps, sofas, table, stone panels, water surface, wall modules.
5. Replace static caustic strips with MaterialX or shader graph materials in
   Reality Composer Pro.
6. Add spatial audio beds only after scene scale and movement are stable.
7. Profile GPU/CPU on Apple Vision Pro before increasing reflection fidelity.

## Testing workflow

Linux:

```bash
pnpm workflow:check
pnpm test:e2e
pnpm test:mac-builder
```

Mac Builder:

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

Simulator test requests and `.xcresult` collection should be submitted through
the Mac Builder adapter instead of running Xcode locally.

Device test:

- Enable Developer Mode on Apple Vision Pro.
- Pair the device with Xcode on the Mac Builder or a trusted local Mac.
- Install a development-signed build.
- Test both full immersive environments on hardware because Simulator does not
  fully represent performance, stereoscopy, comfort, water shimmer, or material
  response.

## Acceptance criteria

- The launcher can open and close the mixed workspace, office environment, and
  water lounge environment.
- Only one immersive space is active at a time.
- The office environment shows a complete room, desk grid, columns, lamps,
  dark materials, and central runway line.
- The water lounge environment shows surrounding water, central platform,
  sofas/table, warm stone room shell, ceiling light wells, and water caustic
  reflection layers.
- The water lounge central area is a square platform over water, reached by
  separated rectangular concrete slabs with visible water gaps.
- The lounge caustic layers move subtly across walls, platform, bridge slabs,
  sofa surfaces, and the concrete tea table without moving the web workspace
  attachment.
- The Gateway-backed web workspace panel remains usable in both environments.
- No Apple credentials, signing assets, or proprietary 3D asset licenses enter
  the Vision Pro client or repository.

## Apple references

- Immersive spaces:
  https://developer.apple.com/documentation/swiftui/immersive-spaces
- Creating immersive spaces with SwiftUI and RealityKit:
  https://developer.apple.com/documentation/visionos/creating-immersive-spaces-in-visionos-with-swiftui
- Creating fully immersive experiences:
  https://developer.apple.com/documentation/visionos/creating-fully-immersive-experiences/
- Adding 3D content to visionOS apps:
  https://developer.apple.com/documentation/visionos/adding-3d-content-to-your-app
- Combining 2D and 3D views with RealityView attachments:
  https://developer.apple.com/documentation/RealityKit/combining-2d-and-3d-views-in-an-immersive-app
- Shader Graph and MaterialX in Reality Composer Pro:
  https://developer.apple.com/documentation/shadergraph/
- Running apps in Simulator or on device:
  https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device
