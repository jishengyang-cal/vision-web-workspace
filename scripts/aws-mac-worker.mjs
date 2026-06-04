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
  case "status":
    printStatus();
    break;
  case "price-check":
    runPriceCheck();
    break;
  case "launch":
    launchWorker();
    break;
  case "help":
  default:
    printHelp();
    process.exit(command === "help" ? 0 : 1);
}

function loadConfig() {
  const defaultConfigPath = "infra/aws-mac-builder/config.example.json";
  const fileConfig = existsSync(defaultConfigPath) ? JSON.parse(readFileSync(defaultConfigPath, "utf8")) : {};

  return {
    profile: process.env.AWS_PROFILE ?? fileConfig.profile ?? "vision-mac-builder",
    region: process.env.AWS_REGION ?? fileConfig.region ?? "us-east-2",
    environment: process.env.AWS_MAC_BUILDER_ENV ?? fileConfig.environment ?? "dev",
    monthlyBudgetLimitUsd: Number(process.env.AWS_BUDGET_LIMIT_USD ?? fileConfig.monthlyBudgetLimitUsd ?? 100),
    budgetName:
      process.env.AWS_BUDGET_NAME ?? fileConfig.budgetName ?? "vision-web-workspace-mac-builder-dev-100-usd",
    stackName:
      process.env.AWS_MAC_BUILDER_STACK_NAME ??
      fileConfig.stackName ??
      "vision-web-workspace-mac-builder-baseline-dev",
    instanceType: process.env.AWS_MAC_WORKER_INSTANCE_TYPE ?? "mac2-m2.metal",
    macosVersion: process.env.AWS_MAC_WORKER_MACOS_VERSION ?? "sonoma",
    availabilityZone: process.env.AWS_MAC_WORKER_AZ ?? "",
    maxLaunchCostUsd: Number(process.env.AWS_MAC_WORKER_MAX_LAUNCH_COST_USD ?? 100),
    hourlyPriceUsd: process.env.AWS_MAC_WORKER_HOURLY_USD ? Number(process.env.AWS_MAC_WORKER_HOURLY_USD) : null,
    securityGroupName:
      process.env.AWS_MAC_WORKER_SECURITY_GROUP_NAME ?? "vision-web-workspace-mac-builder-dev",
    hostResourceGroupArn: process.env.AWS_MAC_WORKER_HOST_RESOURCE_GROUP_ARN ?? ""
  };
}

function printPlan() {
  console.log("AWS EC2 Mac Worker launch plan");
  console.log("");
  console.log(`profile: ${config.profile}`);
  console.log(`region: ${config.region}`);
  console.log(`environment: ${config.environment}`);
  console.log(`instance type: ${config.instanceType}`);
  console.log(`macOS AMI family: ${config.macosVersion}`);
  console.log(`budget guard: ${config.monthlyBudgetLimitUsd.toFixed(2)} USD`);
  console.log(`single-launch max: ${config.maxLaunchCostUsd.toFixed(2)} USD`);
  console.log("");
  console.log("launch requires:");
  console.log("- AWS_MAC_WORKER_CONFIRM=allocate-24h-mac-host");
  console.log("- an existing baseline stack from pnpm aws:mac:deploy-baseline");
  console.log("- current month spend + 24h Mac host estimate <= budget guard");
  console.log("");
  console.log("launch creates:");
  console.log("- one EC2 Mac Dedicated Host");
  console.log("- one EC2 Mac instance on that host");
  console.log("- one private security group with no inbound rules");
  console.log("");
  console.log("launch does not install full Xcode; use scripts/mac-builder-install-xcode.sh with Xcode.xip.");
}

function printStatus() {
  assertAwsReady();
  const hosts = listMacDedicatedHosts();
  const instances = listMacInstances();
  console.log("AWS EC2 Mac Worker status");
  console.log(`mac dedicated hosts: ${hosts.length}`);
  for (const host of hosts) {
    console.log(`- host ${host.HostId}: ${host.State}, ${host.HostProperties?.InstanceType}, ${host.AvailabilityZone}`);
  }
  console.log(`mac instances: ${instances.length}`);
  for (const instance of instances) {
    console.log(`- instance ${instance.InstanceId}: ${instance.State?.Name}, ${instance.InstanceType}, ${instance.PrivateIpAddress ?? "no-private-ip"}`);
  }
}

