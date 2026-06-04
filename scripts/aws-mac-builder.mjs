import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const command = process.argv[2] ?? "help";
const config = loadConfig();

switch (command) {
  case "plan":
    printPlan();
    break;
  case "doctor":
    runDoctor();
    break;
  case "cost-check":
    runCostCheck({ requireBudget: process.argv.includes("--require-budget") });
    break;
  case "ensure-budget":
    ensureBudget();
    break;
  case "deploy-baseline":
    deployBaseline();
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

function loadConfig() {
  const defaultConfigPath = "infra/aws-mac-builder/config.example.json";
  const path = process.env.AWS_MAC_BUILDER_CONFIG ?? defaultConfigPath;
  const fileConfig = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};

  return {
    profile: process.env.AWS_PROFILE ?? fileConfig.profile ?? "vision-mac-builder",
    region: process.env.AWS_REGION ?? fileConfig.region ?? "us-east-1",
    environment: process.env.AWS_MAC_BUILDER_ENV ?? fileConfig.environment ?? "dev",
    monthlyBudgetLimitUsd: Number(process.env.AWS_BUDGET_LIMIT_USD ?? fileConfig.monthlyBudgetLimitUsd ?? 100),
    budgetName:
      process.env.AWS_BUDGET_NAME ?? fileConfig.budgetName ?? "vision-web-workspace-mac-builder-dev-100-usd",
    stackName:
      process.env.AWS_MAC_BUILDER_STACK_NAME ??
      fileConfig.stackName ??
      "vision-web-workspace-mac-builder-baseline-dev",
    artifactRetentionDays: Number(process.env.AWS_ARTIFACT_RETENTION_DAYS ?? fileConfig.artifactRetentionDays ?? 30),
    logRetentionDays: Number(process.env.AWS_LOG_RETENTION_DAYS ?? fileConfig.logRetentionDays ?? 14),
    budgetEmail: process.env.AWS_BUDGET_EMAIL ?? "",
    templatePath: "infra/aws-mac-builder/baseline.cfn.yaml"
  };
}

function printPlan() {
  console.log("AWS EC2 Mac Builder configuration plan");
  console.log("");
  console.log(`profile: ${config.profile}`);
  console.log(`region: ${config.region}`);
  console.log(`environment: ${config.environment}`);
  console.log(`monthly budget guard: ${config.monthlyBudgetLimitUsd} USD`);
  console.log(`budget name: ${config.budgetName}`);
  console.log(`baseline stack: ${config.stackName}`);
  console.log("");
  console.log("This phase may create only baseline resources:");
  console.log("- AWS Budget");
  console.log("- S3 artifact bucket with KMS encryption");
  console.log("- CloudWatch log group");
  console.log("- IAM role and instance profile for a future builder");
  console.log("");
  console.log("This phase must not:");
  console.log("- allocate EC2 Mac Dedicated Hosts");
  console.log("- run EC2 Mac instances");
  console.log("- import Apple signing material");
  console.log("- upload App Store Connect credentials");
}

function runDoctor() {
  printPlan();
  console.log("");

  if (!hasAwsCli()) {
    console.error("AWS CLI is not installed or not on PATH.");
    console.error("Install AWS CLI v2, then run:");
    console.error(`  aws configure sso --profile ${config.profile}`);
    console.error(`  aws sts get-caller-identity --profile ${config.profile}`);
    process.exit(2);
  }

  const identity = getIdentity();
  console.log(`AWS identity ok: account ${mask(identity.Account)}, arn ${maskArn(identity.Arn)}`);

  const regions = awsJson(["ec2", "describe-regions", "--all-regions"], { region: config.region });
  const selected = regions.Regions?.find((region) => region.RegionName === config.region);
  if (!selected) {
    throw new Error(`Region is not visible to this account: ${config.region}`);
  }

  console.log(`Region visible: ${config.region}`);
  console.log("Doctor completed. No resources were created.");
}

function runCostCheck({ requireBudget }) {
  assertAwsReady();
  const identity = getIdentity();
  const monthCost = getMonthToDateCost();
  const macHosts = listMacDedicatedHosts();
  const budget = findBudget(identity.Account, config.budgetName);

  console.log("AWS Mac Builder cost guard");
  console.log(`account: ${mask(identity.Account)}`);
  console.log(`region: ${config.region}`);
  console.log(`month-to-date unblended cost: ${monthCost.toFixed(2)} USD`);
  console.log(`budget limit: ${config.monthlyBudgetLimitUsd.toFixed(2)} USD`);
  console.log(`budget present: ${budget ? "yes" : "no"}`);
  console.log(`mac dedicated hosts present: ${macHosts.length}`);

  if (monthCost >= config.monthlyBudgetLimitUsd) {
    throw new Error(`Cost guard blocked execution: current spend ${monthCost} >= ${config.monthlyBudgetLimitUsd}`);
  }

  if (macHosts.length > 0) {
    throw new Error("Cost guard blocked execution: EC2 Mac Dedicated Host already exists in this region");
  }

  if (requireBudget && !budget) {
    throw new Error(`Cost guard blocked execution: budget ${config.budgetName} does not exist`);
  }

  console.log("Cost guard passed.");
}

