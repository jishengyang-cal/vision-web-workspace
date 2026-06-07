# Remote Web Window Workspace Plan

This document records the corrected first-stage product and implementation
plan for the Vision Pro client.

## Product boundary

`vision-web-workspace` is a spatial remote web workspace shell. It is not the
remote development environment, terminal implementation, IDE, browser runtime,
CI system, dashboard, or server-side workflow owner.

Each opened window is a browser-based surface that points to a remote server
URL. The remote server decides what the user sees and how that content behaves.
The Vision Pro app owns only the spatial window shell and local input
integration:

- window creation, close, focus, placement, resize, scale, rotation, and lock
- browser-like per-window create, minimize, restore, and close controls
- URL/session opening
- back, forward, reload, and basic navigation controls
- keyboard input and system dictation where the focused web surface supports it
- copy and paste mediation through platform APIs
- bookmarks and recent surfaces
- per-window opacity
- layout save and restore

The Vision Pro client must not receive SSH private keys, GitHub tokens, signing
assets, production credentials, or deployment authority. Remote development
surfaces must be exposed by controlled server-side services such as `ttyd`,
`code-server`, remote browser streaming, noVNC, Guacamole, KasmVNC, CI, logs,
or documentation servers.

## Presentation target

The first user-facing target is the same visual premise as the Vision Pro home
environment: real surroundings remain visible. The app does not render camera
video. It uses Apple presentation modes that allow passthrough while placing
web windows and controls in front of the user.

Two modes are kept separate because they use different Apple system surfaces.

### Native Web Window Mode

Native Web Window Mode is the first implementation target for system-like
window behavior.

```text
Launcher / menu
  -> create up to 10 browser windows
  -> each window hosts WKWebView or equivalent native web surface
  -> visionOS system manages window movement, resize, focus, keyboard, and
     dictation behavior
  -> app-owned toolbar provides URL, navigation, bookmark, and opacity controls
```

This mode gives the closest public-API match to native visionOS window
interaction. It should be used for the initial validation of keyboard input,
system dictation, copy/paste, browsing, and remote development surfaces.

The native source owns a `WindowGroup`-based remote web window host. Each
native window is opened from a shared workspace layout entry and hosts one
remote URL in a web surface. The same layout contract is still used by the
browser simulator, gateway, and mixed workspace so native mode does not become a
separate authority source.

Boundaries:

- The app can control its web content view and toolbar.
- The system owns the native window chrome and system-level move/resize
  behavior.
- The app should not claim private parity with Apple system windows beyond what
  `WindowGroup` and public SwiftUI APIs provide.

### Screen-Locked Mixed Workspace Mode

Screen-Locked Mixed Workspace Mode is the second implementation target for
spatially locked and transformable windows.

```text
Mixed ImmersiveSpace
  -> passthrough remains visible
  -> custom menu bar attachment
  -> up to 10 remote web window attachments/entities
  -> each window owns position, scale, yaw, pitch, roll, lock state, focus, and
     opacity
```

This mode provides stronger spatial control, including screen/head-relative
placement, arbitrary angle changes, and custom locking. Its interaction can be
made native-feeling, but it is not the system window manager and cannot
inherit private system window bar behavior.

Boundaries:

- Custom RealityKit/SwiftUI window controls must implement drag, resize, scale,
  rotation, and lock behavior explicitly.
- `WKWebView` inside RealityView attachments must be tested on device. If it is
  unstable, the same window shell should display a remote browser stream
  provided by the gateway.
- This mode should reuse the same workspace layout contract as the browser
  simulator and gateway rather than creating a separate native-only state
  model.

## Window model requirements

The shared window contract needs to represent remote web surfaces instead of
application-owned feature panels.

Required fields for the next contract revision:

```text
RemoteWebWindow
  id
  title
  kind
  url
  bookmarkId
  navigation
  surfaceMode: direct-web | remote-stream
  opacity
  rect2D
  pose3D
  minSize
  zIndex
  focused
  minimized
  locked
  lockMode: unlocked | screen-locked | world-locked
  clipboardPolicy
  createdAt
  updatedAt
```

The workspace layout also owns bookmarks:

```text
WorkspaceBookmark
  id
  title
  kind
  url
  createdAt
  updatedAt
```