function runPriceCheck() {
  assertAwsReady();
  const monthCost = getMonthToDateCost();
  const price = getHourlyPriceUsd();
  const estimate = price * 24;
  console.log("AWS EC2 Mac Worker price check");
  console.log(`month-to-date unblended cost: ${monthCost.toFixed(2)} USD`);
  console.log(`hourly host estimate: ${price.toFixed(4)} USD`);
  console.log(`24h minimum estimate: ${estimate.toFixed(2)} USD`);
  console.log(`budget guard: ${config.monthlyBudgetLimitUsd.toFixed(2)} USD`);
  assertCostAllowed(monthCost, estimate);
  console.log("Price guard passed.");
}

function launchWorker() {
  assertAwsReady();
  if (process.env.AWS_MAC_WORKER_CONFIRM !== "allocate-24h-mac-host") {
    throw new Error("Refusing to launch: set AWS_MAC_WORKER_CONFIRM=allocate-24h-mac-host");
  }

  const hosts = listMacDedicatedHosts();
  if (hosts.length > 0) {
    throw new Error("Refusing to launch: an EC2 Mac Dedicated Host already exists in this region");
  }

  const monthCost = getMonthToDateCost();
  const price = getHourlyPriceUsd();
  const estimate = price * 24;
  assertCostAllowed(monthCost, estimate);

  const outputs = getBaselineOutputs();
  const instanceProfileName = outputs.BuilderInstanceProfileName;
  if (!instanceProfileName) {
    throw new Error("Baseline stack is missing BuilderInstanceProfileName output");
  }

  const availabilityZone = config.availabilityZone || selectAvailabilityZone();
  const subnetId = selectSubnetId(availabilityZone);
  const securityGroupId = ensureSecurityGroup();
  const imageId = getMacAmiId();

  console.log(`Allocating ${config.instanceType} Dedicated Host in ${availabilityZone}.`);
  const hostPayload = awsJson([
    "ec2",
    "allocate-hosts",
    "--instance-type",
    config.instanceType,
    "--availability-zone",
    availabilityZone,
    "--quantity",
    "1",
    "--auto-placement",
    "off",
    "--tag-specifications",
    tagSpec("dedicated-host", { Role: "mac-builder", LeaseWindow: "24h-minimum" })
  ]);
  const hostId = hostPayload.HostIds?.[0];
  if (!hostId) {
    throw new Error("allocate-hosts did not return a host id");
  }

  console.log(`Launching Mac instance on host ${hostId} with AMI ${imageId}.`);
  const instancePayload = awsJson([
    "ec2",
    "run-instances",
    "--image-id",
    imageId,
    "--instance-type",
    config.instanceType,
    "--subnet-id",
    subnetId,
    "--security-group-ids",
    securityGroupId,
    "--iam-instance-profile",
    `Name=${instanceProfileName}`,
    "--placement",
    `Tenancy=host,HostId=${hostId}`,
    "--block-device-mappings",
    "DeviceName=/dev/sda1,Ebs={VolumeSize=250,VolumeType=gp3,Encrypted=true,DeleteOnTermination=true}",
    "--tag-specifications",
    tagSpec("instance", { Role: "mac-builder", DedicatedHostId: hostId })
  ]);

  const instanceId = instancePayload.Instances?.[0]?.InstanceId;
  if (!instanceId) {
    throw new Error("run-instances did not return an instance id");
  }

  writeRuntimeJson("worker-launch.json", {
    hostId,
    instanceId,
    instanceType: config.instanceType,
    availabilityZone,
    imageId,
    estimatedMinimumCostUsd: estimate,
    launchedAt: new Date().toISOString()
  });

  console.log("Mac worker launch submitted.");
  console.log(`hostId: ${hostId}`);
  console.log(`instanceId: ${instanceId}`);
  console.log(`estimated 24h minimum: ${estimate.toFixed(2)} USD`);
  console.log("Use AWS Systems Manager Session Manager after the instance becomes managed.");
}