function ensureBudget() {
  assertAwsReady();
  const identity = getIdentity();
  const existing = findBudget(identity.Account, config.budgetName);

  if (existing) {
    console.log(`Budget already exists: ${config.budgetName}`);
    return;
  }

  const budgetPath = writeRuntimeJson("budget.json", {
    BudgetName: config.budgetName,
    BudgetLimit: {
      Amount: String(config.monthlyBudgetLimitUsd),
      Unit: "USD"
    },
    TimeUnit: "MONTHLY",
    BudgetType: "COST"
  });

  const args = ["budgets", "create-budget", "--account-id", identity.Account, "--budget", `file://${budgetPath}`];

  if (config.budgetEmail) {
    const notificationsPath = writeRuntimeJson("budget-notifications.json", [
      {
        Notification: {
          NotificationType: "ACTUAL",
          ComparisonOperator: "GREATER_THAN",
          Threshold: 80,
          ThresholdType: "PERCENTAGE"
        },
        Subscribers: [
          {
            SubscriptionType: "EMAIL",
            Address: config.budgetEmail
          }
        ]
      },
      {
        Notification: {
          NotificationType: "FORECASTED",
          ComparisonOperator: "GREATER_THAN",
          Threshold: 100,
          ThresholdType: "PERCENTAGE"
        },
        Subscribers: [
          {
            SubscriptionType: "EMAIL",
            Address: config.budgetEmail
          }
        ]
      }
    ]);
    args.push("--notifications-with-subscribers", `file://${notificationsPath}`);
  } else {
    console.warn("AWS_BUDGET_EMAIL is not set; creating the budget without email notifications.");
  }

  aws(args, { region: "us-east-1" });
  console.log(`Created budget: ${config.budgetName}`);
}

function deployBaseline() {
  assertAwsReady();
  ensureBudget();
  runCostCheck({ requireBudget: true });
  assertTemplateDoesNotLaunchMac();

  aws([
    "cloudformation",
    "deploy",
    "--stack-name",
    config.stackName,
    "--template-file",
    config.templatePath,
    "--capabilities",
    "CAPABILITY_NAMED_IAM",
    "--parameter-overrides",
    `Environment=${config.environment}`,
    "ProjectName=vision-web-workspace",
    `ArtifactRetentionDays=${config.artifactRetentionDays}`,
    `LogRetentionDays=${config.logRetentionDays}`,
    "--tags",
    "Project=vision-web-workspace",
    `Environment=${config.environment}`,
    "Role=mac-builder-baseline"
  ]);

  console.log("Baseline deployment finished.");
  console.log("No EC2 Mac Dedicated Host was allocated.");
}

function getIdentity() {
  return awsJson(["sts", "get-caller-identity"], { region: config.region });
}

function getMonthToDateCost() {
  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const end = endDate.toISOString().slice(0, 10);

  const payload = awsJson(
    [
      "ce",
      "get-cost-and-usage",
      "--time-period",
      `Start=${start},End=${end}`,
      "--granularity",
      "MONTHLY",
      "--metrics",
      "UnblendedCost"
    ],
    { region: "us-east-1", allowFail: true }
  );

  const amount = payload?.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount;
  return amount ? Number(amount) : 0;
}

function listMacDedicatedHosts() {
  const payload = awsJson(["ec2", "describe-hosts"], { region: config.region, allowFail: true });
  const hosts = payload?.Hosts ?? [];
  return hosts.filter((host) => {
    const type = host.HostProperties?.InstanceType ?? host.InstanceType ?? "";
    return type.toLowerCase().includes("mac");
  });
}

function findBudget(accountId, budgetName) {
  const payload = awsJson(["budgets", "describe-budgets", "--account-id", accountId], {
    region: "us-east-1",
    allowFail: true
  });

  return payload?.Budgets?.find((budget) => budget.BudgetName === budgetName) ?? null;
}

function assertAwsReady() {
  if (!hasAwsCli()) {
    throw new Error("AWS CLI is not installed or not on PATH");
  }
}

function hasAwsCli() {
  const result = spawnSync("aws", ["--version"], { encoding: "utf8" });
  return result.status === 0;
}

function awsJson(args, options = {}) {
  const result = aws([...args, "--output", "json"], { ...options, capture: true });
  if (!result.stdout.trim()) {
    return {};
  }
  return JSON.parse(result.stdout);
}

function aws(args, options = {}) {
  const fullArgs = [];
  if (config.profile) {
    fullArgs.push("--profile", config.profile);
  }
  if (options.region ?? config.region) {
    fullArgs.push("--region", options.region ?? config.region);
  }
  fullArgs.push(...args);

  const result = spawnSync("aws", fullArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.status !== 0 && !options.allowFail) {
    const detail = result.stderr || result.stdout || `aws ${fullArgs.join(" ")} failed`;
    throw new Error(detail.trim());
  }

  if (result.status !== 0 && options.allowFail) {
    return { stdout: "{}", stderr: result.stderr, status: result.status };
  }

  return result;
}

function assertTemplateDoesNotLaunchMac() {
  const template = readFileSync(config.templatePath, "utf8");
  if (/AWS::EC2::Host|AWS::EC2::Instance|allocate-hosts|run-instances|mac[0-9a-z.-]*\.metal/i.test(template)) {
    throw new Error("Baseline template contains forbidden EC2 Mac launch/allocation material");
  }
}

function writeRuntimeJson(filename, payload) {
  const directory = ".run/aws-mac-builder";
  mkdirSync(directory, { recursive: true });
  const path = join(directory, filename);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

function mask(value) {
  const raw = String(value ?? "");
  if (raw.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

function maskArn(arn) {
  const raw = String(arn ?? "");
  return raw.replace(/\d{12}/, "************");
}

function printHelp() {
  console.log("Usage: node scripts/aws-mac-builder.mjs <command>");
  console.log("");
  console.log("Commands:");
  console.log("  plan             Print local AWS Mac Builder configuration plan.");
  console.log("  doctor           Check AWS CLI, identity, and region visibility.");
  console.log("  cost-check       Check current spend, budget, and Mac host absence.");
  console.log("  ensure-budget    Create the account-level 100 USD budget if missing.");
  console.log("  deploy-baseline  Deploy budget-guarded baseline resources. Does not start EC2 Mac.");
}
