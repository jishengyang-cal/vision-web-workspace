# Architecture

## Product definition

`vision-web-workspace` is a spatial remote web workspace shell. It provides
Vision Pro window management for browser-addressable development surfaces:
SSH terminals, code-server, CI, documentation, logs, notebooks, dashboards, or
remote browser streams.

The Vision Pro client does not own the remote development UI. Each window
points to a remote server URL or session descriptor, and the remote server
decides the rendered content. The app owns only the spatial shell: window
creation, placement, resize, focus, locking, opacity, basic navigation,
bookmarks, keyboard/dictation input paths, copy/paste, and layout persistence.

The corrected first-stage plan is recorded in
`docs/workflows/remote-web-window-workspace.md`.

## Non-goals

- It is not only a monitoring panel.
- It is not the IDE, terminal implementation, remote browser runtime, or server
  application rendered inside a window.
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
  -> SwiftUI/RealityKit client that renders remote web windows through native
     windows first, then through a custom mixed ImmersiveSpace workspace for
     screen-locked spatial transforms.

Workflow control plane
  -> executable repo workflows, Agent skills, MCP capability adapters, and
     hooks that keep Linux, Mac-builder, device, and release responsibilities
     separate.
```

## Control boundary

The Vision Pro or browser client is a UI and input surface. Session creation is
handled by the gateway and later governed by Imperativ capabilities:

```text
vision.window.create
vision.window.move
vision.window.resize
vision.window.rotate
vision.window.setOpacity
vision.window.setLockMode
vision.window.close
terminal.session.open
browser.session.open
bookmark.create
bookmark.open
workspace.layout.save
workspace.layout.restore
```

The default audit level records session lifecycle and controlled URL access. It
does not record every terminal keystroke unless a policy explicitly enables
that for a sensitive workspace.

## Workflow boundary

The project uses four layers for visionOS development process control:

- Workflows are executable repo commands and machine-readable plans.
- Skills guide agents to choose the correct workflow and stop at missing
  capabilities.
- MCP interfaces will expose privileged Mac builder, docs index, and device lab
  capabilities behind approval and audit.
- Hooks enforce local compliance before commit and push.

Linux workflows may validate contracts, simulator behavior, gateway sessions,
developer web surfaces, and static checks. Mac builder workflows own native
Xcode project generation, build, simulator, signing, archive, and `.xcresult`
operations. Device lab and release workflows own paired device testing,
TestFlight, and App Store Connect work.