function assertCostAllowed(monthCost, launchEstimate) {
  if (launchEstimate > config.maxLaunchCostUsd) {
    throw new Error(`Cost guard blocked launch: 24h estimate ${launchEstimate.toFixed(2)} > max ${config.maxLaunchCostUsd.toFixed(2)}`);
  }
  if (monthCost + launchEstimate > config.monthlyBudgetLimitUsd) {
    throw new Error(
      `Cost guard blocked launch: ${monthCost.toFixed(2)} current + ${launchEstimate.toFixed(2)} estimate > ${config.monthlyBudgetLimitUsd.toFixed(2)} budget`
    );
  }
}

function getHourlyPriceUsd() {
  if (config.hourlyPriceUsd) {
    return config.hourlyPriceUsd;
  }

  const location = regionLocation(config.region);
  const hostUsageType = `${regionUsagePrefix(config.region)}-HostUsage:${hostFamilyFromInstanceType(config.instanceType)}`;
  const payload = awsJson(
    [
      "pricing",
      "get-products",
      "--service-code",
      "AmazonEC2",
      "--filters",
      `Type=TERM_MATCH,Field=usagetype,Value=${hostUsageType}`,
      `Type=TERM_MATCH,Field=location,Value=${location}`,
      "Type=TERM_MATCH,Field=tenancy,Value=Host",
      "Type=TERM_MATCH,Field=capacitystatus,Value=AllocatedHost"
    ],
    { region: "us-east-1" }
  );

  for (const raw of payload.PriceList ?? []) {
    const product = JSON.parse(raw);
    const terms = product.terms?.OnDemand ?? {};
    for (const term of Object.values(terms)) {
      for (const dimension of Object.values(term.priceDimensions ?? {})) {
        const usd = dimension.pricePerUnit?.USD;
        if (usd) {
          return Number(usd);
        }
      }
    }
  }

  throw new Error("Could not resolve EC2 Mac hourly price from AWS Pricing API. Set AWS_MAC_WORKER_HOURLY_USD explicitly.");
}

function hostFamilyFromInstanceType(instanceType) {
  return instanceType.replace(/\.metal$/, "");
}

function getMacAmiId() {
  const architecture = config.instanceType.startsWith("mac1") ? "x86_64_mac" : "arm64_mac";
  const parameter = `/aws/service/ec2-macos/${config.macosVersion}/${architecture}/latest/image_id`;
  const payload = awsJson(["ssm", "get-parameter", "--name", parameter]);
  const imageId = payload.Parameter?.Value;
  if (!imageId) {
    throw new Error(`Could not resolve macOS AMI parameter: ${parameter}`);
  }
  return imageId;
}

function selectAvailabilityZone() {
  const payload = awsJson([
    "ec2",
    "describe-instance-type-offerings",
    "--location-type",
    "availability-zone",
    "--filters",
    `Name=instance-type,Values=${config.instanceType}`
  ]);
  const zones = (payload.InstanceTypeOfferings ?? []).map((offering) => offering.Location).filter(Boolean).sort();
  if (zones.length === 0) {
    throw new Error(`No availability zone offering found for ${config.instanceType} in ${config.region}`);
  }
  return zones[0];
}

function selectSubnetId(availabilityZone) {
  const vpcPayload = awsJson(["ec2", "describe-vpcs", "--filters", "Name=isDefault,Values=true"]);
  const vpcId = vpcPayload.Vpcs?.[0]?.VpcId;
  if (!vpcId) {
    throw new Error("Default VPC not found. Create a private builder VPC/subnet before launch.");
  }

  const subnetPayload = awsJson([
    "ec2",
    "describe-subnets",
    "--filters",
    `Name=vpc-id,Values=${vpcId}`,
    `Name=availability-zone,Values=${availabilityZone}`,
    "Name=default-for-az,Values=true"
  ]);
  const subnetId = subnetPayload.Subnets?.[0]?.SubnetId;
  if (!subnetId) {
    throw new Error(`Default subnet not found in ${availabilityZone}`);
  }
  return subnetId;
}

