# visionos-dev Boundary Checklist

Use this checklist when planning or editing visionOS workflow features.

## Allowed in the Linux workflow

- TypeScript contracts for windows, sessions, layouts, capabilities, and audit
  events.
- Browser simulator development and Playwright tests.
- Gateway session descriptors and loopback developer services.
- Docker-backed ttyd, code-server, future remote browser streams, and asset
  validators.
- Documentation, workflow plans, and compliance checks.

## Requires Mac builder

- Xcode project generation that needs Apple tooling.
- `xcodebuild`, `xcrun`, Simulator, `simctl`, `xcresulttool`, archive/export,
  signing, provisioning, and native install flows.
- Reality Composer Pro workflows that require macOS UI tools.

## Requires Apple account or device

- Registering devices, provisioning profiles, distribution certificates,
  TestFlight, App Store Connect, and Apple Vision Pro device testing.

## Secret handling

Never route these to the Vision Pro or browser client:

- SSH private keys.
- GitHub tokens.
- Signing certificates.
- Provisioning profiles.
- App Store Connect credentials.
- Production deployment credentials.

Keep those in gateway, Imperativ, Mac builder, CI, or device lab boundaries with
audit logs and explicit approval.
