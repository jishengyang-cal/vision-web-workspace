import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  createDefaultLayout,
  defaultWindowOpacity,
  maxWorkspaceWindows,
  minWindowOpacity,
  type WebWindowSpec,
  type WindowLockMode,
  type WindowKind,
  type WorkspaceLayoutSpec
} from "@vision-web-workspace/contracts";
import {
  createWebWindow,
  parseLayout,
  serializeLayout,
  workspaceReducer
} from "@vision-web-workspace/window-manager";

const storageKey = "vision-web-workspace.layout.v1";

const defaultUrls: Record<WindowKind, string> = {
  terminal: import.meta.env.VITE_TERMINAL_URL ?? "http://localhost:7681",
  code: import.meta.env.VITE_CODE_URL ?? "http://localhost:8080",
  browser: import.meta.env.VITE_BROWSER_URL ?? "https://example.com",
  docs: import.meta.env.VITE_DOCS_URL ?? "https://developer.apple.com/visionos/",
  logs: import.meta.env.VITE_LOGS_URL ?? "http://localhost:3001/logs"
};

const defaultTitles: Record<WindowKind, string> = {
  terminal: "Terminal",
  code: "Code",
  browser: "Browser",
  docs: "Docs",
  logs: "Logs"
};

const gatewayUrl =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  "http://localhost:3001";

