import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const violations = [];

const trackedFiles = run("git ls-files")
  .split("\n")
  .filter(Boolean);

const trackedForbidden = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.run\//,
  /\.tsbuildinfo$/,
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
const requiredScripts = ["tools:doctor", "compliance:check", "workflow:check", "dev:services", "test:e2e"];
for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) {
    violations.push(`missing package script: ${script}`);
  }
}

const linuxRequiredScriptNames = ["dev", "build", "typecheck", "workflow:check", "test:e2e"];
for (const name of linuxRequiredScriptNames) {
  const script = packageJson.scripts?.[name] ?? "";
  if (/\b(xcodebuild|xcrun|tuist|xcodegen)\b/.test(script)) {
    violations.push(`Linux-required script ${name} invokes Mac/Xcode-only tooling`);
  }
}

const catalog = JSON.parse(readFileSync("tools/tool-catalog.json", "utf8"));
for (const id of ["xcodebuild", "xcrun"]) {
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
