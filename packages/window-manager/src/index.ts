import type {
  Rect,
  Size,
  WebWindowSpec,
  WindowLockMode,
  WindowKind,
  WorkspaceLayoutSpec
} from "@vision-web-workspace/contracts";
import {
  createDefaultWindowPose3D,
  defaultWindowOpacity,
  maxWindowOpacity,
  maxWorkspaceWindows,
  minWindowOpacity
} from "@vision-web-workspace/contracts";

export interface WorkspaceState extends WorkspaceLayoutSpec {}

export type WorkspaceAction =
  | { type: "focus"; windowId: string }
  | { type: "move"; windowId: string; delta: { x: number; y: number } }
  | { type: "resize"; windowId: string; delta: { width: number; height: number } }
  | { type: "create"; window: Omit<WebWindowSpec, "zIndex" | "focused">; sourceWindowId?: string }
  | { type: "close"; windowId: string }
  | { type: "minimize"; windowId: string }
  | { type: "restore-window"; windowId: string }
  | { type: "set-url"; windowId: string; url: string }
  | { type: "set-opacity"; windowId: string; opacity: number }
  | { type: "set-lock-mode"; windowId: string; lockMode: WindowLockMode }
  | { type: "toggle-edit-lock"; windowId: string }
  | { type: "restore"; layout: WorkspaceLayoutSpec };

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "focus":
      return focusWindow(state, action.windowId);
    case "move":
      return updateWindow(state, action.windowId, (window) => ({
        ...window,
        rect: clampRect(
          {
            ...window.rect,
            x: window.rect.x + action.delta.x,
            y: window.rect.y + action.delta.y
          },
          state.viewport,
          window.minSize
        )
      }));
    case "resize":
      return updateWindow(state, action.windowId, (window) => ({
        ...window,
        rect: clampRect(
          {
            ...window.rect,
            width: window.rect.width + action.delta.width,
            height: window.rect.height + action.delta.height
          },
          state.viewport,
          window.minSize
        )
      }));
    case "create":
      return createWindow(state, action.window, action.sourceWindowId);
    case "close":
      return closeWindow(state, action.windowId);
    case "minimize":
      return minimizeWindow(state, action.windowId);
    case "restore-window":
      return restoreWindow(state, action.windowId);
    case "set-url":
      return updateWindow(state, action.windowId, (window) => ({
        ...window,
        url: normalizeUrl(action.url),
        updatedAt: new Date().toISOString()
      }));
    case "set-opacity":
      return updateWindow(
        state,
        action.windowId,
        (window) => ({
          ...window,
          opacity: clamp(action.opacity, minWindowOpacity, maxWindowOpacity),
          updatedAt: new Date().toISOString()
        }),
        { allowLocked: true }
      );
    case "set-lock-mode":
      return updateWindow(
        state,
        action.windowId,
        (window) => ({
          ...window,
          lockMode: action.lockMode,
          updatedAt: new Date().toISOString()
        }),
        { allowLocked: true }
      );
    case "toggle-edit-lock":
      return updateWindow(
        state,
        action.windowId,
        (window) => ({
          ...window,
          locked: !window.locked,
          updatedAt: new Date().toISOString()
        }),
        { allowLocked: true }
      );
    case "restore":
      return stamp(normalizeLayout(action.layout));
    default:
      return state;
  }
}

export function createWebWindow(
  options: {
    id: string;
    title: string;
    kind: WindowKind;
    url: string;
    rect: Rect;
    minSize?: Size;
    locked?: boolean;
    opacity?: number;
  }
): Omit<WebWindowSpec, "zIndex" | "focused"> {
  const now = new Date().toISOString();

  return {
    id: options.id,
    title: options.title,
    kind: options.kind,
    url: normalizeUrl(options.url),
    surfaceMode: "direct-web",
    bookmarkId: null,
    opacity: clamp(options.opacity ?? defaultWindowOpacity, minWindowOpacity, maxWindowOpacity),
    rect: options.rect,
    pose3D: createDefaultWindowPose3D(0),
    minSize: options.minSize ?? { width: 360, height: 240 },
    minimized: false,
    locked: options.locked ?? false,
    lockMode: "screen-locked",
    clipboardPolicy: "platform-default",
    createdAt: now,
    updatedAt: now
  };
}