export function App() {
  const initialLayout = useMemo(
    () =>
      createDefaultLayout({
        terminalUrl: defaultUrls.terminal,
        codeUrl: defaultUrls.code,
        browserUrl: defaultUrls.browser
      }),
    []
  );

  const [state, dispatch] = useReducer(
    workspaceReducer,
    initialLayout,
    loadLayout
  );
  const [frameInputLocked, setFrameInputLocked] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, serializeLayout(state));
  }, [state]);

  function loadLayout(layout: WorkspaceLayoutSpec): WorkspaceLayoutSpec {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return layout;
    }

    try {
      return parseLayout(saved);
    } catch {
      return layout;
    }
  }

  async function createWindow(kind: WindowKind, sourceWindow?: WebWindowSpec) {
    if (state.windows.length >= maxWorkspaceWindows) {
      return;
    }

    const index = state.windows.filter((window) => window.kind === kind).length;
    const id = `${kind}-${Date.now()}`;
    const offset = 40 * (index + 1);
    const url = await resolveSessionUrl(kind, state.id);

    dispatch({
      type: "create",
      ...(sourceWindow ? { sourceWindowId: sourceWindow.id } : {}),
      window: createWebWindow({
        id,
        kind,
        title: index === 0 ? defaultTitles[kind] : `${defaultTitles[kind]} ${index + 1}`,
        url,
        rect: {
          x: 132 + offset,
          y: 116 + offset,
          width: kind === "code" ? 760 : 640,
          height: kind === "code" ? 520 : 400
        },
        opacity: defaultWindowOpacity
      })
    });
  }

  function resetLayout() {
    localStorage.removeItem(storageKey);
    dispatch({ type: "restore", layout: initialLayout });
  }

  function setPose(patch: Partial<WorkspaceLayoutSpec["pose"]>) {
    dispatch({
      type: "restore",
      layout: {
        ...state,
        pose: {
          ...state.pose,
          ...patch
        }
      }
    });
  }

  const workspaceStyle = {
    "--workspace-yaw": `${state.pose.yawDegrees}deg`,
    "--workspace-pitch": `${state.pose.pitchDegrees}deg`,
    "--workspace-distance": `${state.pose.distanceMeters}`,
    "--workspace-scale": `${Math.max(0.68, Math.min(1.08, 1.35 / state.pose.distanceMeters))}`
  } as CSSProperties;
  const visibleWindows = state.windows.filter((window) => !window.minimized);
  const minimizedWindows = state.windows.filter((window) => window.minimized);

  return (
    <main className="shell">
      <aside className="control-rail">
        <div>
          <div className="brand">Vision Web Workspace</div>
          <div className="status-pill">head-locked web desktop</div>
        </div>

        <div className="tool-group">
          <button disabled={state.windows.length >= maxWorkspaceWindows} onClick={() => void createWindow("terminal")}>Terminal</button>
          <button disabled={state.windows.length >= maxWorkspaceWindows} onClick={() => void createWindow("code")}>Code</button>
          <button disabled={state.windows.length >= maxWorkspaceWindows} onClick={() => void createWindow("browser")}>Browser</button>
          <button disabled={state.windows.length >= maxWorkspaceWindows} onClick={() => void createWindow("docs")}>Docs</button>
          <button disabled={state.windows.length >= maxWorkspaceWindows} onClick={() => void createWindow("logs")}>Logs</button>
          <div className="limit-note">
            {state.windows.length}/{maxWorkspaceWindows} windows
          </div>
        </div>

        <div className="tool-group">
          <label>
            Distance
            <input
              min="0.9"
              max="1.8"
              step="0.05"
              type="range"
              value={state.pose.distanceMeters}
              onChange={(event) =>
                setPose({ distanceMeters: Number(event.currentTarget.value) })
              }
            />
          </label>
          <label>
            Yaw
            <input
              min="-18"
              max="18"
              step="1"
              type="range"
              value={state.pose.yawDegrees}
              onChange={(event) =>
                setPose({ yawDegrees: Number(event.currentTarget.value) })
              }
            />
          </label>
          <label>
            Pitch
            <input
              min="-14"
              max="8"
              step="1"
              type="range"
              value={state.pose.pitchDegrees}
              onChange={(event) =>
                setPose({ pitchDegrees: Number(event.currentTarget.value) })
              }
            />
          </label>
        </div>

        <div className="tool-group">
          <button onClick={() => localStorage.setItem(storageKey, serializeLayout(state))}>
            Save Layout
          </button>
          <button onClick={resetLayout}>Reset</button>
          <label className="check-row">
            <input
              type="checkbox"
              checked={frameInputLocked}
              onChange={(event) => setFrameInputLocked(event.currentTarget.checked)}
            />
            Lock iframe input
          </label>
        </div>
      </aside>

      <section className="sim-stage">
        <div className="passthrough-grid" />
        <MinimizedBubbleStrip
          dispatch={dispatch}
          windows={minimizedWindows}
        />
        <div className="workspace-perspective" style={workspaceStyle}>
          <div className="workspace-root">
            <div className="workspace-header">
              <span>{state.name}</span>
              <span>{state.windows.length}/{maxWorkspaceWindows} screen-locked windows</span>
            </div>
            {visibleWindows.map((window) => (
              <SpatialWindow
                createSibling={(sourceWindow) => void createWindow(sourceWindow.kind, sourceWindow)}
                dispatch={dispatch}
                inputLocked={frameInputLocked}
                key={window.id}
                webWindow={window}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function MinimizedBubbleStrip({
  windows,
  dispatch
}: {
  windows: WebWindowSpec[];
  dispatch: Dispatch<Parameters<typeof workspaceReducer>[1]>;
}) {
  if (windows.length === 0) {
    return null;
  }

  return (
    <div className="minimized-bubbles" aria-label="Minimized windows">
      {windows.map((window) => (
        <button
          aria-label={`Restore ${window.title}`}
          className="minimized-bubble"
          key={window.id}
          onClick={() => dispatch({ type: "restore-window", windowId: window.id })}
          type="button"
        >
          <span className={`kind-dot ${window.kind}`} />
          <span>{window.title}</span>
        </button>
      ))}
    </div>
  );
}

async function resolveSessionUrl(
  kind: WindowKind,
  workspaceId: string
): Promise<string> {
  if (!gatewayUrl) {
    return defaultUrls[kind];
  }

  try {
    const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, kind })
    });

    if (!response.ok) {
      return defaultUrls[kind];
    }

    const payload = (await response.json()) as {
      session?: { url?: string };
    };

    return payload.session?.url ?? defaultUrls[kind];
  } catch {
    return defaultUrls[kind];
  }
}

