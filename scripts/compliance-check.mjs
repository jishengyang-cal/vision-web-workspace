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
  "visionos:native:plan",
  "visionos:mac-build:check",
  "dev:mac-builder:agent",
  "serve:mac-builder:agent",
  "aws:mac:plan",
  "aws:mac:doctor",
  "aws:mac:cost-check",
  "aws:mac:ensure-budget",
  "aws:mac:deploy-baseline",
  "aws:mac:worker:plan",
  "aws:mac:worker:status",
  "aws:mac:worker:price-check",
  "aws:mac:worker:launch",
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
  "visionos:workflow:plan",
  "visionos:native:plan",
  "aws:mac:plan"
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
  "docs/workflows/app-store-release.md",
  "docs/workflows/mcp-and-hooks.md",
  "infra/aws-mac-builder/config.example.json",
  "infra/aws-mac-builder/baseline.cfn.yaml",
  "workflows/visionos-development.json",
  "skills/visionos-dev/SKILL.md",
  "skills/visionos-dev/references/boundaries.md",
  "skills/visionos-dev/agents/openai.yaml",
  "mcp/interfaces/mac-builder.json",
  "mcp/interfaces/app-store-release.json",
  "mcp/interfaces/docs-index.json",
  "mcp/interfaces/device-lab.json",
  "services/mac-builder-mock/src/index.ts",
  "services/mac-builder-agent/package.json",
  "services/mac-builder-agent/tsconfig.json",
  "services/mac-builder-agent/src/index.ts",
  "scripts/mac-builder-bootstrap.sh",
  "scripts/mac-builder-install-xcode.sh",
  "scripts/aws-mac-builder.mjs",
  "scripts/aws-mac-worker.mjs",
  "tests/mac-builder.e2e.mjs",
  "native/visionos/README.md",
  "native/visionos/project.yml",
  "native/visionos/VisionWebWorkspace/Info.plist",
  "native/visionos/VisionWebWorkspace/VisionWebWorkspaceApp.swift",
  "native/visionos/VisionWebWorkspace/Models/WorkspacePanelState.swift",
  "native/visionos/VisionWebWorkspace/Views/LauncherView.swift",
  "native/visionos/VisionWebWorkspace/Views/FollowWorkspaceImmersiveView.swift",
  "native/visionos/VisionWebWorkspace/Views/WorkspacePanelView.swift",
  "native/visionos/VisionWebWorkspace/Views/BrowserWindowView.swift",
  ".githooks/pre-commit",
  ".githooks/pre-push"
];
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    violations.push(`missing required workflow file: ${file}`);
  }
}

