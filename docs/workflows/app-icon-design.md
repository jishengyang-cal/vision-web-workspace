# App Icon Design Workflow

This workflow turns the app icon into a reproducible asset pipeline instead of
a manual Xcode-only step. The Linux workspace owns source review and generation;
the Mac Builder owns final Xcode asset catalog compilation.

## Design Direction

Vision Web Workspace is a spatial remote web shell. The icon uses three
visionOS layers:

- Back: dark spatial depth field.
- Middle: translucent overlapping browser surfaces.
- Front: controlled browser shell mark.

The icon must describe the shell product boundary. It should not imply that the
Vision Pro app owns the terminal, IDE, SSH server, or remote application
content.

## Source Assets

Editable source references live in:

```text
assets/app-icon/source/
  icon-brief.md
  background.svg
  middle.svg
  foreground.svg
```

The SVGs are the human-readable design surface. The committed Xcode asset
catalog is generated from the repository script so a build can run without
opening a design tool.

## Generated Xcode Assets

The generated visionOS image stack lives in:

```text
native/visionos/VisionWebWorkspace/Assets.xcassets/
  AppIcon.solidimagestack/
    Front.solidimagestacklayer/
    Middle.solidimagestacklayer/
    Back.solidimagestacklayer/
```

Each layer provides a 1024x1024 8-bit RGBA PNG for the `vision` idiom. Xcode
uses the `AppIcon` image stack through `ASSETCATALOG_COMPILER_APPICON_NAME`.

## Commands

Generate the committed asset catalog:

```bash
pnpm assets:app-icon:generate
```

Check the asset catalog without rewriting it:

```bash
pnpm assets:app-icon:check
```

Run the normal local gate:

```bash
pnpm workflow:check
```

Run the real Mac Builder build after the commit has been pushed:

```bash
source .run/aws-mac-builder/mac-builder.env
pnpm visionos:mac-build:check
```

## Apple Boundary

Apple's visionOS icon guidance requires an app icon configured through the
asset catalog, with visionOS using layered image stack assets. The repository
can generate the files, but Xcode remains the authority for compiling and
validating them.

The workflow must not store Apple account credentials, signing identities,
provisioning profiles, or App Store Connect keys in the repository. Icon assets
are safe to track because they are static product artwork, not signing
authority.

## Open-Source Tooling Position

External icon packs or generators can be used as references, but the committed
pipeline should remain local and reviewable:

- Penpot or Inkscape can edit the SVG source.
- Tabler Icons, Iconoir, Lucide, or Phosphor can provide permissive foreground
  glyph references when a future redesign needs them.
- visionOS-specific output must still be checked by the Mac Builder Xcode
  workflow.