export function serializeLayout(state: WorkspaceState): string {
  return JSON.stringify(state, null, 2);
}

export function parseLayout(raw: string): WorkspaceLayoutSpec {
  const parsed = JSON.parse(raw) as WorkspaceLayoutSpec;

  if (!parsed.id || !Array.isArray(parsed.windows)) {
    throw new Error("Invalid workspace layout");
  }

  return normalizeLayout(parsed);
}

function updateWindow(
  state: WorkspaceState,
  windowId: string,
  update: (window: WebWindowSpec) => WebWindowSpec,
  options: { allowLocked?: boolean } = {}
): WorkspaceState {
  return stamp({
    ...state,
    windows: state.windows.map((window) =>
      window.id === windowId && (options.allowLocked || !window.locked)
        ? update(window)
        : window
    )
  });
}

function focusWindow(state: WorkspaceState, windowId: string): WorkspaceState {
  const nextZ = Math.max(0, ...state.windows.map((window) => window.zIndex)) + 1;

  return stamp({
    ...state,
    activeWindowId: windowId,
    windows: state.windows.map((window) => ({
      ...window,
      focused: window.id === windowId && !window.minimized,
      zIndex: window.id === windowId ? nextZ : window.zIndex
    }))
  });
}

function createWindow(
  state: WorkspaceState,
  window: Omit<WebWindowSpec, "zIndex" | "focused">,
  sourceWindowId?: string
): WorkspaceState {
  if (state.windows.length >= maxWorkspaceWindows) {
    return state;
  }

  const nextZ = Math.max(0, ...state.windows.map((item) => item.zIndex)) + 1;
  const now = new Date().toISOString();
  const index = state.windows.length;
  const sourceWindow = choosePlacementSource(state, sourceWindowId);
  const placement = placeNewWindow(state, window, sourceWindow, index);
  const newWindow: WebWindowSpec = {
    ...window,
    url: normalizeUrl(window.url),
    surfaceMode: window.surfaceMode ?? "direct-web",
    bookmarkId: window.bookmarkId ?? null,
    opacity: clamp(window.opacity ?? defaultWindowOpacity, minWindowOpacity, maxWindowOpacity),
    rect: placement.rect,
    pose3D: placement.pose3D,
    minimized: false,
    lockMode: window.lockMode ?? "screen-locked",
    clipboardPolicy: window.clipboardPolicy ?? "platform-default",
    createdAt: window.createdAt ?? now,
    updatedAt: now,
    zIndex: nextZ,
    focused: true
  };

  return stamp({
    ...state,
    activeWindowId: newWindow.id,
    windows: [
      ...state.windows.map((item) => ({ ...item, focused: false })),
      newWindow
    ]
  });
}

function closeWindow(state: WorkspaceState, windowId: string): WorkspaceState {
  const windows = state.windows.filter((window) => window.id !== windowId);
  const activeWindow = topVisibleWindow(windows);

  return stamp({
    ...state,
    activeWindowId: activeWindow?.id ?? null,
    windows: windows.map((window) => ({
      ...window,
      focused: window.id === activeWindow?.id
    }))
  });
}

function minimizeWindow(state: WorkspaceState, windowId: string): WorkspaceState {
  const windows = state.windows.map((window) =>
    window.id === windowId
      ? { ...window, minimized: true, focused: false, updatedAt: new Date().toISOString() }
      : window
  );
  const activeWindow = topVisibleWindow(windows);

  return stamp({
    ...state,
    activeWindowId: activeWindow?.id ?? null,
    windows: windows.map((window) => ({
      ...window,
      focused: window.id === activeWindow?.id
    }))
  });
}