const workflow = JSON.parse(readFileSync("workflows/visionos-development.json", "utf8"));
if (workflow.nativeProject?.sourceRoot !== "native/visionos") {
  violations.push("visionOS workflow must declare nativeProject.sourceRoot");
}
if (workflow.nativeProject?.generator !== "xcodegen") {
  violations.push("visionOS workflow must declare xcodegen as the native project generator");
}
if (workflow.nativeProject?.projectPath !== "native/visionos/VisionWebWorkspace.xcodeproj") {
  violations.push("visionOS workflow must declare native projectPath");
}
if (workflow.defaultTarget?.sdk !== "xrsimulator") {
  violations.push("visionOS workflow default target must use xrsimulator");
}
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
if (!phaseIds.has("app-store-release-plan")) {
  violations.push("visionOS workflow is missing App Store release plan phase");
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
if (!macBuilderMock.includes("request.project")) {
  violations.push("mock Mac builder must validate structured project metadata");
}

const macBuilderAgent = readFileSync("services/mac-builder-agent/src/index.ts", "utf8");
if (!macBuilderAgent.includes('process.platform !== "darwin"')) {
  violations.push("native Mac builder agent must refuse Xcode execution off macOS");
}
if (!macBuilderAgent.includes('"xcodegen"') || !macBuilderAgent.includes('"xcodebuild"')) {
  violations.push("native Mac builder agent must execute XcodeGen and xcodebuild only inside the agent");
}
if (!macBuilderAgent.includes("MAC_BUILDER_TOKEN")) {
  violations.push("native Mac builder agent must support token-gated access");
}

const macBuilderBootstrap = readFileSync("scripts/mac-builder-bootstrap.sh", "utf8");
if (!macBuilderBootstrap.includes("mac-builder-bootstrap must run on macOS")) {
  violations.push("Mac builder bootstrap must refuse non-macOS execution");
}

const macBuilderInstallXcode = readFileSync("scripts/mac-builder-install-xcode.sh", "utf8");
if (!macBuilderInstallXcode.includes("XCODE_XIP_PATH") || !macBuilderInstallXcode.includes("XCODE_S3_URI")) {
  violations.push("Xcode installer must require an explicit Xcode.xip path or S3 URI");
}
if (/APPLE_ID|APP_STORE_PASSWORD|FASTLANE_SESSION/.test(macBuilderInstallXcode)) {
  violations.push("Xcode installer must not embed Apple account credential flow");
}

const nativeProjectSpec = readFileSync("native/visionos/project.yml", "utf8");
if (!nativeProjectSpec.includes("platform: visionOS")) {
  violations.push("native XcodeGen project must target visionOS");
}
if (!nativeProjectSpec.includes("PRODUCT_BUNDLE_IDENTIFIER: com.jishengyang.visionwebworkspace")) {
  violations.push("native project must declare the product bundle identifier");
}
if (!nativeProjectSpec.includes("VisionWebWorkspace")) {
  violations.push("native project must declare the VisionWebWorkspace target");
}

const nativeApp = readFileSync("native/visionos/VisionWebWorkspace/VisionWebWorkspaceApp.swift", "utf8");
if (!nativeApp.includes("ImmersiveSpace") || !nativeApp.includes(".mixed")) {
  violations.push("native app must open a mixed ImmersiveSpace");
}

const workspaceState = readFileSync("native/visionos/VisionWebWorkspace/Models/WorkspacePanelState.swift", "utf8");
if (!workspaceState.includes('panelAttachmentID = "workspace-panel"')) {
  violations.push("native workspace state must define the workspace panel attachment id");
}

const immersiveView = readFileSync("native/visionos/VisionWebWorkspace/Views/FollowWorkspaceImmersiveView.swift", "utf8");
if (!immersiveView.includes("RealityView") || !immersiveView.includes("panelAttachmentID")) {
  violations.push("native immersive view must render the workspace panel as a RealityView attachment");
}

const browserWindow = readFileSync("native/visionos/VisionWebWorkspace/Views/BrowserWindowView.swift", "utf8");
if (!browserWindow.includes("WKWebView")) {
  violations.push("native browser window must include WKWebView prototype surface");
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
if (!awsWorkflow.includes("100 USD monthly cap")) {
  violations.push("AWS EC2 Mac workflow must document the 100 USD cost guard");
}

const awsConfig = JSON.parse(readFileSync("infra/aws-mac-builder/config.example.json", "utf8"));
if (awsConfig.monthlyBudgetLimitUsd !== 100) {
  violations.push("AWS Mac Builder example config must preserve 100 USD budget limit");
}

const awsBaselineTemplate = readFileSync("infra/aws-mac-builder/baseline.cfn.yaml", "utf8");
if (/AWS::EC2::Host|AWS::EC2::Instance|allocate-hosts|run-instances|mac[0-9a-z.-]*\.metal/i.test(awsBaselineTemplate)) {
  violations.push("AWS baseline template must not allocate or run EC2 Mac resources");
}

const awsScript = readFileSync("scripts/aws-mac-builder.mjs", "utf8");
if (/\[\s*["']ec2["']\s*,\s*["'](?:allocate-hosts|run-instances)["']/.test(awsScript)) {
  violations.push("AWS Mac Builder script must not allocate hosts or run instances in baseline phase");
}

const awsWorkerScript = readFileSync("scripts/aws-mac-worker.mjs", "utf8");
if (!awsWorkerScript.includes("AWS_MAC_WORKER_CONFIRM") || !awsWorkerScript.includes("allocate-24h-mac-host")) {
  violations.push("AWS Mac Worker launch script must require explicit 24h allocation confirmation");
}
if (!awsWorkerScript.includes("getHourlyPriceUsd") || !awsWorkerScript.includes("assertCostAllowed")) {
  violations.push("AWS Mac Worker launch script must enforce price and cost guards");
}
if (!awsWorkerScript.includes("allocate-hosts") || !awsWorkerScript.includes("run-instances")) {
  violations.push("AWS Mac Worker launch script must own EC2 Mac allocation and launch actions");
}

const releaseWorkflow = readFileSync("docs/workflows/app-store-release.md", "utf8");
if (!releaseWorkflow.includes("AppUploader/AppUploader CLI can be evaluated as an optional release-uploader")) {
  violations.push("release workflow must treat AppUploader as optional");
}
if (!releaseWorkflow.includes("must not receive")) {
  violations.push("release workflow must preserve credential boundary");
}

const releaseInterface = JSON.parse(readFileSync("mcp/interfaces/app-store-release.json", "utf8"));
const appuploaderBackend = releaseInterface.uploadBackends?.find((backend) => backend.id === "appuploader-cli");
if (!appuploaderBackend || appuploaderBackend.mode !== "optional-third-party-fallback" || appuploaderBackend.requiresApproval !== true) {
  violations.push("AppUploader CLI must remain an explicitly approved optional fallback");
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
