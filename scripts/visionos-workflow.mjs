import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const workflow = JSON.parse(readFileSync("workflows/visionos-development.json", "utf8"));
const command = process.argv[2] ?? "help";

switch (command) {
  case "plan":
    printPlan();
    break;
  case "preflight":
    runPreflight();
    break;
  case "mac-build-check":
    await runMacBuildCheck();
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

function printPlan() {
  console.log(`${workflow.name} workflow v${workflow.version}`);
  console.log(`Boundary: ${workflow.hardBoundary}\n`);

  for (const phase of workflow.phases) {
    const capabilities = phase.capabilities.join(", ");
    const runnable = phase.command ? phase.command : "future adapter";
    console.log(`${phase.id}`);
    console.log(`  title: ${phase.title}`);
    console.log(`  capabilities: ${capabilities}`);
    console.log(`  command: ${runnable}`);
    console.log(`  produces: ${phase.produces.join(", ")}`);
  }
}

function runPreflight() {
  console.log("Running visionOS workflow preflight.\n");
  run("pnpm", ["run", "tools:doctor"]);
  run("pnpm", ["run", "compliance:check"]);

  console.log("\nNative visionOS status:");
  console.log("- Linux workflow: available.");
  console.log("- Native Xcode workflow: requires Mac builder or local macOS/Xcode.");
  console.log("- Device/release workflow: requires Apple credentials and explicit adapter.");
}

async function runMacBuildCheck() {
  const builderUrl = process.env.VISIONOS_MAC_BUILDER_URL;

  if (builderUrl) {
    await runMacBuilderAdapter(builderUrl);
    return;
  }

  if (process.platform !== "darwin") {
    console.error("Native visionOS build is unavailable on this host.");
    console.error("Missing capability: macOS with Xcode and the visionOS SDK, or a Mac builder MCP adapter.");
    process.exit(2);
  }

  const xcodebuild = commandExists("xcodebuild");
  const xcrun = commandExists("xcrun");
  if (!xcodebuild || !xcrun) {
    console.error("Native visionOS build is unavailable on this Mac.");
    console.error(`xcodebuild: ${xcodebuild ? "found" : "missing"}`);
    console.error(`xcrun: ${xcrun ? "found" : "missing"}`);
    process.exit(2);
  }

  console.log("Mac-native Xcode tools are present.");
  console.log("Build execution must still go through an audited builder adapter before deployment authority is granted.");
}

async function runMacBuilderAdapter(builderUrl) {
  const baseUrl = builderUrl.replace(/\/$/, "");
  const request = createMacBuilderRequest();

  console.log(`Mac builder URL configured: ${baseUrl}`);
  console.log(`Submitting ${request.kind} job for ${request.repoRef.repository} at ${request.repoRef.commitSha}.`);

  const created = await postJson(`${baseUrl}/jobs`, request);
  let job = created.job;
  if (!job?.id) {
    throw new Error("Mac builder response did not include a job id");
  }

  console.log(`Mac builder job accepted: ${job.id}`);
  console.log(`status: ${job.status}`);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (isTerminalStatus(job.status)) {
      break;
    }

    await delay(Number(process.env.VISIONOS_MAC_BUILDER_POLL_MS ?? 250));
    const response = await getJson(`${baseUrl}/jobs/${encodeURIComponent(job.id)}`);
    job = response.job;
    console.log(`status: ${job.status}`);
  }

  printMacBuilderResult(job);

  if (job.status === "succeeded") {
    return;
  }

  if (job.status === "failed" || job.status === "cancelled") {
    process.exit(1);
  }

  console.error(`Mac builder job did not finish: ${job.status}`);
  process.exit(2);
}

