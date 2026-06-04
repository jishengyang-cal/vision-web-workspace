export type WindowKind = "terminal" | "code" | "browser" | "docs" | "logs";

export type SessionKind = "terminal" | "code" | "browser" | "docs" | "logs";

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

export interface WebWindowSpec {
  id: string;
  title: string;
  kind: WindowKind;
  url: string;
  rect: Rect;
  minSize: Size;
  zIndex: number;
  focused: boolean;
  locked: boolean;
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
  targetLabel?: string;
  requestedUrl?: string;
}

export interface CreateSessionResponse {
  session: RemoteSessionSpec;
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
        rect: { x: 64, y: 88, width: 680, height: 420 },
        minSize: { width: 360, height: 240 },
        zIndex: 3,
        focused: true,
        locked: false
      },
      {
        id: "code",
        title: "Code",
        kind: "code",
        url: options.codeUrl ?? "http://localhost:8080",
        rect: { x: 760, y: 88, width: 620, height: 560 },
        minSize: { width: 420, height: 300 },
        zIndex: 2,
        focused: false,
        locked: false
      },
      {
        id: "browser",
        title: "Browser",
        kind: "browser",
        url: options.browserUrl ?? "https://example.com",
        rect: { x: 112, y: 536, width: 560, height: 300 },
        minSize: { width: 360, height: 240 },
        zIndex: 1,
        focused: false,
        locked: false
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
