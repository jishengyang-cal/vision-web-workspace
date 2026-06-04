import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const violations = [];

const trackedFiles = run("git ls-files")
  .split("\n")
  .filter(Boolean);

const trackedForbidden = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.run\//,
  /(^|\/)(playwright-report|test-results)\//,
  /\.tsbuildinfo$/,
  /\.xcresult($|\/)/,
  /\.xcarchive($|\/)/,
  /\.(p12|cer|mobileprovision|provisionprofile)$/,
  /^\.env$/,
  /^\.env\./,
  /PRIVATE KEY/
];

for (const file of trackedFiles) {
  if (trackedForbidden.some((pattern) => pattern.test(file))) {
    violations.push(`generated or sensitive file is tracked: ${file}`);
  }
}

const trackedText = trackedFiles
  .filter((file) => isTextLike(file))
  .map((file) => ({ file, content: readFileSync(file, "utf8") }));

for (const { file, content } of trackedText) {
  if (/-----BEGIN (OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/.test(content)) {
    violations.push(`private key material found in ${file}`);
  }
  if (/(GITHUB_TOKEN|GH_TOKEN|AWS_SECRET_ACCESS_KEY|PRIVATE_KEY)\s*=/.test(content)) {
    violations.push(`secret-like assignment found in ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const requiredScripts = [
  "tools:doctor",
  "compliance:check",
  "workflow:check",
  "dev:services",
  "test:e2e",
  "test:mac-builder",
  "visionos:preflight",
  "visionos:workflow:plan",
  "visionos:mac-build:check",
  "hooks:install"
];
for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) {
    violations.push(`missing package script: ${script}`);
  }
}

const linuxRequiredScriptNames = [
  "dev",
  "build",
  "typecheck",
  "workflow:check",
  "test:e2e",
  "test:mac-builder",
  "visionos:preflight",
  "visionos:workflow:plan"
];
for (const name of linuxRequiredScriptNames) {
  const script = packageJson.scripts?.[name] ?? "";
  if (/\b(xcodebuild|xcrun|tuist|xcodegen)\b/.test(script)) {
    violations.push(`Linux-required script ${name} invokes Mac/Xcode-only tooling`);
  }
}

const catalog = JSON.parse(readFileSync("tools/tool-catalog.json", "utf8"));
for (const id of ["xcode", "xcodebuild", "xcrun", "xcrun-simctl", "xcresulttool"]) {
  const entry = catalog.tools.find((tool) => tool.id === id);
  if (!entry || entry.mode !== "mac-only") {
    violations.push(`${id} must be cataloged as mac-only`);
  }
}

const readme = readFileSync("README.md", "utf8");
if (!readme.includes("Without macOS, Xcode, and the visionOS SDK")) {
  violations.push("README must preserve no-Mac/no-Xcode hard boundary");
}

const architecture = readFileSync("docs/architecture.md", "utf8");
if (!architecture.includes("does not give the Vision Pro client direct access")) {
  violations.push("architecture must preserve Vision Pro client authority boundary");
}

const requiredFiles = [
  "docs/workflows/visionos-development.md",
  "docs/workflows/aws-ec2-mac-builder.md",
  "docs/workflows/mcp-and-hooks.md",
  "workflows/visionos-development.json",
  "skills/visionos-dev/SKILL.md",
  "skills/visionos-dev/references/boundaries.md",
  "skills/visionos-dev/agents/openai.yaml",
  "mcp/interfaces/mac-builder.json",
  "mcp/interfaces/docs-index.json",
  "mcp/interfaces/device-lab.json",
  "services/mac-builder-mock/src/index.ts",
  "tests/mac-builder.e2e.mjs",
  ".githooks/pre-commit",
  ".githooks/pre-push"
];
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    violations.push(`missing required workflow file: ${file}`);
  }
}

const workflow = JSON.parse(readFileSync("workflows/visionos-development.json", "utf8"));
const phaseIds = new Set(workflow.phases.map((phase) => phase.id));
for (const id of ["preflight", "web-simulator", "native-build", "official-simulator-debug", "device-test", "release"]) {
  if (!phaseIds.has(id)) {
    violations.push(`visionOS workflow is missing phase: ${id}`);
  }
}
for (const id of ["mock-mac-builder", "mac-builder-e2e"]) {
  if (!phaseIds.has(id)) {
    violations.push(`visionOS workflow is missing mock builder phase: ${id}`);
  }
}
if (!phaseIds.has("aws-ec2-mac-builder-plan")) {
  violations.push("visionOS workflow is missing AWS EC2 Mac builder plan phase");
}
for (const phase of workflow.phases) {
  if (
    ["native-build", "official-simulator-debug", "device-test", "release"].includes(phase.id) &&
    !phase.capabilities.includes("mac-builder-required")
  ) {
    violations.push(`visionOS phase ${phase.id} must require mac-builder`);
  }
}

const skill = readFileSync("skills/visionos-dev/SKILL.md", "utf8");
if (!skill.includes("Do not claim native visionOS compile")) {
  violations.push("visionos-dev skill must preserve native toolchain boundary");
}

const mcpBoundary = readFileSync("docs/workflows/mcp-and-hooks.md", "utf8");
if (!/must not\s+receive direct access/.test(mcpBoundary)) {
  violations.push("MCP boundary doc must preserve no-direct-secret-access rule");
}

const macBuilderMock = readFileSync("services/mac-builder-mock/src/index.ts", "utf8");
if (/child_process|\bspawn(Sync)?\b|\bexecFile(Sync)?\b|\bexecSync\b/.test(macBuilderMock)) {
  violations.push("mock Mac builder must not execute local native tooling");
}

const macBuilderInterface = JSON.parse(readFileSync("mcp/interfaces/mac-builder.json", "utf8"));
if (macBuilderInterface.status !== "mock-implemented") {
  violations.push("mac-builder MCP interface must record mock implementation status");
}
if (macBuilderInterface.awsEc2MacDeployment?.minimumHostAllocationHours !== 24) {
  violations.push("mac-builder MCP interface must record AWS EC2 Mac 24-hour minimum host allocation");
}

const awsWorkflow = readFileSync("docs/workflows/aws-ec2-mac-builder.md", "utf8");
if (!awsWorkflow.includes("24-hour minimum allocation period")) {
  violations.push("AWS EC2 Mac workflow must document the 24-hour Dedicated Host minimum");
}
if (!awsWorkflow.includes("never receive AWS credentials")) {
  violations.push("AWS EC2 Mac workflow must preserve client credential boundary");
}

const preCommit = readFileSync(".githooks/pre-commit", "utf8");
if (!preCommit.includes("pnpm compliance:check")) {
  violations.push("pre-commit hook must run compliance check");
}

const prePush = readFileSync(".githooks/pre-push", "utf8");
if (!prePush.includes("pnpm workflow:check")) {
  violations.push("pre-push hook must run workflow check");
}

const compose = readFileSync("docker-compose.dev.yml", "utf8");
if (!compose.includes("127.0.0.1:7681:7681") || !compose.includes("127.0.0.1:8080:8080")) {
  violations.push("developer services must bind to loopback by default");
}
if (/0\.0\.0\.0:\d+:\d+/.test(compose)) {
  violations.push("developer services must not bind to 0.0.0.0 by default");
}

const gateway = readFileSync("services/gateway/src/index.ts", "utf8");
if (!gateway.includes('auditLevel: "lifecycle"')) {
  violations.push("gateway terminal sessions must default to lifecycle audit level");
}

if (violations.length > 0) {
  console.error("Workflow compliance check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Workflow compliance check passed.");

function run(command) {
  const result = spawnSync("bash", ["-lc", command], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Command failed: ${command}`);
  }
  return result.stdout.trim();
}

function isTextLike(file) {
  return /\.(json|md|mjs|js|ts|tsx|css|html|ya?ml|gitignore)$/.test(file) || file === "LICENSE";
}
