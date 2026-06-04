# App Store and TestFlight Release Workflow

This workflow adapts common cross-platform iOS publishing practices into the
`vision-web-workspace` architecture. It borrows the useful process separation
from AppUploader-style guides while keeping Apple credentials and signing
authority inside controlled builder/release adapters.

## Source practices being adopted

Useful patterns from the referenced workflows:

- Treat publishing as separate stages: account, App ID, certificates,
  provisioning profiles, IPA build, upload, App Store Connect metadata,
  TestFlight, review.
- Separate development signing from App Store distribution signing.
- Validate that certificate type, provisioning profile type, App ID, and Bundle
  ID match before archive/upload.
- Keep build number and version progression explicit.
- Use command-line upload paths for automation where policy allows it.
- Keep a pre-review checklist for privacy strings, capabilities, screenshots,
  metadata, and crash-free TestFlight validation.
- Preserve alternate upload channels for troubleshooting unclear IPA upload
  failures.

Sources:

- https://www.appuploader.net/blog/107
- https://www.appuploader.net/blog/87
- https://www.appuploader.net/blog/122
- https://www.appuploader.net/blog/195
- https://www.appuploader.net/blog/244
- https://www.kxapp.com/
- https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api
- https://developer.apple.com/documentation/appstoreconnectapi/builds
- https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api

## Boundary

Native visionOS IPA creation still requires the Mac Builder plane:

```text
Linux / Vision Web Workspace
  -> prepares source, metadata, release request, audit decision

AWS EC2 Mac Builder
  -> xcodebuild archive/export, signing, xcresult, IPA

Release Adapter
  -> uploads IPA, manages TestFlight/App Store Connect metadata

App Store Connect / TestFlight
  -> Apple processing, beta distribution, review, release
```

The browser simulator and Vision Pro client must not receive:

- Apple ID password.
- app-specific password.
- App Store Connect API private key.
- signing certificate private key.
- `.p12` password.
- provisioning profiles.
- AWS credentials.

## Tool policy

### Preferred official paths

- Xcode / `xcodebuild` for archive and export on the Mac Builder.
- Apple Transporter or `xcrun altool` successor tooling where available on the
  Mac Builder.
- App Store Connect API for metadata, build polling, TestFlight groups, and
  review automation where Apple exposes APIs.

### Optional third-party path

AppUploader/AppUploader CLI can be evaluated as an optional release-uploader
adapter for:

- cross-platform IPA upload,
- certificate/profile inspection,
- provisioning profile management,
- upload channel fallback,
- screenshot bulk upload.

It must not become the only trusted path. Before production use, require:

- license and vendor risk review,
- credential storage review,
- network destination review,
- audit logging,
- dry-run or staging verification,
- documented fallback to Apple official tooling.

## Release stages

| Stage | Capability | Owner | Output |
| --- | --- | --- | --- |
| Developer Program | apple-account-required | human/account owner | active Apple Developer Program membership |
| App identity | apple-account-required | release adapter or human | Bundle ID, App ID, capabilities |
| Signing inventory | mac-builder-required, apple-account-required | release adapter | certificate/profile status |
| Signing preflight | linux-runnable metadata check, mac-builder-required final check | workflow + Mac Builder | match result for cert/profile/Bundle ID |
| Archive/export | mac-builder-required | AWS EC2 Mac Builder | signed IPA, archive, `.xcresult` |
| IPA validation | mac-builder-required | Mac Builder | Info.plist, entitlements, icons, version/build checks |
| Upload | apple-account-required | release adapter | App Store Connect build upload id |
| Processing poll | apple-account-required | release adapter | processed build state |
| TestFlight | apple-account-required | release adapter or App Store Connect UI | tester group assignment |
| Review prep | apple-account-required | release adapter + human | metadata, screenshots, privacy answers |
| Submit review | apple-account-required | human approved adapter | submitted app version |

## Signing preflight checklist

Run before archive/export:

