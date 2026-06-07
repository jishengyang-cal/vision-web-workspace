import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createDefaultWindowPose3D,
  createDefaultLayout,
  defaultWindowOpacity,
  isSessionKind,
  maxWindowOpacity,
  maxWorkspaceWindows,
  minWindowOpacity,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type GetWorkspaceLayoutResponse,
  type SaveWorkspaceLayoutRequest,
  type SaveWorkspaceLayoutResponse,
  type RemoteSessionSpec,
  type SessionKind,
  type WebWindowSpec,
  type WorkspaceLayoutSpec
} from "@vision-web-workspace/contracts";

const port = Number(process.env.PORT ?? 3001);
const sessions = new Map<string, RemoteSessionSpec>();
const layouts = new Map<string, WorkspaceLayoutSpec>();

const defaultUrls: Record<SessionKind, string> = {
  terminal: process.env.TERMINAL_URL ?? "http://localhost:7681",
  code: process.env.CODE_URL ?? "http://localhost:8080",
  browser: process.env.BROWSER_URL ?? "https://example.com",
  docs: process.env.DOCS_URL ?? "https://developer.apple.com/visionos/",
  logs: process.env.LOGS_URL ?? "http://localhost:3001/logs"
};

const server = createServer(async (request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    await route(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected gateway error"
    });
  }
});

server.listen(port, () => {
  console.log(`vision-web-workspace gateway listening on http://localhost:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "vision-web-workspace-gateway" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/logs") {
    sendHtml(response, renderLogsPage());
    return;
  }

  if (request.method === "GET" && url.pathname === "/sessions") {
    sendJson(response, 200, { sessions: Array.from(sessions.values()) });
    return;
  }

  const layoutMatch = /^\/workspaces\/([^/]+)\/layout$/.exec(url.pathname);
  if (request.method === "GET" && layoutMatch) {
    const workspaceId = decodeURIComponent(layoutMatch[1] ?? "local-dev-workspace");
    const payload: GetWorkspaceLayoutResponse = {
      layout: getLayout(workspaceId)
    };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "PUT" && layoutMatch) {
    const workspaceId = decodeURIComponent(layoutMatch[1] ?? "local-dev-workspace");
    const body = await readJson<SaveWorkspaceLayoutRequest>(request);
    const layout = normalizeLayout(workspaceId, body.layout);
    layouts.set(workspaceId, layout);
    const payload: SaveWorkspaceLayoutResponse = { layout };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/sessions") {
    const body = await readJson<CreateSessionRequest>(request);
    const created = createSession(body);
    sessions.set(created.id, created);
    const payload: CreateSessionResponse = { session: created };
    sendJson(response, 201, payload);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function getLayout(workspaceId: string): WorkspaceLayoutSpec {
  const existing = layouts.get(workspaceId);
  if (existing) {
    return existing;
  }

  const layout = createDefaultLayout({
    terminalUrl: defaultUrls.terminal,
    codeUrl: defaultUrls.code,
    browserUrl: defaultUrls.browser
  });
  layouts.set(workspaceId, { ...layout, id: workspaceId });
  return layouts.get(workspaceId)!;
}

function normalizeLayout(workspaceId: string, layout: WorkspaceLayoutSpec): WorkspaceLayoutSpec {
  return {
    ...layout,
    id: workspaceId,
    windows: layout.windows
      .slice(0, maxWorkspaceWindows)
      .map((window, index) => normalizeWindow(window, index)),
    updatedAt: new Date().toISOString()
  };
}

function normalizeWindow(window: WebWindowSpec, index: number): WebWindowSpec {
  const now = new Date().toISOString();

  return {
    ...window,
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

function createSession(request: CreateSessionRequest): RemoteSessionSpec {
  if (!isSessionKind(request.kind)) {
    throw new Error(`Unsupported session kind: ${request.kind}`);
  }

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString();
  const url = request.requestedUrl ?? defaultUrls[request.kind];
  const workspaceId = request.workspaceId || "local-dev-workspace";

  switch (request.kind) {
    case "terminal":
      return {
        id,
        kind: "terminal",
        workspaceId,
        targetLabel: request.targetLabel ?? "local-shell",
        url,
        auditLevel: "lifecycle",
        expiresAt
      };
    case "code":
      return {
        id,
        kind: "code",
        workspaceId,
        targetLabel: request.targetLabel ?? "local-code-server",
        url,
        expiresAt
      };
    case "browser":
      return {
        id,
        kind: "browser",
        workspaceId,
        url,
        mode: "direct-web",
        expiresAt
      };
    case "docs":
    case "logs":
      return {
        id,
        kind: request.kind,
        workspaceId,
        url,
        expiresAt
      };
  }
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response: ServerResponse, html: string) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
}

function setCors(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function renderLogsPage(): string {
  const rows = Array.from(sessions.values())
    .map(
      (session) => `
        <tr>
          <td>${session.kind}</td>
          <td>${session.workspaceId}</td>
          <td>${session.url}</td>
          <td>${session.expiresAt}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Workspace Sessions</title>
    <style>
      body { margin: 0; font: 14px system-ui, sans-serif; background: #0e1117; color: #e8eef5; }
      header { padding: 16px 20px; background: #171d25; border-bottom: 1px solid #2b3644; }
      main { padding: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px; border-bottom: 1px solid #2b3644; text-align: left; }
      th { color: #94caff; font-weight: 600; }
    </style>
  </head>
  <body>
    <header><strong>Workspace Sessions</strong></header>
    <main>
      <table>
        <thead>
          <tr><th>Kind</th><th>Workspace</th><th>URL</th><th>Expires</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  </body>
</html>`;
}
