import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const catalog = JSON.parse(readFileSync("tools/tool-catalog.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const allDeps = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {})
};

const failures = [];
const rows = catalog.tools.map((tool) => {
  const status = inspectTool(tool);
  if (tool.mode === "local-required" && status.state !== "ok") {
    failures.push(`${tool.id}: ${status.detail}`);
  }
  return { tool, status };
});

const width = Math.max(...rows.map(({ tool }) => tool.id.length), 4);
console.log("Vision Web Workspace tool doctor\n");

for (const { tool, status } of rows) {
  const marker = status.state === "ok" ? "ok" : status.state === "skip" ? "skip" : "miss";
  console.log(`${tool.id.padEnd(width)}  ${marker.padEnd(4)}  ${tool.mode.padEnd(24)}  ${status.detail}`);
}

if (failures.length > 0) {
  console.error("\nRequired tool failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nRequired local tooling is available.");

function inspectTool(tool) {
  if (tool.command) {
    const commandStatus = hasCommand(tool.command);
    if (commandStatus) {
      return { state: "ok", detail: commandStatus };
    }
  }

  if (tool.nodePackage) {
    if (allDeps[tool.nodePackage]) {
      return { state: "ok", detail: `package ${tool.nodePackage}@${allDeps[tool.nodePackage]}` };
    }

    try {
      require.resolve(tool.nodePackage);
      return { state: "ok", detail: `package ${tool.nodePackage} is resolvable` };
    } catch {
      return { state: "warn", detail: `package ${tool.nodePackage} is not installed` };
    }
  }

  if (tool.dockerImage) {
    if (hasCommand("docker")) {
      return { state: "ok", detail: `docker image ${tool.dockerImage} can be pulled on demand` };
    }
    return { state: "warn", detail: `requires Docker image ${tool.dockerImage}` };
  }

  if (tool.mode === "mac-only" || tool.mode === "optional-mac-builder") {
    return { state: "skip", detail: "not required in Linux workflow" };
  }

  return { state: "skip", detail: "catalog entry is informational" };
}

function hasCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim().split("\n")[0] || command;
}
