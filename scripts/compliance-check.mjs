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
  "visionos:testflight:plan",
  "visionos:testflight:preflight",
  "visionos:testflight:archive",
  "dev:mac-builder:agent",
  "serve:mac-builder:agent",
  "aws:mac:plan",
  "aws:mac:doctor",
  "aws:mac:cost-check",
  "aws:mac:ensure-budget",
  "aws:mac:deploy-baseline",
  "aws:mac:xcode:plan",
  "aws:mac:xcode:upload",
  "aws:mac:worker:plan",
  "aws:mac:worker:status",
  "aws:mac:worker:cost-status",
  "aws:mac:worker:quota-status",
  "aws:mac:worker:price-check",
  "aws:mac:worker:launch",
  "aws:mac:worker:ssm-tunnel",
  "aws:mac:worker:teardown",
  "mac-builder:xcode:verify",
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
  "visionos:testflight:plan",
  "visionos:testflight:preflight",
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
if (!readme.includes("implementation-first mode")) {
  violations.push("README must document the current Apple account review hold development mode");
}

const architecture = readFileSync("docs/architecture.md", "utf8");
if (!architecture.includes("does not give the Vision Pro client direct access")) {
  violations.push("architecture must preserve Vision Pro client authority boundary");
}

const requiredFiles = [
  "docs/workflows/visionos-development.md",
  "docs/workflows/aws-ec2-mac-builder.md",
  "docs/workflows/immersive-environments.md",
  "docs/workflows/remote-web-window-workspace.md",
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
  "scripts/aws-mac-xcode.mjs",
  "tests/mac-builder.e2e.mjs",
  "native/visionos/README.md",
  "native/visionos/project.yml",
  "native/visionos/VisionWebWorkspace/Info.plist",
  "native/visionos/VisionWebWorkspace/VisionWebWorkspaceApp.swift",
  "native/visionos/VisionWebWorkspace/Models/WorkspacePanelState.swift",
  "native/visionos/VisionWebWorkspace/Models/ImmersiveEnvironmentSceneFactory.swift",
  "native/visionos/VisionWebWorkspace/Models/GatewayModels.swift",
  "native/visionos/VisionWebWorkspace/Models/GatewayClient.swift",
  "native/visionos/VisionWebWorkspace/Views/LauncherView.swift",
  "native/visionos/VisionWebWorkspace/Views/NativeWebWindowHostView.swift",
  "native/visionos/VisionWebWorkspace/Views/FollowWorkspaceImmersiveView.swift",
  "native/visionos/VisionWebWorkspace/Views/ImmersiveEnvironmentView.swift",
  "native/visionos/VisionWebWorkspace/Views/WorkspacePanelView.swift",
  "native/visionos/VisionWebWorkspace/Views/WorkspaceMenuBarView.swift",
  "native/visionos/VisionWebWorkspace/Views/SpatialRemoteWebWindowView.swift",
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
if (workflow.releaseMode !== "implementation-first-account-review-hold") {
  violations.push("visionOS workflow must record the current implementation-first Apple account review hold mode");
}
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
for (const id of ["aws-mac-worker-guard", "xcode-artifact-plan", "native-gateway-protocol"]) {
  if (!phaseIds.has(id)) {
    violations.push(`visionOS workflow is missing phase: ${id}`);
  }
}
if (!phaseIds.has("immersive-environment-reconstruction")) {
  violations.push("visionOS workflow is missing immersive environment reconstruction phase");
}
if (!phaseIds.has("app-store-release-plan")) {
  violations.push("visionOS workflow is missing App Store release plan phase");
}
for (const id of ["full-scope-implementation", "apple-account-review-hold", "testflight-feature-acceptance"]) {
  if (!phaseIds.has(id)) {
    violations.push(`visionOS workflow is missing account-hold development phase: ${id}`);
  }
}
const phaseById = new Map(workflow.phases.map((phase) => [phase.id, phase]));
if (!phaseById.get("full-scope-implementation")?.command?.includes("pnpm workflow:check")) {
  violations.push("full-scope implementation phase must keep local workflow checks in the loop");
}
if (!phaseById.get("apple-account-review-hold")?.capabilities?.includes("apple-account-required")) {
  violations.push("Apple account review hold phase must remain apple-account-gated");
}
if (!phaseById.get("testflight-feature-acceptance")?.capabilities?.includes("device-required")) {
  violations.push("TestFlight feature acceptance phase must require the Vision Pro device boundary");
}
if (!phaseById.get("aws-mac-worker-guard")?.command?.includes("aws:mac:worker:quota-status")) {
  violations.push("AWS Mac worker guard phase must check quota status");
}
if (!phaseById.get("aws-mac-worker-guard")?.command?.includes("aws:mac:worker:cost-status")) {
  violations.push("AWS Mac worker guard phase must check cost status");
}
if (!phaseById.get("xcode-artifact-plan")?.capabilities?.includes("apple-account-required")) {
  violations.push("Xcode artifact phase must require an Apple account boundary");
}
if (!phaseById.get("native-gateway-protocol")?.capabilities?.includes("linux-runnable")) {
  violations.push("native Gateway protocol phase must remain Linux-runnable");
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
if (!macBuilderAgent.includes("-exportArchive") || !macBuilderAgent.includes("visionos.exportIpa")) {
  violations.push("native Mac builder agent must support audited archive export to IPA");
}
if (
  !macBuilderAgent.includes("MAC_BUILDER_ENABLE_TESTFLIGHT_UPLOAD") ||
  !macBuilderAgent.includes("MAC_BUILDER_APP_STORE_CONNECT_API_KEY_ID")
) {
  violations.push("native Mac builder agent must keep TestFlight upload behind explicit App Store Connect key configuration");
}

const visionosWorkflowScript = readFileSync("scripts/visionos-workflow.mjs", "utf8");
for (const command of ["testflight-plan", "testflight-preflight", "testflight-archive"]) {
  if (!visionosWorkflowScript.includes(command)) {
    violations.push(`visionOS workflow script must expose ${command}`);
  }
}
if (!visionosWorkflowScript.includes("VISIONOS_TESTFLIGHT_UPLOAD")) {
  violations.push("visionOS TestFlight workflow must keep upload as an explicit opt-in");
}

const macBuilderBootstrap = readFileSync("scripts/mac-builder-bootstrap.sh", "utf8");
if (!macBuilderBootstrap.includes("mac-builder-bootstrap must run on macOS")) {
  violations.push("Mac builder bootstrap must refuse non-macOS execution");
}
if (!macBuilderBootstrap.includes("MAC_BUILDER_SERVICE_MODE") || !macBuilderBootstrap.includes("LaunchDaemons")) {
  violations.push("Mac builder bootstrap must support headless EC2 Mac LaunchDaemon mode");
}
if (!macBuilderBootstrap.includes("MAC_BUILDER_TOKEN") || !macBuilderBootstrap.includes("<key>PATH</key>")) {
  violations.push("Mac builder bootstrap must support token-gated agent startup with an explicit tool PATH");
}

const macBuilderInstallXcode = readFileSync("scripts/mac-builder-install-xcode.sh", "utf8");
if (!macBuilderInstallXcode.includes("XCODE_XIP_PATH") || !macBuilderInstallXcode.includes("XCODE_S3_URI")) {
  violations.push("Xcode installer must require an explicit Xcode.xip path or S3 URI");
}
if (/APPLE_ID|APP_STORE_PASSWORD|FASTLANE_SESSION/.test(macBuilderInstallXcode)) {
  violations.push("Xcode installer must not embed Apple account credential flow");
}

const awsMacXcode = readFileSync("scripts/aws-mac-xcode.mjs", "utf8");
if (!awsMacXcode.includes("XCODE_XIP_PATH") || !awsMacXcode.includes("ArtifactBucketName")) {
  violations.push("AWS Xcode artifact uploader must require explicit Xcode.xip and use baseline artifact bucket");
}

const macBuilderVerifyXcode = readFileSync("scripts/mac-builder-verify-xcode.sh", "utf8");
if (!macBuilderVerifyXcode.includes("xcrun --sdk xrsimulator") || !macBuilderVerifyXcode.includes("visionOS")) {
  violations.push("Mac Builder Xcode verifier must check xrsimulator and visionOS runtime");
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
if (!nativeApp.includes("WindowGroup(\"Remote Web Window\"") || !nativeApp.includes("nativeWebWindowGroupID")) {
  violations.push("native app must expose native WindowGroup remote web windows");
}
if (!nativeApp.includes("officeEnvironmentSpaceID") || !nativeApp.includes("loungeEnvironmentSpaceID") || !nativeApp.includes(".full")) {
  violations.push("native app must expose full immersive office and water lounge spaces");
}

const workspaceState = readFileSync("native/visionos/VisionWebWorkspace/Models/WorkspacePanelState.swift", "utf8");
if (!workspaceState.includes('panelAttachmentID = "workspace-panel"')) {
  violations.push("native workspace state must define the workspace panel attachment id");
}
if (!workspaceState.includes("menuAttachmentID") || !workspaceState.includes("windowAttachmentPrefix")) {
  violations.push("native workspace state must define menu and remote window attachment ids");
}

const immersiveView = readFileSync("native/visionos/VisionWebWorkspace/Views/FollowWorkspaceImmersiveView.swift", "utf8");
if (
  !immersiveView.includes("RealityView") ||
  !immersiveView.includes("menuAttachmentID") ||
  !immersiveView.includes("windowAttachmentID") ||
  !immersiveView.includes("WorldTrackingProvider")
) {
  violations.push("native mixed workspace must render a head-tracked menu and remote web window attachments");
}

const browserWindow = readFileSync("native/visionos/VisionWebWorkspace/Views/BrowserWindowView.swift", "utf8");
if (!browserWindow.includes("WKWebView")) {
  violations.push("native browser window must include WKWebView prototype surface");
}

const nativeWebWindowHost = readFileSync("native/visionos/VisionWebWorkspace/Views/NativeWebWindowHostView.swift", "utf8");
if (!nativeWebWindowHost.includes("WebSurfaceView") || !nativeWebWindowHost.includes("openWindow")) {
  violations.push("native WindowGroup host must render web surfaces and open sibling native windows");
}
if (!nativeWebWindowHost.includes("toggleBookmark") || !nativeWebWindowHost.includes("navigateBack") || !nativeWebWindowHost.includes("reload")) {
  violations.push("native WindowGroup host must expose shell-owned navigation and bookmarks");
}

const immersiveEnvironmentFactory = readFileSync("native/visionos/VisionWebWorkspace/Models/ImmersiveEnvironmentSceneFactory.swift", "utf8");
if (!immersiveEnvironmentFactory.includes("buildOffice") || !immersiveEnvironmentFactory.includes("buildLounge")) {
  violations.push("native environment factory must build office and water lounge scenes");
}
if (!immersiveEnvironmentFactory.includes("water-pool") || !immersiveEnvironmentFactory.includes("caustic")) {
  violations.push("water lounge scene must include water pool and caustic reflection layers");
}

const immersiveEnvironmentView = readFileSync("native/visionos/VisionWebWorkspace/Views/ImmersiveEnvironmentView.swift", "utf8");
if (!immersiveEnvironmentView.includes("WorkspacePanelView") || !immersiveEnvironmentView.includes("ImmersiveEnvironmentSceneFactory")) {
  violations.push("full immersive environments must host the Gateway-backed workspace panel");
}

const gatewayClient = readFileSync("native/visionos/VisionWebWorkspace/Models/GatewayClient.swift", "utf8");
if (!gatewayClient.includes("fetchLayout") || !gatewayClient.includes("createSession") || !gatewayClient.includes("saveLayout")) {
  violations.push("native Gateway client must support layout fetch/save and session creation");
}
if (!gatewayClient.includes("maximumWindowCount") || !gatewayClient.includes("setOpacity")) {
  violations.push("native workspace store must enforce window count and opacity controls");
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
if (!awsWorkerScript.includes("terminate-and-release-mac-host") || !awsWorkerScript.includes("assertHostMinimumElapsed")) {
  violations.push("AWS Mac Worker teardown must require explicit confirmation and enforce 24h minimum");
}
if (!awsWorkerScript.includes("quota-status") || !awsWorkerScript.includes("L-B90B5B66")) {
  violations.push("AWS Mac Worker must expose quota status for mac2-m2 hosts");
}
if (!awsWorkerScript.includes("AWS-StartPortForwardingSession")) {
  violations.push("AWS Mac Worker must expose SSM tunnel workflow");
}
if (!awsWorkerScript.includes("getHourlyPriceUsd") || !awsWorkerScript.includes("assertCostAllowed")) {
  violations.push("AWS Mac Worker launch script must enforce price and cost guards");
}
if (!awsWorkerScript.includes("allocate-hosts") || !awsWorkerScript.includes("run-instances")) {
  violations.push("AWS Mac Worker launch script must own EC2 Mac allocation and launch actions");
}

const gateway = readFileSync("services/gateway/src/index.ts", "utf8");
if (!gateway.includes("workspaces") || !gateway.includes("SaveWorkspaceLayoutRequest")) {
  violations.push("gateway must expose native workspace layout APIs");
}
if (!gateway.includes('auditLevel: "lifecycle"')) {
  violations.push("gateway terminal sessions must default to lifecycle audit level");
}
if (!gateway.includes("maxWorkspaceWindows") || !gateway.includes("defaultWindowOpacity")) {
  violations.push("gateway must normalize remote web window count and opacity fields");
}
if (!gateway.includes("minimized")) {
  violations.push("gateway must normalize remote web window minimized state");
}
if (!gateway.includes("bookmarks") || !gateway.includes("navigation")) {
  violations.push("gateway must normalize remote web window bookmarks and navigation state");
}

const releaseWorkflow = readFileSync("docs/workflows/app-store-release.md", "utf8");
if (!releaseWorkflow.includes("AppUploader/AppUploader CLI can be evaluated as an optional release-uploader")) {
  violations.push("release workflow must treat AppUploader as optional");
}
if (!releaseWorkflow.includes("must not receive")) {
  violations.push("release workflow must preserve credential boundary");
}

const remoteWindowWorkflow = readFileSync("docs/workflows/remote-web-window-workspace.md", "utf8");
if (!remoteWindowWorkflow.includes("centered top bubble") || !remoteWindowWorkflow.includes("side with more available horizontal space")) {
  violations.push("remote web window workflow must document minimize bubbles and smart sibling placement");
}
if (!remoteWindowWorkflow.includes("back / forward / reload") || !remoteWindowWorkflow.includes("WorkspaceBookmark")) {
  violations.push("remote web window workflow must document navigation and bookmark ownership");
}

const windowManager = readFileSync("packages/window-manager/src/index.ts", "utf8");
if (!windowManager.includes('"minimize"') || !windowManager.includes('"restore-window"') || !windowManager.includes("placeNewWindow")) {
  violations.push("window manager must own minimize/restore and smart sibling placement");
}
if (!windowManager.includes('"navigate-back"') || !windowManager.includes('"toggle-bookmark"')) {
  violations.push("window manager must own shell navigation and bookmark actions");
}

const nativeWorkspaceMenu = readFileSync("native/visionos/VisionWebWorkspace/Views/WorkspaceMenuBarView.swift", "utf8");
if (!nativeWorkspaceMenu.includes("restoreSavedLayout") || !nativeWorkspaceMenu.includes("resetLayout")) {
  violations.push("native mixed workspace menu must expose layout restore and reset controls");
}
if (!nativeWorkspaceMenu.includes("navigateBack") || !nativeWorkspaceMenu.includes("toggleBookmark") || !nativeWorkspaceMenu.includes("setLockMode")) {
  violations.push("native mixed workspace menu must expose active-window navigation, bookmark, and lock-mode controls");
}

const spatialRemoteWindow = readFileSync("native/visionos/VisionWebWorkspace/Views/SpatialRemoteWebWindowView.swift", "utf8");
if (!spatialRemoteWindow.includes("Roll -") || !spatialRemoteWindow.includes("Width +") || !spatialRemoteWindow.includes("Height +")) {
  violations.push("spatial remote web window must expose roll and size controls");
}

const releaseInterface = JSON.parse(readFileSync("mcp/interfaces/app-store-release.json", "utf8"));
if (releaseInterface.currentReleaseMode !== "implementation-first-account-review-hold") {
  violations.push("App Store release interface must expose the current Apple account review hold mode");
}
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
  return /\.(json|md|mjs|js|ts|tsx|swift|css|html|ya?ml|gitignore)$/.test(file) || file === "LICENSE";
}
