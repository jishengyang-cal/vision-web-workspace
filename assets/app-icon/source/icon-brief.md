# Vision Web Workspace App Icon Brief

## Purpose

The icon represents a spatial browser workspace: remote web surfaces, multiple
windows, and a Vision Pro shell that controls placement rather than owning the
remote content.

## Design Contract

- Background layer: dark spatial depth field.
- Middle layer: overlapping translucent browser surfaces.
- Foreground layer: controlled browser shell and spatial workspace mark.
- Canvas: 1024x1024 pixels per layer.
- Output: Xcode asset catalog `AppIcon.solidimagestack` for visionOS.

## Workflow

1. Update the source SVGs in this directory when the visual direction changes.
2. Update `scripts/generate-app-icon.mjs` if the generated geometry changes.
3. Run `pnpm assets:app-icon:generate`.
4. Run `pnpm assets:app-icon:check`.
5. Run the normal workflow checks and Mac Builder build.

The generated asset catalog is committed because Xcode requires concrete PNG
layers during the remote Mac build.
