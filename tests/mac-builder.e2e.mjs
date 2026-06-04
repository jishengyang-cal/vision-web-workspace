import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const port = 3131;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("node", ["services/mac-builder-mock/dist/index.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

const serverOutput = [];
server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString("utf8")));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString("utf8")));

try {
  await waitForHealth();
  assertMockDoesNotExecuteNativeTools();
  await testSuccessfulJobLifecycle();
  await testFailedJobLifecycle();
  testWorkflowAdapterSuccess();
  testNoBuilderBoundary();
  console.log("Mac builder mock e2e passed.");
} finally {
  server.kill("SIGTERM");
}

async function testSuccessfulJobLifecycle() {
  const created = await postJson("/jobs", createRequest("build", "succeeded"));
  assert.equal(created.job.status, "queued");
  assert.equal(created.job.kind, "build");
  assert.ok(created.job.audit ?? created.job.request.audit);

  const running = await getJson(`/jobs/${created.job.id}`);
  assert.equal(running.job.status, "running");

  const completed = await getJson(`/jobs/${created.job.id}`);
  assert.equal(completed.job.status, "succeeded");
  assert.ok(completed.job.logs.length >= 3);
  assert.ok(completed.job.artifacts.some((artifact) => artifact.type === "build-products"));
  assert.ok(completed.job.artifacts.some((artifact) => artifact.type === "xcresult"));
  assert.ok(completed.job.xcresult.uri.startsWith("mock://mac-builder/jobs/"));
}

async function testFailedJobLifecycle() {
  const created = await postJson("/jobs", createRequest("simulator-test", "failed"));
  assert.equal(created.job.status, "queued");

  const running = await getJson(`/jobs/${created.job.id}`);
  assert.equal(running.job.status, "running");

  const failed = await getJson(`/jobs/${created.job.id}`);
  assert.equal(failed.job.status, "failed");
  assert.match(failed.job.failureReason, /asked to fail/);
  assert.ok(failed.job.logs.some((entry) => entry.level === "error"));
  assert.ok(failed.job.artifacts.some((artifact) => artifact.type === "log"));
}

function testWorkflowAdapterSuccess() {
  const result = spawnSync("node", ["scripts/visionos-workflow.mjs", "mac-build-check"], {
    encoding: "utf8",
    env: {
      ...process.env,
      VISIONOS_MAC_BUILDER_URL: baseUrl,
      VISIONOS_MAC_BUILDER_POLL_MS: "1"
    }
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Mac builder job accepted/);
  assert.match(result.stdout, /status: running/);
  assert.match(result.stdout, /status: succeeded/);
  assert.match(result.stdout, /artifacts:/);
  assert.match(result.stdout, /xcresult:/);
}

function testNoBuilderBoundary() {
  if (process.platform === "darwin") {
    return;
  }

  const result = spawnSync("node", ["scripts/visionos-workflow.mjs", "mac-build-check"], {
    encoding: "utf8",
    env: withoutBuilderUrl()
  });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /Native visionOS build is unavailable on this host/);
  assert.match(result.stderr, /Missing capability: macOS with Xcode and the visionOS SDK/);
}

function assertMockDoesNotExecuteNativeTools() {
  const source = readFileSync("services/mac-builder-mock/src/index.ts", "utf8");
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\bspawn(Sync)?\b|\bexecFile(Sync)?\b|\bexecSync\b/);
}

function createRequest(kind, mockResult) {
  const now = new Date().toISOString();
  const request = {
    kind,
    repoRef: {
      provider: "github",
      repository: "jishengyang-cal/vision-web-workspace",
      remoteUrl: "git@github.com:jishengyang-cal/vision-web-workspace.git",
      branch: "main",
      commitSha: "0000000000000000000000000000000000000000"
    },
    project: {
      sourceRoot: "native/visionos",
      projectPath: "native/visionos/VisionWebWorkspace.xcodeproj",
      scheme: "VisionWebWorkspace",
      generator: "xcodegen",
      generatorSpecPath: "native/visionos/project.yml"
    },
    target: {
      scheme: "VisionWebWorkspace",
      configuration: kind === "archive" ? "Release" : "Debug",
      destination: "platform=visionOS Simulator,name=Apple Vision Pro",
      sdk: kind === "archive" ? "xros" : "xrsimulator"
    },
    audit: {
      requestId: `test-${Date.now()}`,
      actorId: "mac-builder-e2e",
      reason: "e2e test",
      source: "ci",
      requestedAt: now,
      decision: {
        status: "allowed",
        policyId: "test-policy",
        reason: "test approval",
        decidedBy: "mac-builder-e2e",
        decidedAt: now
      },
      traceId: `trace-${Date.now()}`
    },
    capabilities: ["mac-builder-required", "mcp-candidate"],
    metadata: { mockResult }
  };

  if (kind === "archive") {
    return { ...request, exportMethod: "development" };
  }

  if (kind === "simulator-test") {
    return { ...request, testPlan: "Default" };
  }

  return request;
}

async function waitForHealth() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const health = await getJson("/health");
      assert.equal(health.ok, true);
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error(`Mock Mac builder did not become healthy.\n${serverOutput.join("")}`);
}

async function postJson(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse(response, path);
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return parseResponse(response, path);
}

async function parseResponse(response, path) {
  const payload = await response.json();
  assert.ok(response.ok, `${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function withoutBuilderUrl() {
  const env = { ...process.env };
  delete env.VISIONOS_MAC_BUILDER_URL;
  return env;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
