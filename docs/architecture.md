# Architecture

## Product definition

`vision-web-workspace` is a spatial web development desktop. It provides a
head-locked workspace root and movable web windows. A window can host any
browser-addressable development surface: SSH terminal, code-server, CI,
documentation, logs, notebooks, or a remote browser stream.

## Non-goals

- It is not only a monitoring panel.
- It is not a replacement for Xcode, visionOS SDK, signing, or Apple's
  official simulator.
- It does not give the Vision Pro client direct access to SSH keys, GitHub
  tokens, production machines, or deployment authority.

## Runtime planes

```text
Browser simulator
  -> validates workspace layout, window controls, and remote sessions on Linux.

Gateway
  -> creates terminal, code, browser, and workspace sessions.

Imperativ adapter
  -> future thin layer for CommandGateway, policy, approval, audit, and task
     events.

Native visionOS shell
  -> future generated SwiftUI/RealityKit client that renders the same window
     model inside a mixed ImmersiveSpace.
```

## Control boundary

The Vision Pro or browser client is a UI and input surface. Session creation is
handled by the gateway and later governed by Imperativ capabilities:

```text
vision.window.create
vision.window.move
vision.window.resize
vision.window.close
terminal.session.open
browser.session.open
workspace.layout.save
workspace.layout.restore
```

The default audit level records session lifecycle and controlled URL access. It
does not record every terminal keystroke unless a policy explicitly enables
that for a sensitive workspace.