function createMacBuilderRequest() {
  const now = new Date().toISOString();
  const kind = normalizeJobKind(process.env.VISIONOS_MAC_BUILDER_JOB_KIND ?? "build");
  const repoRef = createRepoRef();
  const requestId = `mac-build-${Date.now()}`;
  const base = {
    kind,
    repoRef,
    target: {
      scheme: process.env.VISIONOS_SCHEME ?? "VisionWebWorkspace",
      configuration: process.env.VISIONOS_CONFIGURATION ?? "Debug",
      destination: process.env.VISIONOS_DESTINATION ?? "platform=visionOS Simulator,name=Apple Vision Pro",
      sdk: process.env.VISIONOS_SDK ?? "xrsimulator"
    },
    audit: {
      requestId,
      actorId: process.env.VISIONOS_ACTOR_ID ?? process.env.USER ?? "local-agent",
      reason: process.env.VISIONOS_AUDIT_REASON ?? "workflow mac build check",
      source: "cli",
      requestedAt: now,
      decision: {
        status: "allowed",
        policyId: process.env.VISIONOS_POLICY_ID ?? "local-mock-policy",
        reason: process.env.VISIONOS_APPROVAL_REASON ?? "local workflow adapter request",
        decidedBy: process.env.VISIONOS_APPROVED_BY ?? process.env.USER ?? "local-agent",
        decidedAt: now
      },
      traceId: process.env.VISIONOS_TRACE_ID ?? requestId
    },
    capabilities: ["mac-builder-required", "mcp-candidate"],
    metadata: {
      adapter: "visionos-workflow",
      mode: process.env.VISIONOS_MAC_BUILDER_MODE ?? "mock-compatible"
    }
  };

  if (process.env.MOCK_MAC_BUILDER_RESULT) {
    base.metadata.mockResult = process.env.MOCK_MAC_BUILDER_RESULT;
  }

  if (kind === "archive") {
    return {
      ...base,
      kind,
      target: {
        ...base.target,
        configuration: process.env.VISIONOS_CONFIGURATION ?? "Release",
        sdk: process.env.VISIONOS_SDK ?? "xros"
      },
      exportMethod: process.env.VISIONOS_EXPORT_METHOD ?? "development"
    };
  }

  if (kind === "simulator-test") {
    return {
      ...base,
      kind,
      testPlan: process.env.VISIONOS_TEST_PLAN ?? "Default"
    };
  }

  return { ...base, kind };
}

function normalizeJobKind(value) {
  if (["build", "simulator-test", "archive"].includes(value)) {
    return value;
  }
  throw new Error(`Unsupported VISIONOS_MAC_BUILDER_JOB_KIND: ${value}`);
}

function createRepoRef() {
  const remoteUrl = git(["config", "--get", "remote.origin.url"]) || "local";
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const commitSha = git(["rev-parse", "HEAD"]) || "unknown";

  return {
    provider: remoteUrl.includes("github.com") ? "github" : "local",
    repository: repositoryNameFromRemote(remoteUrl),
    remoteUrl,
    branch,
    commitSha
  };
}

function repositoryNameFromRemote(remoteUrl) {
  const sshMatch = /github\.com[^:]*:([^/]+\/[^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch) {
    return sshMatch[1];
  }

  const httpsMatch = /github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  return remoteUrl === "local" ? "local/vision-web-workspace" : remoteUrl;
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJsonResponse(response, url);
}

async function getJson(url) {
  const response = await fetch(url);
  return parseJsonResponse(response, url);
}

async function parseJsonResponse(response, url) {
  const text = await response.text();
  let payload;
  try {
    payload = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response from ${url}: ${text}`);
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

function printMacBuilderResult(job) {
  console.log(`Mac builder job ${job.id} finished with status: ${job.status}`);

  if (job.failureReason) {
    console.log(`failure: ${job.failureReason}`);
  }

  if (job.logs?.length) {
    console.log("logs:");
    for (const entry of job.logs) {
      console.log(`  [${entry.level}] ${entry.message}`);
    }
  }

  if (job.artifacts?.length) {
    console.log("artifacts:");
    for (const artifact of job.artifacts) {
      console.log(`  ${artifact.type}: ${artifact.name} -> ${artifact.uri}`);
    }
  }

  if (job.xcresult) {
    console.log(`xcresult: ${job.xcresult.uri}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(cmd) {
  const result = spawnSync("bash", ["-lc", `command -v ${cmd}`], { encoding: "utf8" });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function printHelp() {
  console.log("Usage: node scripts/visionos-workflow.mjs <command>");
  console.log("");
  console.log("Commands:");
  console.log("  plan             Print the staged visionOS workflow.");
  console.log("  preflight        Run local tool and compliance checks.");
  console.log("  mac-build-check  Check native visionOS build capability boundary.");
}