function restoreWindow(state: WorkspaceState, windowId: string): WorkspaceState {
  const nextZ = Math.max(0, ...state.windows.map((window) => window.zIndex)) + 1;
  const now = new Date().toISOString();

  return stamp({
    ...state,
    activeWindowId: windowId,
    windows: state.windows.map((window) =>
      window.id === windowId
        ? {
            ...window,
            minimized: false,
            focused: true,
            zIndex: nextZ,
            updatedAt: now
          }
        : {
            ...window,
            minimized: window.minimized ?? false,
            focused: false
          }
    )
  });
}

function topVisibleWindow(windows: WebWindowSpec[]): WebWindowSpec | undefined {
  return [...windows]
    .filter((window) => !window.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0];
}

function choosePlacementSource(
  state: WorkspaceState,
  sourceWindowId?: string
): WebWindowSpec | undefined {
  return (
    state.windows.find((window) => window.id === sourceWindowId && !window.minimized) ??
    state.windows.find((window) => window.id === state.activeWindowId && !window.minimized) ??
    topVisibleWindow(state.windows)
  );
}

function placeNewWindow(
  state: WorkspaceState,
  window: Omit<WebWindowSpec, "zIndex" | "focused">,
  sourceWindow: WebWindowSpec | undefined,
  index: number
): { rect: Rect; pose3D: WebWindowSpec["pose3D"] } {
  if (!sourceWindow) {
    return {
      rect: clampRect(window.rect, state.viewport, window.minSize),
      pose3D: window.pose3D ?? createDefaultWindowPose3D(index)
    };
  }

  const leftSpace = sourceWindow.rect.x;
  const rightSpace = state.viewport.width - (sourceWindow.rect.x + sourceWindow.rect.width);
  const direction = rightSpace >= leftSpace ? 1 : -1;
  const gap = 24;
  const width = sourceWindow.rect.width;
  const height = sourceWindow.rect.height;
  const requestedX =
    direction > 0
      ? sourceWindow.rect.x + sourceWindow.rect.width + gap
      : sourceWindow.rect.x - width - gap;
  const rect = clampRect(
    {
      x: requestedX,
      y: sourceWindow.rect.y,
      width,
      height
    },
    state.viewport,
    window.minSize
  );
  const poseGap = Math.max(0.62, 0.72 * sourceWindow.pose3D.scale);

  return {
    rect,
    pose3D: {
      ...sourceWindow.pose3D,
      x: sourceWindow.pose3D.x + direction * poseGap
    }
  };
}

function clampRect(rect: Rect, viewport: Size, minSize: Size): Rect {
  const width = clamp(rect.width, minSize.width, viewport.width);
  const height = clamp(rect.height, minSize.height, viewport.height);
  const x = clamp(rect.x, 0, Math.max(0, viewport.width - width));
  const y = clamp(rect.y, 0, Math.max(0, viewport.height - height));

  return { x, y, width, height };
}

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function normalizeLayout(layout: WorkspaceLayoutSpec): WorkspaceLayoutSpec {
  return {
    ...layout,
    windows: layout.windows
      .slice(0, maxWorkspaceWindows)
      .map((window, index) => normalizeWindow(window, index))
  };
}

function normalizeWindow(window: WebWindowSpec, index: number): WebWindowSpec {
  const now = window.updatedAt ?? new Date().toISOString();

  return {
    ...window,
    url: normalizeUrl(window.url),
    surfaceMode: window.surfaceMode ?? "direct-web",
    bookmarkId: window.bookmarkId ?? null,
    opacity: clamp(window.opacity ?? defaultWindowOpacity, minWindowOpacity, maxWindowOpacity),
    pose3D: window.pose3D ?? createDefaultWindowPose3D(index),
    minimized: window.minimized ?? false,
    lockMode: window.lockMode ?? "screen-locked",
    clipboardPolicy: window.clipboardPolicy ?? "platform-default",
    createdAt: window.createdAt ?? now,
    updatedAt: now
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function stamp<T extends WorkspaceLayoutSpec>(state: T): T {
  return {
    ...state,
    updatedAt: new Date().toISOString()
  };
}
