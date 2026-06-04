import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  type CreateMacBuildJobResponse,
  type GetMacBuildJobResponse,
  type ListMacBuildJobsResponse,
  type MacBuildArtifact,
  type MacBuildJob,
  type MacBuildJobKind,
  type MacBuildJobStatus,
  type MacBuildLogEntry,
  type MacBuildRequest
} from "@vision-web-workspace/contracts";

type TerminalResult = Extract<MacBuildJobStatus, "succeeded" | "failed">;

interface StoredJob {
  job: MacBuildJob;
  pollCount: number;
  terminalResult: TerminalResult;
}

const port = Number(process.env.PORT ?? 3101);
const jobs = new Map<string, StoredJob>();

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
      error: error instanceof Error ? error.message : "Unexpected mac-builder-mock error"
    });
  }
});

server.listen(port, () => {
  console.log(`vision-web-workspace mock Mac builder listening on http://localhost:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "vision-web-workspace-mac-builder-mock",
      mode: "mock",
      capabilities: ["visionos.build", "visionos.testSimulator", "visionos.archive"]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/jobs") {
    const payload: ListMacBuildJobsResponse = {
      jobs: Array.from(jobs.values()).map((stored) => stored.job)
    };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/jobs") {
    const body = await readJson<MacBuildRequest>(request);
    const created = createJob(body);
    jobs.set(created.job.id, created);
    const payload: CreateMacBuildJobResponse = { job: created.job };
    sendJson(response, 202, payload);
    return;
  }

  const jobMatch = /^\/jobs\/([^/]+)$/.exec(url.pathname);
  const jobId = jobMatch?.[1];
  if (request.method === "GET" && jobId) {
    const stored = jobs.get(jobId);
    if (!stored) {
      sendJson(response, 404, { error: `Unknown job: ${jobId}` });
      return;
    }

    advanceJob(stored);
    const payload: GetMacBuildJobResponse = { job: stored.job };
    sendJson(response, 200, payload);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function createJob(request: MacBuildRequest): StoredJob {
  validateRequest(request);

  const now = new Date().toISOString();
  const job: MacBuildJob = {
    id: randomUUID(),
    kind: request.kind,
    status: "queued",
    request,
    logs: [
      log(1, "info", `Accepted mock ${request.kind} job for ${request.repoRef.repository} at ${request.repoRef.commitSha}.`, now)
    ],
    artifacts: [],
    createdAt: now,
    updatedAt: now
  };

  return {
    job,
    pollCount: 0,
    terminalResult: resolveTerminalResult(request)
  };
}

function validateRequest(request: MacBuildRequest) {
  if (!["build", "simulator-test", "archive"].includes(request.kind)) {
    throw new Error(`Unsupported Mac builder request kind: ${(request as { kind?: string }).kind ?? "missing"}`);
  }
  if (!request.repoRef?.commitSha || !request.repoRef.repository) {
    throw new Error("Mac builder request requires repoRef.repository and repoRef.commitSha");
  }
  if (!request.target?.scheme || !request.target.configuration || !request.target.destination || !request.target.sdk) {
    throw new Error("Mac builder request requires target scheme, configuration, destination, and sdk");
  }
  if (!request.audit?.decision || request.audit.decision.status !== "allowed") {
    throw new Error("Mac builder mock accepts only allowed audit decisions");
  }
  if (request.kind === "archive" && !("exportMethod" in request)) {
    throw new Error("Archive requests require exportMethod");
  }
}

function resolveTerminalResult(request: MacBuildRequest): TerminalResult {
  const requested = request.metadata?.mockResult ?? process.env.MOCK_MAC_BUILDER_RESULT ?? "succeeded";
  return requested === "failed" ? "failed" : "succeeded";
}

function advanceJob(stored: StoredJob) {
  if (stored.job.status === "succeeded" || stored.job.status === "failed" || stored.job.status === "cancelled") {
    return;
  }

  stored.pollCount += 1;
  const now = new Date().toISOString();

  if (stored.job.status === "queued") {
    stored.job.status = "running";
    stored.job.startedAt = now;
    stored.job.updatedAt = now;
    stored.job.logs.push(log(nextSequence(stored.job.logs), "info", "Mock Mac builder job is running.", now));
    return;
  }

  if (stored.pollCount < 2) {
    stored.job.updatedAt = now;
    return;
  }

  stored.job.status = stored.terminalResult;
  stored.job.finishedAt = now;
  stored.job.updatedAt = now;

  if (stored.terminalResult === "failed") {
    stored.job.failureReason = "Mock Mac builder was asked to fail this job.";
    stored.job.logs.push(log(nextSequence(stored.job.logs), "error", stored.job.failureReason, now));
    stored.job.artifacts = [createArtifact(stored.job.id, "log", "mock-build.log", now)];
    return;
  }

  stored.job.logs.push(log(nextSequence(stored.job.logs), "info", "Mock Mac builder job completed successfully.", now));
  stored.job.artifacts = createArtifacts(stored.job.id, stored.job.kind, now);
  const xcresult = stored.job.artifacts.find((artifact) => artifact.type === "xcresult");
  if (xcresult) {
    stored.job.xcresult = xcresult;
  }
}

function createArtifacts(jobId: string, kind: MacBuildJobKind, createdAt: string): MacBuildArtifact[] {
  const artifacts: MacBuildArtifact[] = [
    createArtifact(jobId, "log", "mock-build.log", createdAt),
    createArtifact(jobId, "xcresult", "MockResult.xcresult", createdAt)
  ];

  if (kind === "archive") {
    artifacts.push(createArtifact(jobId, "archive", "MockApp.xcarchive", createdAt));
    artifacts.push(createArtifact(jobId, "ipa", "MockApp.ipa", createdAt));
    return artifacts;
  }

  if (kind === "simulator-test") {
    artifacts.push(createArtifact(jobId, "screenshot", "mock-simulator.png", createdAt));
    return artifacts;
  }

  artifacts.push(createArtifact(jobId, "build-products", "MockBuildProducts.zip", createdAt));
  return artifacts;
}

function createArtifact(
  jobId: string,
  type: MacBuildArtifact["type"],
  name: string,
  createdAt: string
): MacBuildArtifact {
  return {
    id: randomUUID(),
    type,
    name,
    uri: `mock://mac-builder/jobs/${jobId}/artifacts/${encodeURIComponent(name)}`,
    createdAt,
    retentionExpiresAt: new Date(Date.parse(createdAt) + 1000 * 60 * 60 * 24).toISOString()
  };
}

function log(sequence: number, level: MacBuildLogEntry["level"], message: string, createdAt: string): MacBuildLogEntry {
  return { sequence, level, message, createdAt };
}

function nextSequence(logs: MacBuildLogEntry[]): number {
  return logs.length + 1;
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

function setCors(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}
