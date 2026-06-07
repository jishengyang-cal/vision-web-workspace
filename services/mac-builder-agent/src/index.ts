import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync, symlinkSync } from "node:fs";
import { copyFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
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

type MutableJob = MacBuildJob & { status: MacBuildJobStatus };

interface StoredJob {
  job: MutableJob;
  workDir: string;
  repoDir: string;
  artifactDir: string;
}

const port = Number(process.env.PORT ?? 3201);
const workRoot = resolve(process.env.MAC_BUILDER_WORK_ROOT ?? ".run/mac-builder-agent/work");
const artifactRoot = resolve(process.env.MAC_BUILDER_ARTIFACT_ROOT ?? ".run/mac-builder-agent/artifacts");
const token = process.env.MAC_BUILDER_TOKEN;
const artifactS3Uri = process.env.MAC_BUILDER_ARTIFACT_S3_URI?.replace(/\/$/, "");
const jobs = new Map<string, StoredJob>();
let activeJob: Promise<void> = Promise.resolve();

mkdirSync(workRoot, { recursive: true });
mkdirSync(artifactRoot, { recursive: true });

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
    const statusCode = error instanceof Error ? ((error as Error & { statusCode?: number }).statusCode ?? 500) : 500;
    sendJson(response, statusCode, {
      error: error instanceof Error ? error.message : "Unexpected mac-builder-agent error"
    });
  }
});