Navigation history is app-owned shell state. It tracks URLs entered through the
app toolbar and bookmark openings; it is not an attempt to inspect or own the
remote server's internal application state.

Opacity is a first-class window property. Recommended behavior:

```text
minimum opacity: 0.25
default opacity: 0.92
maximum opacity: 1.0
```

Native windows can apply opacity to the web surface and app-owned chrome.
System window chrome transparency remains controlled by visionOS. Mixed
workspace windows can apply opacity to the full custom window entity.

The workspace must enforce a maximum of 10 open windows. Attempts to create an
eleventh window should fail closed with a user-readable message and an audit or
diagnostic event from the gateway/control layer.

Each window owns browser-like chrome in the top-right corner:

```text
+  create a sibling window
-  minimize the current window
x  close the current window
```

Minimizing a window keeps its rect and 3D pose intact, hides the large web
surface, and represents it as a small centered top bubble. Looking at the
bubble and pinching on Vision Pro restores the window to its previous position.
If multiple windows are minimized, the bubbles remain centered as a horizontal
strip.

Sibling-window placement uses the active/source window as the anchor. The new
window opens on the side with more available horizontal space. If the anchor is
centered or both sides are equal, the new window opens on the right. The new
window inherits the anchor's width, height, vertical position, scale, depth, and
angle, while remaining movable, scalable, rotatable, and resizable after it is
created.

## Menu bar requirements

The menu bar is not a business dashboard. It is a remote web workspace control
surface.

Minimum controls:

- new Terminal surface
- new Code surface
- new Browser surface
- new Docs surface
- new Logs surface
- bookmarks
- back / forward / reload
- save or remove bookmark for the active URL
- layout save
- layout restore/reset
- active window opacity
- active window lock mode
- close active window
- per-window create/minimize/close chrome
- centered minimized-window restore bubbles

The menu must not contain remote server business logic. It may only open,
organize, and control web surfaces.

## Input and clipboard requirements

Native keyboard input and system dictation should be validated first in Native
Web Window Mode because visionOS owns the text input path for normal windows.

The app should treat voice input as an input method, not as an agent execution
path. Dictated text enters the focused web surface or URL field. It must not
directly trigger privileged commands unless the remote server and control plane
explicitly require confirmation.

Copy/paste support belongs to the local shell only at the browser-surface
boundary. The app should not inspect or audit every terminal keystroke by
default. Sensitive workspaces may later opt into stricter gateway-side audit
policies.

## Gateway responsibility

The gateway creates and returns session URLs. It does not render remote content
and does not own the remote application logic.

Expected session examples:

```text
terminal -> https://terminal.example.internal/session/...
code     -> https://code.example.internal/?folder=...
browser  -> https://browser.example.internal/session/...
docs     -> https://docs.example.internal/...
logs     -> https://logs.example.internal/...
```

The gateway may enforce policy, TTL, URL allowlists, bookmark ownership, and
layout persistence. The Vision Pro client consumes those session descriptors
and renders them as windows.

## Immediate construction sequence

1. Extend shared contracts with remote web window opacity, surface mode,
   bookmark references, navigation state, 3D pose, minimized state, and lock
   mode.
2. Add max-10 window enforcement in the window manager and gateway.
3. Implement Native Web Window Mode for real system window behavior, keyboard,
   dictation, copy/paste, bookmarks, navigation, and opacity.
4. Update the browser simulator to exercise the same contract fields.
5. Convert the existing mixed `WorkspacePanelView` prototype into a true
   multi-window RealityKit workspace with a separate menu attachment.
6. Validate `WKWebView` behavior inside mixed attachments on device.
7. If attachment stability blocks web input, route mixed windows to remote
   browser streams while keeping native windows as the primary web input path.

## Acceptance criteria

- Opening the app can preserve real surroundings through the public visionOS
  presentation model.
- The user can open up to 10 remote web windows.
- Each window points to a remote URL/session; content is remote-owned.
- Native mode supports system keyboard, system dictation, copy/paste, basic
  navigation, bookmarks, and opacity controls.
- Mixed workspace mode supports custom spatial lock, scale, rotation, angle,
  opacity, and layout persistence.
- The app does not claim to reproduce private Apple system window chrome inside
  custom immersive attachments.
- No credentials or deployment authority are stored in the Vision Pro client.
