import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import process from "node:process";

const command = process.argv[2] ?? "run";
const env = { ...process.env };
const loadedEnv = loadRuntimeEnv(env);
const localOnly = process.argv.includes("--local-only") || env.MAC_BUILDER_VALIDATION_LOCAL_ONLY === "1";
const reportPath = env.MAC_BUILDER_VALIDATION_REPORT ?? ".run/aws-mac-builder/validation-report.json";

switch (command) {
  case "plan":
    printPlan();
    break;
  case "run":
    runValidation();
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

function printPlan() {
  console.log("Mac Builder validation window plan");
  console.log("");
  console.log("This command uses the EC2 Mac 24-hour allocation window for repeatable validation work.");
  console.log("It does not allocate or release EC2 Mac resources.");
  console.log("");
  console.log("Local phases:");
  for (const phase of localPhases()) {
    console.log(`- ${phase.id}: ${phase.command}`);
  }
  console.log("");
  console.log("Remote phase:");
  console.log("- real-mac-build: pnpm visionos:mac-build:check");
  console.log("");
  console.log(`Runtime env file: ${loadedEnv.loaded ? loadedEnv.path : "not found"}`);
  console.log(`Remote builder URL: ${env.VISIONOS_MAC_BUILDER_URL ? env.VISIONOS_MAC_BUILDER_URL : "not configured"}`);
  console.log(`Local only: ${localOnly ? "yes" : "no"}`);
  console.log(`Report path: ${reportPath}`);
}

function runValidation() {
  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    runtimeEnvLoaded: loadedEnv.loaded,
    remoteBuilderConfigured: Boolean(env.VISIONOS_MAC_BUILDER_URL),
    localOnly,
    phases: []
  };

  console.log("Mac Builder validation window");
  console.log(`runtime env: ${loadedEnv.loaded ? loadedEnv.path : "not loaded"}`);
  console.log(`remote builder: ${env.VISIONOS_MAC_BUILDER_URL ? "configured" : "missing"}`);
  console.log("");

  try {
    runPhase(report, {
      id: "aws-status-before",
      command: "pnpm aws:mac:worker:status",
      optional: true
    });
    runPhase(report, {
      id: "cost-status-before",
      command: "pnpm aws:mac:worker:cost-status",
      optional: true
    });

    for (const phase of localPhases()) {
      runPhase(report, phase);
    }

    if (!localOnly && env.VISIONOS_MAC_BUILDER_URL) {
      runPhase(report, {
        id: "real-mac-build",
        command: "pnpm visionos:mac-build:check",
        env
      });
    } else {
      report.phases.push({
        id: "real-mac-build",
        status: "skipped",
        reason: localOnly ? "local-only mode" : "VISIONOS_MAC_BUILDER_URL is not configured"
      });
      console.log("skip real-mac-build: remote builder is not configured or local-only mode is enabled.");
    }

    runPhase(report, {
      id: "cost-status-after",
      command: "pnpm aws:mac:worker:cost-status",
      optional: true
    });
  } finally {
    report.finishedAt = new Date().toISOString();
    writeReport(report);
  }

  const failed = report.phases.find((phase) => phase.status === "failed" && !phase.optional);
  if (failed) {
    console.error(`Validation failed at phase: ${failed.id}`);
    process.exit(failed.exitCode ?? 1);
  }

  console.log("");
  console.log(`Validation report written to ${reportPath}`);
}

function localPhases() {
  return [
    {
      id: "app-icon-check",
      command: "pnpm assets:app-icon:check"
    },
    {
      id: "workflow-check",
      command: "pnpm workflow:check"
    },
    {
      id: "web-e2e",
      command: "pnpm test:e2e"
    },
    {
      id: "mock-mac-builder-e2e",
      command: "pnpm test:mac-builder"
    },
    {
      id: "workspace-tests",
      command: "pnpm test"
    }
  ];
}

function runPhase(report, phase) {
  const startedAt = new Date();
  console.log(`\n== ${phase.id} ==`);
  console.log(`$ ${phase.command}`);
  const result = spawnSync("bash", ["-lc", phase.command], {
    stdio: "inherit",
    env: phase.env ?? env
  });
  const finishedAt = new Date();
  const entry = {
    id: phase.id,
    command: redactCommand(phase.command),
    optional: Boolean(phase.optional),
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status ?? 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime()
  };
  report.phases.push(entry);

  if (entry.status === "failed" && !phase.optional) {
    writeReport({
      ...report,
      finishedAt: new Date().toISOString()
    });
    console.error(`Phase failed: ${phase.id}`);
    process.exit(entry.exitCode);
  }
}

function loadRuntimeEnv(targetEnv) {
  const path = ".run/aws-mac-builder/mac-builder.env";
  if (!existsSync(path)) {
    return { loaded: false, path };
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (targetEnv[key]) {
      continue;
    }
    targetEnv[key] = unquote(rawValue.trim());
  }

  return { loaded: true, path };
}

function unquote(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function writeReport(report) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function redactCommand(command) {
  return command.replace(/(VISIONOS_MAC_BUILDER_TOKEN|MAC_BUILDER_CLIENT_TOKEN)=\S+/g, "$1=<redacted>");
}

function printHelp() {
  console.log("Usage: node scripts/mac-builder-validation.mjs <command> [--local-only]");
  console.log("");
  console.log("Commands:");
  console.log("  plan  Print the 24-hour validation window plan.");
  console.log("  run   Run local gates and the remote Mac build when configured.");
}
