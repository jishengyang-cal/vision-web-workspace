import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const command = process.argv[2] ?? "help";
const config = {
  profile: process.env.AWS_PROFILE ?? "vision-mac-builder",
  region: process.env.AWS_REGION ?? "us-east-2",
  stackName: process.env.AWS_MAC_BUILDER_STACK_NAME ?? "vision-web-workspace-mac-builder-baseline-dev",
  xcodePath: process.env.XCODE_XIP_PATH ?? "",
  key: process.env.XCODE_S3_KEY ?? "toolchains/Xcode.xip"
};

switch (command) {
  case "upload":
    uploadXcode();
    break;
  case "plan":
    printPlan();
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

function printPlan() {
  const outputs = getBaselineOutputs();
  console.log("Xcode.xip artifact plan");
  console.log(`profile: ${config.profile}`);
  console.log(`region: ${config.region}`);
  console.log(`stack: ${config.stackName}`);
  console.log(`bucket: ${outputs.ArtifactBucketName ?? "unknown"}`);
  console.log(`key: ${config.key}`);
  console.log("");
  console.log("This workflow uploads an Apple-provided Xcode.xip that you obtained legally.");
  console.log("It does not use, request, or store Apple ID credentials.");
}

function uploadXcode() {
  if (!config.xcodePath || !existsSync(config.xcodePath)) {
    throw new Error("Set XCODE_XIP_PATH to a local Xcode.xip file before upload.");
  }

  const outputs = getBaselineOutputs();
  const bucket = outputs.ArtifactBucketName;
  const keyArn = outputs.ArtifactKeyArn;
  if (!bucket) {
    throw new Error("Baseline stack is missing ArtifactBucketName output.");
  }

  const destination = `s3://${bucket}/${config.key}`;
  const args = ["s3", "cp", config.xcodePath, destination];
  if (keyArn) {
    args.push("--sse", "aws:kms", "--sse-kms-key-id", keyArn);
  }
  aws(args);
  console.log(`Uploaded Xcode.xip to ${destination}`);
  console.log("Use this on the Mac Builder host:");
  console.log(`  XCODE_S3_URI=${destination} scripts/mac-builder-install-xcode.sh`);
}

function getBaselineOutputs() {
  const payload = awsJson(["cloudformation", "describe-stacks", "--stack-name", config.stackName]);
  const outputs = payload.Stacks?.[0]?.Outputs ?? [];
  return Object.fromEntries(outputs.map((output) => [output.OutputKey, output.OutputValue]));
}

function awsJson(args) {
  const result = aws([...args, "--output", "json"], { capture: true });
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function aws(args, options = {}) {
  const fullArgs = [];
  if (config.profile) {
    fullArgs.push("--profile", config.profile);
  }
  if (config.region) {
    fullArgs.push("--region", config.region);
  }
  fullArgs.push(...args);

  const result = spawnSync("aws", fullArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `aws ${fullArgs.join(" ")} failed`).trim());
  }
  return result;
}

function printHelp() {
  console.log("Usage: node scripts/aws-mac-xcode.mjs <command>");
  console.log("");
  console.log("Commands:");
  console.log("  plan    Print private Xcode.xip artifact upload target.");
  console.log("  upload  Upload Xcode.xip from XCODE_XIP_PATH to the artifact bucket.");
}