function SpatialWindow({
  webWindow,
  createSibling,
  dispatch,
  inputLocked
}: {
  webWindow: WebWindowSpec;
  createSibling: (window: WebWindowSpec) => void;
  dispatch: Dispatch<Parameters<typeof workspaceReducer>[1]>;
  inputLocked: boolean;
}) {
  const [draftUrl, setDraftUrl] = useState(webWindow.url);

  useEffect(() => {
    setDraftUrl(webWindow.url);
  }, [webWindow.url]);

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (webWindow.locked) {
      return;
    }

    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(pointerId);
    dispatch({ type: "focus", windowId: webWindow.id });

    function onMove(moveEvent: PointerEvent) {
      dispatch({
        type: "move",
        windowId: webWindow.id,
        delta: {
          x: moveEvent.clientX - start.x,
          y: moveEvent.clientY - start.y
        }
      });
      start.x = moveEvent.clientX;
      start.y = moveEvent.clientY;
    }

    function onUp() {
      globalThis.window.removeEventListener("pointermove", onMove);
      globalThis.window.removeEventListener("pointerup", onUp);
    }

    globalThis.window.addEventListener("pointermove", onMove);
    globalThis.window.addEventListener("pointerup", onUp);
  }

  function beginResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(pointerId);
    dispatch({ type: "focus", windowId: webWindow.id });

    function onMove(moveEvent: PointerEvent) {
      dispatch({
        type: "resize",
        windowId: webWindow.id,
        delta: {
          width: moveEvent.clientX - start.x,
          height: moveEvent.clientY - start.y
        }
      });
      start.x = moveEvent.clientX;
      start.y = moveEvent.clientY;
    }

    function onUp() {
      globalThis.window.removeEventListener("pointermove", onMove);
      globalThis.window.removeEventListener("pointerup", onUp);
    }

    globalThis.window.addEventListener("pointermove", onMove);
    globalThis.window.addEventListener("pointerup", onUp);
  }

  function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "set-url", windowId: webWindow.id, url: draftUrl });
  }

  return (
    <article
      className={`spatial-window ${webWindow.focused ? "focused" : ""}`}
      onPointerDown={() => dispatch({ type: "focus", windowId: webWindow.id })}
      style={{
        left: webWindow.rect.x,
        top: webWindow.rect.y,
        width: webWindow.rect.width,
        height: webWindow.rect.height,
        zIndex: webWindow.zIndex,
        opacity: webWindow.opacity ?? defaultWindowOpacity
      }}
    >
      <div className="titlebar" onPointerDown={beginDrag}>
        <div>
          <span className={`kind-dot ${webWindow.kind}`} />
          <strong>{webWindow.title}</strong>
        </div>
        <div
          className="titlebar-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            aria-label={`New window beside ${webWindow.title}`}
            className="icon-button"
            onClick={() => createSibling(webWindow)}
            type="button"
          >
            +
          </button>
          <button
            aria-label={`Minimize ${webWindow.title}`}
            className="icon-button"
            onClick={() => dispatch({ type: "minimize", windowId: webWindow.id })}
            type="button"
          >
            -
          </button>
          <button
            aria-label={`Close ${webWindow.title}`}
            className="icon-button"
            onClick={() => dispatch({ type: "close", windowId: webWindow.id })}
            type="button"
          >
            x
          </button>
        </div>
      </div>

      <form className="addressbar" onSubmit={submitUrl}>
        <input
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.currentTarget.value)}
        />
        <button>Go</button>
      </form>

      <div className="window-controls">
        <label>
          Opacity
          <input
            min={minWindowOpacity}
            max="1"
            step="0.05"
            type="range"
            value={webWindow.opacity ?? defaultWindowOpacity}
            onChange={(event) =>
              dispatch({
                type: "set-opacity",
                windowId: webWindow.id,
                opacity: Number(event.currentTarget.value)
              })
            }
          />
        </label>
        <select
          aria-label={`Lock mode for ${webWindow.title}`}
          value={webWindow.lockMode ?? "screen-locked"}
          onChange={(event) =>
            dispatch({
              type: "set-lock-mode",
              windowId: webWindow.id,
              lockMode: event.currentTarget.value as WindowLockMode
            })
          }
        >
          <option value="screen-locked">screen</option>
          <option value="world-locked">world</option>
          <option value="unlocked">free</option>
        </select>
        <button
          type="button"
          onClick={() => dispatch({ type: "toggle-edit-lock", windowId: webWindow.id })}
        >
          {webWindow.locked ? "Unlock edit" : "Lock edit"}
        </button>
      </div>

      <div className="frame-wrap">
        {inputLocked ? <div className="frame-shield" /> : null}
        <iframe
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="no-referrer"
          src={webWindow.url}
          title={webWindow.title}
        />
      </div>

      <button
        aria-label={`Resize ${webWindow.title}`}
        className="resize-handle"
        onPointerDown={beginResize}
      />
    </article>
  );
}