server.listen(port, () => {
  console.log(`vision-web-workspace Mac builder agent listening on http://localhost:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "vision-web-workspace-mac-builder-agent",
      mode: "native-agent",
      platform: process.platform,
      nativeExecutionAvailable: process.platform === "darwin",
      capabilities: [
        "visionos.build",
        "visionos.testSimulator",
        "visionos.archive",
        "visionos.exportIpa",
        "visionos.uploadTestFlight"
      ]
    });
    return;
  }

  requireToken(request);

  if (request.method === "GET" && url.pathname === "/jobs") {
    const payload: ListMacBuildJobsResponse = {
      jobs: Array.from(jobs.values()).map((stored) => stored.job)
    };
    sendJson(response, 200, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/jobs") {
    const body = await readJson<MacBuildRequest>(request);
    const stored = createJob(body);
    jobs.set(stored.job.id, stored);
    activeJob = activeJob.then(() => runJob(stored)).catch((error) => {
      appendLog(stored.job, "error", error instanceof Error ? error.message : "Unexpected job failure");
      failJob(stored.job, "Mac builder worker crashed while running the job.");
    });

    const payload: CreateMacBuildJobResponse = { job: stored.job };
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

    const payload: GetMacBuildJobResponse = { job: stored.job };
    sendJson(response, 200, payload);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function createJob(request: MacBuildRequest): StoredJob {
  validateRequest(request);

  const now = new Date().toISOString();
  const id = randomUUID();
  const workDir = join(workRoot, id);
  const repoDir = join(workDir, "repo");
  const artifactDir = join(artifactRoot, id);
  mkdirSync(workDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });

  const job: MutableJob = {
    id,
    kind: request.kind,
    status: "queued",
    request,
    logs: [
      log(1, "info", `Accepted native ${request.kind} job for ${request.repoRef.repository}.`, now),
      log(2, "info", `Project ${request.project.scheme} at ${request.project.projectPath}.`, now)
    ],
    artifacts: [],
    createdAt: now,
    updatedAt: now
  };

  return { job, workDir, repoDir, artifactDir };
}

async function runJob(stored: StoredJob) {
  const { job } = stored;
  if (process.platform !== "darwin") {
    failJob(job, "Native Mac builder agent can execute Xcode jobs only on macOS.");
    return;
  }

  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.updatedAt = job.startedAt;
  appendLog(job, "info", "Native Mac builder job is running.");

  try {
    await cloneRepo(stored);
    await generateProject(stored);
    await runNativeCommand(stored);
    await collectArtifacts(stored);
    job.status = "succeeded";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    appendLog(job, "info", "Native Mac builder job completed successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Native Mac builder job failed.";
    appendLog(job, "error", message);
    failJob(job, classifyFailure(message));
    await collectFailureLog(stored);
  }
}

async function cloneRepo(stored: StoredJob) {
  const { job, repoDir } = stored;
  await runChecked(job, "git", ["clone", "--no-checkout", repoCloneUrl(job.request.repoRef.remoteUrl), repoDir], stored.workDir, {
    maskedArgs: ["clone", "--no-checkout", maskCloneUrl(job.request.repoRef.remoteUrl), repoDir]
  });
  await runChecked(job, "git", ["checkout", job.request.repoRef.commitSha], repoDir);
}

async function generateProject(stored: StoredJob) {
  const { job, repoDir } = stored;
  if (job.request.project.generator !== "xcodegen") {
    throw new Error(`Unsupported project generator: ${job.request.project.generator}`);
  }

  await runChecked(job, "xcodegen", ["generate", "--spec", job.request.project.generatorSpecPath ?? "project.yml"], repoDir);
}

async function runNativeCommand(stored: StoredJob) {
  const { job, repoDir, artifactDir } = stored;
  const resultBundlePath = join(artifactDir, "Result.xcresult");
  const projectPath = job.request.project.projectPath;

  if (job.kind === "simulator-test") {
    await runChecked(
      job,
      "xcodebuild",
      [
        "-project",
        projectPath,
        "-scheme",
        job.request.target.scheme,
        "-destination",
        job.request.target.destination,
        "-resultBundlePath",
        resultBundlePath,
        "test"
      ],
      repoDir
    );
    return;
  }

  if (job.kind === "archive") {
    await runArchiveCommand(stored, resultBundlePath);
    return;
  }

  await runChecked(
    job,
    "xcodebuild",
    [
      "-project",
      projectPath,
      "-scheme",
      job.request.target.scheme,
      "-configuration",
      job.request.target.configuration,
      "-destination",
      job.request.target.destination,
      "-sdk",
      job.request.target.sdk,
      "-resultBundlePath",
      resultBundlePath,
      "build"
    ],
    repoDir
  );
}

async function runArchiveCommand(stored: StoredJob, resultBundlePath: string) {
  const { job, repoDir, artifactDir } = stored;
  const projectPath = job.request.project.projectPath;
  const archivePath = join(artifactDir, "VisionWebWorkspace.xcarchive");
  const exportPath = join(artifactDir, "export");
  const exportOptionsPath = join(artifactDir, "ExportOptions.plist");

  await writeFile(exportOptionsPath, exportOptionsPlist(job));

  const archiveArgs = [
    "-project",
    projectPath,
    "-scheme",
    job.request.target.scheme,
    "-configuration",
    "Release",
    "-destination",
    archiveDestination(job),
    "-sdk",
    job.request.target.sdk,
    "-archivePath",
    archivePath,
    "-resultBundlePath",
    resultBundlePath,
    "archive"
  ];

  if (allowProvisioningUpdates(job)) {
    archiveArgs.push("-allowProvisioningUpdates");
  }

  await runChecked(job, "xcodebuild", archiveArgs, repoDir);

  mkdirSync(exportPath, { recursive: true });
  const exportArgs = [
    "-exportArchive",
    "-archivePath",
    archivePath,
    "-exportPath",
    exportPath,
    "-exportOptionsPlist",
    exportOptionsPath
  ];

  if (allowProvisioningUpdates(job)) {
    exportArgs.push("-allowProvisioningUpdates");
  }

  await runChecked(job, "xcodebuild", exportArgs, repoDir);

  const ipaPath = await findFileByExtension(exportPath, ".ipa");
  if (!ipaPath) {
    throw new Error("Archive export completed without producing an IPA.");
  }

  const rootIpaPath = join(artifactDir, basename(ipaPath));
  await copyFile(ipaPath, rootIpaPath);

  if (shouldUploadToTestFlight(job)) {
    await uploadIpaToTestFlight(stored, rootIpaPath);
  }
}

async function uploadIpaToTestFlight(stored: StoredJob, ipaPath: string) {
  const { job } = stored;
  ensureAppStoreConnectKeyMaterial();

  const keyId = process.env.MAC_BUILDER_APP_STORE_CONNECT_API_KEY_ID;
  const issuerId = process.env.MAC_BUILDER_APP_STORE_CONNECT_API_ISSUER_ID;
  if (!keyId || !issuerId) {
    throw new Error("TestFlight upload requires App Store Connect API key id and issuer id.");
  }

  appendLog(job, "info", "Uploading IPA to App Store Connect for TestFlight processing.");
  await runChecked(
    job,
    "xcrun",
    [
      "altool",
      "--upload-app",
      "--type",
      "ios",
      "-f",
      ipaPath,
      "--apiKey",
      keyId,
      "--apiIssuer",
      issuerId
    ],
    stored.repoDir,
    {
      maskedArgs: [
        "altool",
        "--upload-app",
        "--type",
        "ios",
        "-f",
        ipaPath,
        "--apiKey",
        "***",
        "--apiIssuer",
        "***"
      ]
    }
  );
}

function exportOptionsPlist(job: MutableJob) {
  const teamId = job.request.metadata?.teamId ?? process.env.APPLE_TEAM_ID;
  const signingStyle = job.request.metadata?.signingStyle ?? process.env.MAC_BUILDER_SIGNING_STYLE ?? "automatic";
  const method = exportOptionsMethod(job);
  const teamIdBlock = teamId
    ? `\n\t<key>teamID</key>\n\t<string>${escapePlist(teamId)}</string>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>method</key>
\t<string>${escapePlist(method)}</string>
\t<key>signingStyle</key>
\t<string>${escapePlist(signingStyle)}</string>
\t<key>stripSwiftSymbols</key>
\t<true/>
\t<key>thinning</key>
\t<string>&lt;none&gt;</string>${teamIdBlock}
</dict>
</plist>
`;
}

function exportOptionsMethod(job: MutableJob) {
  if (job.request.metadata?.xcodeExportMethod) {
    return job.request.metadata.xcodeExportMethod;
  }

  if (job.request.kind !== "archive") {
    return "debugging";
  }

  switch (job.request.exportMethod) {
    case "app-store":
      return "app-store-connect";
    case "ad-hoc":
      return "release-testing";
    case "development":
      return "debugging";
  }
}

function archiveDestination(job: MutableJob) {
  if (job.request.metadata?.archiveDestination) {
    return job.request.metadata.archiveDestination;
  }

  if (job.request.target.destination && !/Simulator/i.test(job.request.target.destination)) {
    return job.request.target.destination;
  }

  return "generic/platform=visionOS";
}

function allowProvisioningUpdates(job: MutableJob) {
  return (
    job.request.metadata?.allowProvisioningUpdates === "true" ||
    process.env.MAC_BUILDER_ALLOW_PROVISIONING_UPDATES === "1"
  );
}

function shouldUploadToTestFlight(job: MutableJob) {
  return (
    job.request.metadata?.testflightUpload === "true" &&
    process.env.MAC_BUILDER_ENABLE_TESTFLIGHT_UPLOAD === "1"
  );
}

function ensureAppStoreConnectKeyMaterial() {
  const keyId = process.env.MAC_BUILDER_APP_STORE_CONNECT_API_KEY_ID;
  if (!keyId) {
    throw new Error("TestFlight upload requires MAC_BUILDER_APP_STORE_CONNECT_API_KEY_ID.");
  }

  const keyDir = join(process.env.HOME ?? ".", ".appstoreconnect", "private_keys");
  const targetPath = join(keyDir, `AuthKey_${keyId}.p8`);
  const sourcePath = process.env.MAC_BUILDER_APP_STORE_CONNECT_API_PRIVATE_KEY_PATH;

  if (existsSync(targetPath)) {
    return;
  }

  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error("TestFlight upload requires an App Store Connect private key file.");
  }

  mkdirSync(keyDir, { recursive: true });
  symlinkSync(sourcePath, targetPath);
}

async function findFileByExtension(directory: string, extension: string): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFileByExtension(path, extension);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(extension)) {
      return path;
    }
  }

  return null;
}

function escapePlist(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function runChecked(
  job: MutableJob,
  command: string,
  args: string[],
  cwd: string,
  options: { maskedArgs?: string[] } = {}
) {
  appendLog(job, "info", `$ ${command} ${(options.maskedArgs ?? args).join(" ")}`);
  const output = await runProcess(command, args, cwd, (line) => appendLog(job, "info", line));
  const logPath = join(artifactRoot, job.id, `${command}-${Date.now()}.log`);
  await writeFile(logPath, output);
}

function runProcess(command: string, args: string[], cwd: string, onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: childEnv() });
    const chunks: Buffer[] = [];
    let pending = "";

    const collect = (chunk: Buffer) => {
      chunks.push(Buffer.from(chunk));
      if (!onLine) {
        return;
      }
      pending += chunk.toString("utf8");
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines.map((value) => value.trim()).filter(Boolean).slice(-12)) {
        onLine(line);
      }
    };

    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(chunks).toString("utf8");
      if (pending.trim() && onLine) {
        onLine(pending.trim());
      }
      if (code === 0) {
        resolvePromise(output);
        return;
      }
      reject(new Error(`${command} failed with exit code ${code}\n${tail(output, 40).join("\n")}`));
    });
  });
}

async function collectArtifacts(stored: StoredJob) {
  const { job, artifactDir } = stored;
  await packageDirectoryArtifacts(stored);
  const entries = await readdir(artifactDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      continue;
    }
    const path = join(artifactDir, entry.name);
    const type = artifactType(entry.name, job.kind);
    const artifact = await createArtifact(job.id, type, entry.name, path);
    job.artifacts.push(artifact);

    if (artifact.type === "xcresult") {
      job.xcresult = artifact;
    }
  }
}

async function collectFailureLog(stored: StoredJob) {
  const logPath = join(stored.artifactDir, "failure.log");
  await writeFile(logPath, stored.job.logs.map((entry) => `[${entry.level}] ${entry.message}`).join("\n"));
  stored.job.artifacts.push(await createArtifact(stored.job.id, "log", "failure.log", logPath));
}

async function packageDirectoryArtifacts(stored: StoredJob) {
  const entries = await readdir(stored.artifactDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!entry.name.endsWith(".xcresult") && !entry.name.endsWith(".xcarchive")) {
      continue;
    }

    const sourcePath = join(stored.artifactDir, entry.name);
    const zipPath = join(stored.artifactDir, `${entry.name}.zip`);
    await runChecked(stored.job, "ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", sourcePath, zipPath], stored.artifactDir);
  }
}

async function createArtifact(
  jobId: string,
  type: MacBuildArtifact["type"],
  name: string,
  path: string
): Promise<MacBuildArtifact> {
  const stats = statSync(path);
  const uri = await publishArtifact(jobId, name, path);
  return {
    id: randomUUID(),
    type,
    name,
    uri,
    createdAt: new Date().toISOString(),
    ...(stats.isFile() ? { sizeBytes: stats.size, sha256: await sha256(path) } : {})
  };
}

function artifactType(name: string, kind: MacBuildJobKind): MacBuildArtifact["type"] {
  if (name.endsWith(".xcresult")) {
    return "xcresult";
  }
  if (name.endsWith(".xcresult.zip")) {
    return "xcresult";
  }
  if (name.endsWith(".xcarchive")) {
    return "archive";
  }
  if (name.endsWith(".xcarchive.zip")) {
    return "archive";
  }
  if (name.endsWith(".ipa")) {
    return "ipa";
  }
  if (name.endsWith(".png")) {
    return "screenshot";
  }
  if (name.endsWith(".log")) {
    return "log";
  }
  if (name.endsWith(".plist")) {
    return "log";
  }
  return kind === "archive" ? "archive" : "build-products";
}

async function publishArtifact(jobId: string, name: string, path: string) {
  if (artifactS3Uri) {
    const destination = `${artifactS3Uri}/jobs/${jobId}/artifacts/${encodeURIComponent(name)}`;
    await runProcess("aws", ["s3", "cp", path, destination], process.cwd());
    return destination;
  }

  const baseUrl = process.env.MAC_BUILDER_ARTIFACT_BASE_URL?.replace(/\/$/, "");
  if (baseUrl) {
    return `${baseUrl}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(name)}`;
  }

  return `file://${path}`;
}

function repoCloneUrl(remoteUrl: string) {
  const token = process.env.MAC_BUILDER_GITHUB_TOKEN;
  if (!token || !remoteUrl.includes("github.com")) {
    return remoteUrl;
  }

  const match = /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/.exec(remoteUrl);
  if (!match) {
    return remoteUrl;
  }
  return `https://x-access-token:${token}@github.com/${match[1]}.git`;
}

function maskCloneUrl(remoteUrl: string) {
  if (process.env.MAC_BUILDER_GITHUB_TOKEN && remoteUrl.includes("github.com")) {
    return "https://x-access-token:***@github.com/<repo>.git";
  }
  return remoteUrl;
}

function childEnv() {
  const env = { ...process.env };
  if (process.env.MAC_BUILDER_GIT_SSH_COMMAND) {
    env.GIT_SSH_COMMAND = process.env.MAC_BUILDER_GIT_SSH_COMMAND;
  }
  return env;
}

function classifyFailure(message: string) {
  if (/xcodebuild.*ENOENT|xcodebuild: command not found|unable to find utility "xcodebuild"/i.test(message)) {
    return "xcode-not-installed";
  }
  if (/xrsimulator|visionOS.*not installed|SDK.*not found/i.test(message)) {
    return "visionos-sdk-missing";
  }
  if (/CodeSign|Signing|provisioning profile|Development Team/i.test(message)) {
    return "signing-configuration-failed";
  }
  if (/git.*Authentication|Permission denied|repository.*not found/i.test(message)) {
    return "repository-auth-failed";
  }
  return message;
}

async function sha256(path: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function validateRequest(request: MacBuildRequest) {
  if (!["build", "simulator-test", "archive"].includes(request.kind)) {
    throw new Error(`Unsupported Mac builder request kind: ${(request as { kind?: string }).kind ?? "missing"}`);
  }
  if (!request.repoRef?.commitSha || !request.repoRef.repository || !request.repoRef.remoteUrl) {
    throw new Error("Mac builder request requires repoRef repository, remoteUrl, and commitSha");
  }
  if (!request.project?.sourceRoot || !request.project.projectPath || !request.project.scheme || !request.project.generator) {
    throw new Error("Mac builder request requires project sourceRoot, projectPath, scheme, and generator");
  }
  if (!request.target?.scheme || !request.target.configuration || !request.target.destination || !request.target.sdk) {
    throw new Error("Mac builder request requires target scheme, configuration, destination, and sdk");
  }
  if (!request.audit?.decision || request.audit.decision.status !== "allowed") {
    throw new Error("Mac builder agent accepts only allowed audit decisions");
  }
  if (request.kind === "archive" && !("exportMethod" in request)) {
    throw new Error("Archive requests require exportMethod");
  }
}

function requireToken(request: IncomingMessage) {
  if (!token) {
    return;
  }

  const auth = request.headers.authorization ?? "";
  if (auth !== `Bearer ${token}`) {
    const error = new Error("Mac builder token is missing or invalid");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

function failJob(job: MutableJob, reason: string) {
  job.status = "failed";
  job.failureReason = reason;
  job.finishedAt = new Date().toISOString();
  job.updatedAt = job.finishedAt;
}

function appendLog(job: MutableJob, level: MacBuildLogEntry["level"], message: string) {
  const now = new Date().toISOString();
  job.logs.push(log(nextSequence(job.logs), level, message, now));
  job.updatedAt = now;
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
  response.setHeader("access-control-allow-headers", "authorization,content-type");
}

function tail(value: string, lines: number) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lines);
}