function ensureSecurityGroup() {
  const vpcPayload = awsJson(["ec2", "describe-vpcs", "--filters", "Name=isDefault,Values=true"]);
  const vpcId = vpcPayload.Vpcs?.[0]?.VpcId;
  if (!vpcId) {
    throw new Error("Default VPC not found");
  }

  const existing = awsJson([
    "ec2",
    "describe-security-groups",
    "--filters",
    `Name=vpc-id,Values=${vpcId}`,
    `Name=group-name,Values=${config.securityGroupName}`
  ]);
  const groupId = existing.SecurityGroups?.[0]?.GroupId;
  if (groupId) {
    tagSecurityGroup(groupId);
    return groupId;
  }

  const created = awsJson([
    "ec2",
    "create-security-group",
    "--vpc-id",
    vpcId,
    "--group-name",
    config.securityGroupName,
    "--description",
    "Vision Web Workspace Mac Builder private security group"
  ]);
  const securityGroupId = created.GroupId;
  if (!securityGroupId) {
    throw new Error("create-security-group did not return GroupId");
  }
  tagSecurityGroup(securityGroupId);
  return securityGroupId;
}

function tagSecurityGroup(securityGroupId) {
  aws([
    "ec2",
    "create-tags",
    "--resources",
    securityGroupId,
    "--tags",
    ...tagArgs({ Role: "mac-builder", Name: config.securityGroupName })
  ]);
}

function getBaselineOutputs() {
  const payload = awsJson(["cloudformation", "describe-stacks", "--stack-name", config.stackName]);
  const outputs = payload.Stacks?.[0]?.Outputs ?? [];
  return Object.fromEntries(outputs.map((output) => [output.OutputKey, output.OutputValue]));
}

function listMacDedicatedHosts() {
  const payload = awsJson(["ec2", "describe-hosts"], { allowFail: true });
  const hosts = payload?.Hosts ?? [];
  return hosts.filter((host) => {
    const type = host.HostProperties?.InstanceType ?? host.InstanceType ?? "";
    return type.toLowerCase().includes("mac");
  });
}

function listMacInstances() {
  const payload = awsJson([
    "ec2",
    "describe-instances",
    "--filters",
    "Name=instance-type,Values=mac*.metal",
    "Name=instance-state-name,Values=pending,running,stopping,stopped"
  ]);
  return (payload.Reservations ?? []).flatMap((reservation) => reservation.Instances ?? []);
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

function regionLocation(region) {
  const locations = {
    "us-east-1": "US East (N. Virginia)",
    "us-east-2": "US East (Ohio)",
    "us-west-1": "US West (N. California)",
    "us-west-2": "US West (Oregon)"
  };
  return locations[region] ?? "US East (Ohio)";
}

function regionUsagePrefix(region) {
  const prefixes = {
    "us-east-1": "USE1",
    "us-east-2": "USE2",
    "us-west-1": "USW1",
    "us-west-2": "USW2"
  };
  return prefixes[region] ?? "USE2";
}

function tagSpec(resourceType, extraTags) {
  return `ResourceType=${resourceType},Tags=[${tagList(extraTags)}]`;
}

function tagList(extraTags = {}) {
  const tags = {
    Project: "vision-web-workspace",
    Environment: config.environment,
    ManagedBy: "aws-mac-worker",
    ...extraTags
  };
  return Object.entries(tags)
    .map(([Key, Value]) => `{Key=${Key},Value=${Value}}`)
    .join(",");
}

function tagArgs(extraTags = {}) {
  const tags = {
    Project: "vision-web-workspace",
    Environment: config.environment,
    ManagedBy: "aws-mac-worker",
    ...extraTags
  };
  return Object.entries(tags).map(([Key, Value]) => `Key=${Key},Value=${Value}`);
}

function assertAwsReady() {
  const result = spawnSync("aws", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("AWS CLI is not installed or not on PATH");
  }
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
    throw new Error((result.stderr || result.stdout || `aws ${fullArgs.join(" ")} failed`).trim());
  }

  if (result.status !== 0 && options.allowFail) {
    return { stdout: "{}", stderr: result.stderr, status: result.status };
  }

  return result;
}

function writeRuntimeJson(filename, payload) {
  const directory = ".run/aws-mac-builder";
  mkdirSync(directory, { recursive: true });
  const path = join(directory, filename);
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

function printHelp() {
  console.log("Usage: node scripts/aws-mac-worker.mjs <command>");
  console.log("");
  console.log("Commands:");
  console.log("  plan         Print the EC2 Mac worker launch plan.");
  console.log("  status       Print existing Mac hosts and instances.");
  console.log("  price-check  Resolve AWS Pricing API estimate and enforce cost guard.");
  console.log("  launch       Allocate one EC2 Mac Dedicated Host and launch one instance.");
}
