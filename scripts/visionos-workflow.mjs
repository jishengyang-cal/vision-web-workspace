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
    runMacBuildCheck();
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

function runMacBuildCheck() {
  const builderUrl = process.env.VISIONOS_MAC_BUILDER_URL;

  if (builderUrl) {
    console.log(`Mac builder URL configured: ${builderUrl}`);
    console.log("No Mac builder MCP adapter is implemented in this repository yet.");
    process.exit(2);
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