- Bundle ID in source equals App ID in Apple Developer account.
- Distribution certificate is used for App Store export.
- Development certificate is not used for App Store submission.
- Provisioning profile type matches release mode:
  - Development for device debug.
  - App Store for TestFlight/App Store upload.
  - Ad Hoc only for registered-device distribution.
- Profile App ID equals app Bundle ID.
- Profile is bound to the intended certificate.
- Entitlements match the app capabilities.
- CI/Mac Builder does not reuse stale cached profiles.

Useful diagnostic commands on the Mac Builder:

```bash
security cms -D -i "$PROFILE_PATH" > profile.plist
/usr/libexec/PlistBuddy -c "Print :Entitlements:application-identifier" profile.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PLIST"
codesign -d --entitlements :- "$APP_PATH"
```

## IPA validation checklist

Run after export and before upload:

- `.ipa` exists and is non-empty.
- `Payload/*.app/Info.plist` has expected:
  - `CFBundleIdentifier`
  - `CFBundleShortVersionString`
  - `CFBundleVersion`
  - privacy usage descriptions
- Build number is greater than the previous uploaded build for that version.
- Required icons and marketing icon are present.
- Entitlements do not include undeclared or unused capabilities.
- App Store Connect app record exists for the Bundle ID.
- Export method matches target:
  - `app-store` for TestFlight/App Store,
  - `development` for local development,
  - `ad-hoc` for registered-device testing.

## Upload adapter strategy

The release adapter should support multiple upload backends:

1. `official-transporter`
   - Runs only on Mac Builder.
   - Uses Apple official upload path.
2. `app-store-connect-api`
   - Uses scoped API key where Apple supports the task.
   - Good for metadata, build polling, TestFlight assignment, and review
     automation.
3. `appuploader-cli`
   - Optional third-party fallback for cross-platform IPA upload or profile
     inspection.
   - Requires explicit policy approval before use.

The adapter response should include:

- upload backend,
- upload id or build id,
- processing state,
- warnings/errors,
- App Store Connect link,
- audit decision,
- artifact refs.

## TestFlight workflow

1. Upload IPA.
2. Poll build processing state.
3. Attach build to internal TestFlight testers first.
4. Install on Apple Vision Pro via TestFlight.
5. Capture feedback, crashes, screenshots, and manual notes.
6. Fix and upload next build.
7. Promote to external testers only after internal smoke testing.
8. Submit to review after privacy, screenshots, metadata, and entitlement checks.

## Review readiness checklist

- Privacy policy URL exists and is reachable.
- App privacy answers are complete in App Store Connect.
- Info.plist privacy usage strings match actual behavior.
- Screenshots match the app's current UI.
- Version notes are specific.
- App does not crash on launch.
- Test account and review notes are provided if login is required.
- Apple sign-in, in-app purchase, push, camera, microphone, location, and
  network capabilities are declared only when actually used.
- Support URL and marketing URL are valid where required.

## Failure triage

### Certificate/profile mismatch

Check in this order:

1. Certificate type.
2. Profile type.
3. Profile App ID.
4. Source Bundle ID.
5. Entitlements.
6. Cached profiles on CI/Mac Builder.

### Upload fails without clear reason

Check in this order:

1. Network and Apple service status.
2. Upload backend.
3. IPA structure.
4. Bundle ID and App Store Connect app record.
5. Version/build number.
6. Profile/certificate match.
7. Icon and asset requirements.

### TestFlight install fails

Check in this order:

1. Build processing completed.
2. Tester has access to the group.
3. Build is assigned to the group.
4. Device platform supports the build.
5. Bundle ID and provisioning/export method are correct.

## Implementation milestones

1. Keep this document as the release policy.
2. Add `mcp/interfaces/app-store-release.json`.
3. Add release request/response contracts.
4. Add a release mock adapter like the Mac Builder mock.
5. Add signing/IPA metadata inspectors.
6. Add optional AppUploader CLI adapter only after credential and vendor review.
