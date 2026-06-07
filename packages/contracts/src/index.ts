export type WindowKind = "terminal" | "code" | "browser" | "docs" | "logs";

export type SessionKind = "terminal" | "code" | "browser" | "docs" | "logs";

export const maxWorkspaceWindows = 10;
export const minWindowOpacity = 0.25;
export const maxWindowOpacity = 1;
export const defaultWindowOpacity = 0.92;

export type WindowSurfaceMode = "direct-web" | "remote-stream";

export type WindowLockMode = "unlocked" | "screen-locked" | "world-locked";

export type ClipboardPolicy = "platform-default" | "gateway-mediated" | "disabled";

export type WorkflowCapability =
  | "linux-runnable"
  | "optional-swift-toolchain"
  | "mac-builder-required"
  | "apple-account-required"
  | "device-required"
  | "mcp-candidate";

export type AuditDecisionStatus = "allowed" | "denied" | "requires-approval";

export interface AuditDecision {
  status: AuditDecisionStatus;
  policyId: string;
  reason: string;
  decidedBy: string;
  decidedAt: string;
}

export interface RepoRef {
  provider: "github" | "local" | "other";
  repository: string;
  remoteUrl: string;
  branch: string;
  commitSha: string;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Vec2, Size {}

export interface WorkspacePoseSpec {
  mode: "head-locked";
  distanceMeters: number;
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  smoothing: number;
}

export interface WindowPose3DSpec extends Vec3 {
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  scale: number;
}

export interface WebWindowSpec {
  id: string;
  title: string;
  kind: WindowKind;
  url: string;
  surfaceMode: WindowSurfaceMode;
  bookmarkId?: string | null;
  opacity: number;
  rect: Rect;
  pose3D: WindowPose3DSpec;
  minSize: Size;
  zIndex: number;
  focused: boolean;
  minimized: boolean;
  locked: boolean;
  lockMode: WindowLockMode;
  clipboardPolicy: ClipboardPolicy;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceLayoutSpec {
  id: string;
  name: string;
  pose: WorkspacePoseSpec;
  viewport: Size;
  windows: WebWindowSpec[];
  activeWindowId: string | null;
  updatedAt: string;
}

export interface TerminalSessionSpec {
  id: string;
  kind: "terminal";
  workspaceId: string;
  targetLabel: string;
  url: string;
  auditLevel: "lifecycle" | "commands" | "full";
  expiresAt: string;
}

export interface BrowserSessionSpec {
  id: string;
  kind: "browser";
  workspaceId: string;
  url: string;
  mode: "direct-web" | "remote-stream";
  expiresAt: string;
}

export interface CodeSessionSpec {
  id: string;
  kind: "code";
  workspaceId: string;
  url: string;
  targetLabel: string;
  expiresAt: string;
}

export interface WebAppSessionSpec {
  id: string;
  kind: "docs" | "logs";
  workspaceId: string;
  url: string;
  expiresAt: string;
}

export type RemoteSessionSpec =
  | TerminalSessionSpec
  | BrowserSessionSpec
  | CodeSessionSpec
  | WebAppSessionSpec;

export interface CreateSessionRequest {
  workspaceId: string;
  kind: SessionKind;
  windowId?: string;
  targetLabel?: string;
  requestedUrl?: string;
}

export interface CreateSessionResponse {
  session: RemoteSessionSpec;
}

export interface GetWorkspaceLayoutResponse {
  layout: WorkspaceLayoutSpec;
}

export interface SaveWorkspaceLayoutRequest {
  layout: WorkspaceLayoutSpec;
}

export interface SaveWorkspaceLayoutResponse {
  layout: WorkspaceLayoutSpec;
}

export type MacBuildJobKind = "build" | "simulator-test" | "archive";

export type MacBuildJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type MacBuildArtifactType =
  | "build-products"
  | "xcresult"
  | "archive"
  | "ipa"
  | "log"
  | "screenshot";

export type ReleaseUploadBackend =
  | "official-transporter"
  | "app-store-connect-api"
  | "appuploader-cli";

export type ReleaseUploadStatus =
  | "not-requested"
  | "queued"
  | "uploaded"
  | "processing"
  | "ready-for-testflight"
  | "failed";

export interface MacBuilderAudit {
  requestId: string;
  actorId: string;
  reason: string;
  source: "cli" | "agent" | "gateway" | "ci";
  requestedAt: string;
  decision: AuditDecision;
  traceId?: string;
}

export interface MacBuildTarget {
  scheme: string;
  configuration: "Debug" | "Release";
  destination: string;
  sdk: "xros" | "xrsimulator";
}

export type MacProjectGenerator = "xcodegen" | "xcodeproj" | "tuist";

export interface MacBuildProject {
  sourceRoot: string;
  projectPath: string;
  scheme: string;
  generator: MacProjectGenerator;
  generatorSpecPath?: string;
  workspacePath?: string;
}

export interface MacBuildRequestBase {
  kind: MacBuildJobKind;
  repoRef: RepoRef;
  project: MacBuildProject;
  target: MacBuildTarget;
  audit: MacBuilderAudit;
  capabilities: WorkflowCapability[];
  metadata?: Record<string, string>;
}

export interface MacNativeBuildRequest extends MacBuildRequestBase {
  kind: "build";
}

export interface MacSimulatorTestRequest extends MacBuildRequestBase {
  kind: "simulator-test";
  testPlan?: string;
}

export interface MacArchiveRequest extends MacBuildRequestBase {
  kind: "archive";
  exportMethod: "development" | "ad-hoc" | "app-store";
}

export type MacBuildRequest = MacNativeBuildRequest | MacSimulatorTestRequest | MacArchiveRequest;

export interface MacBuildLogEntry {
  sequence: number;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}

export interface MacBuildArtifact {
  id: string;
  type: MacBuildArtifactType;
  name: string;
  uri: string;
  createdAt: string;
  sizeBytes?: number;
  sha256?: string;
  mimeType?: string;
  retentionExpiresAt?: string;
}

export interface MacBuildJob {
  id: string;
  kind: MacBuildJobKind;
  status: MacBuildJobStatus;
  request: MacBuildRequest;
  logs: MacBuildLogEntry[];
  artifacts: MacBuildArtifact[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failureReason?: string;
  xcresult?: MacBuildArtifact;
}

export interface TestFlightReleaseRequest {
  repoRef: RepoRef;
  bundleId: string;
  version: string;
  buildNumber: string;
  macArchiveRequest: MacArchiveRequest;
  uploadBackend: ReleaseUploadBackend;
  internalOnly: boolean;
  testerGroupId?: string;
  audit: MacBuilderAudit;
}

export interface TestFlightReleaseResult {
  status: ReleaseUploadStatus;
  archiveJob?: MacBuildJob;
  ipaArtifact?: MacBuildArtifact;
  uploadLog?: MacBuildArtifact;
  buildId?: string;
  appStoreConnectUrl?: string;
  warnings: string[];
  errors: string[];
}

export interface CreateMacBuildJobResponse {
  job: MacBuildJob;
}

export interface GetMacBuildJobResponse {
  job: MacBuildJob;
}

export interface ListMacBuildJobsResponse {
  jobs: MacBuildJob[];
}

export const defaultPose: WorkspacePoseSpec = {
  mode: "head-locked",
  distanceMeters: 1.25,
  yawDegrees: 0,
  pitchDegrees: -2,
  rollDegrees: 0,
  smoothing: 0.18
};

export function createDefaultWindowPose3D(index: number): WindowPose3DSpec {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    x: (column - 1) * 0.72,
    y: 0.16 - row * 0.46,
    z: -1.25,
    yawDegrees: (column - 1) * -7,
    pitchDegrees: -2,
    rollDegrees: 0,
    scale: 1
  };
}

export function createDefaultLayout(
  options: {
    terminalUrl?: string;
    codeUrl?: string;
    browserUrl?: string;
    now?: string;
  } = {}
): WorkspaceLayoutSpec {
  const now = options.now ?? new Date().toISOString();

  return {
    id: "local-dev-workspace",
    name: "Local Dev Workspace",
    pose: defaultPose,
    viewport: { width: 1440, height: 900 },
    activeWindowId: "terminal",
    updatedAt: now,
    windows: [
      {
        id: "terminal",
        title: "Terminal",
        kind: "terminal",
        url: options.terminalUrl ?? "http://localhost:7681",
        surfaceMode: "direct-web",
        bookmarkId: null,
        opacity: defaultWindowOpacity,
        rect: { x: 64, y: 88, width: 680, height: 420 },
        pose3D: createDefaultWindowPose3D(0),
        minSize: { width: 360, height: 240 },
        zIndex: 3,
        focused: true,
        minimized: false,
        locked: false,
        lockMode: "screen-locked",
        clipboardPolicy: "platform-default",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "code",
        title: "Code",
        kind: "code",
        url: options.codeUrl ?? "http://localhost:8080",
        surfaceMode: "direct-web",
        bookmarkId: null,
        opacity: defaultWindowOpacity,
        rect: { x: 760, y: 88, width: 620, height: 560 },
        pose3D: createDefaultWindowPose3D(1),
        minSize: { width: 420, height: 300 },
        zIndex: 2,
        focused: false,
        minimized: false,
        locked: false,
        lockMode: "screen-locked",
        clipboardPolicy: "platform-default",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "browser",
        title: "Browser",
        kind: "browser",
        url: options.browserUrl ?? "https://example.com",
        surfaceMode: "direct-web",
        bookmarkId: null,
        opacity: defaultWindowOpacity,
        rect: { x: 112, y: 536, width: 560, height: 300 },
        pose3D: createDefaultWindowPose3D(2),
        minSize: { width: 360, height: 240 },
        zIndex: 1,
        focused: false,
        minimized: false,
        locked: false,
        lockMode: "screen-locked",
        clipboardPolicy: "platform-default",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

export function isWindowKind(value: string): value is WindowKind {
  return ["terminal", "code", "browser", "docs", "logs"].includes(value);
}

export function isSessionKind(value: string): value is SessionKind {
  return isWindowKind(value);
}
