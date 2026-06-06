import { spawnSync } from "node:child_process";
import process from "node:process";

const profile = process.env.AWS_PROFILE ?? "vision-mac-builder";
const region = process.env.AWS_REGION ?? "us-east-2";

const steps = [
  {
    name: "1. Local launch plan",
    command: ["node", "scripts/aws-mac-worker.mjs", "plan"],
    why: "Confirms the instance type, region, 24h host allocation boundary, and guarded launch command."
  },
  {
    name: "2. AWS identity and region",
    command: ["node", "scripts/aws-mac-builder.mjs", "doctor"],
    why: "Confirms AWS CLI, SSO profile, account identity, and selected region before touching resources."
  },
  {
    name: "3. Existing Mac resource inventory",
    command: ["node", "scripts/aws-mac-worker.mjs", "status"],
    why: "Launch is blocked if a Mac Dedicated Host or Mac instance already exists in the region."
  },
  {
    name: "4. EC2 Mac quota status",
    command: ["node", "scripts/aws-mac-worker.mjs", "quota-status"],
    why: "Confirms the approved Mac Dedicated Host quota and recent quota request status."
  },
  {
    name: "5. Monthly budget and live cost status",
    command: ["node", "scripts/aws-mac-worker.mjs", "cost-status"],
    why: "Shows month-to-date cost, the configured 100 USD budget guard, and the 24h estimate."
  },
  {
    name: "6. Enforced price guard",
    command: ["node", "scripts/aws-mac-worker.mjs", "price-check"],
    why: "Fails if current spend plus the 24h Mac host estimate would exceed the configured budget."
  },
  {
    name: "7. Required baseline budget guard",
    command: ["node", "scripts/aws-mac-builder.mjs", "cost-check", "--require-budget"],
    why: "Fails if the AWS Budget is missing or if another Mac host is already allocated."
  },
  {
    name: "8. Baseline stack and Xcode artifact target",
    command: ["node", "scripts/aws-mac-xcode.mjs", "plan"],
    why: "Confirms the baseline stack outputs needed for artifact storage before real native work."
  }
];

console.log("AWS EC2 Mac prelaunch checklist");
console.log(`profile: ${profile}`);
console.log(`region: ${region}`);
console.log("mode: read-only; this command does not allocate hosts or launch instances");
console.log("");

for (const step of steps) {
  console.log(`== ${step.name}`);
  console.log(step.why);
  const result = spawnSync(step.command[0], step.command.slice(1), {
    encoding: "utf8",
    env: {
      ...process.env,
      AWS_PROFILE: profile,
      AWS_REGION: region
    }
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    if (/sso|token has expired|retrieving token/i.test(output)) {
      console.error("AWS SSO token is expired or cannot be refreshed.");
    } else if (output) {
      console.error(output);
    }
    printNextAction(output);
    process.exit(result.status ?? 1);
  }

  if (output) {
    console.log(output);
  }

  console.log(`PASS: ${step.name}`);
  console.log("");
}

console.log("AWS EC2 Mac prelaunch checklist passed.");
console.log("Next guarded launch command:");
console.log("AWS_MAC_WORKER_CONFIRM=allocate-24h-mac-host pnpm aws:mac:worker:launch");

function printNextAction(output) {
  console.error("");
  console.error("STOP: prelaunch checklist failed before resource launch.");

  if (/sso|token has expired|retrieving token/i.test(output)) {
    console.error("Next action: refresh the AWS SSO token, then rerun this checklist:");
    console.error(`AWS_PROFILE=${profile} aws sso login --profile ${profile} --no-browser`);
    console.error("AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:worker:prelaunch");
    return;
  }

  if (/budget/i.test(output)) {
    console.error("Next action: verify the budget guard or deploy the baseline stack before launch:");
    console.error("AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:deploy-baseline");
    console.error("AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:worker:prelaunch");
    return;
  }

  if (/stack|BuilderInstanceProfileName|ArtifactBucketName/i.test(output)) {
    console.error("Next action: deploy or repair the baseline CloudFormation stack:");
    console.error("AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:deploy-baseline");
    return;
  }

  if (/quota|limit/i.test(output)) {
    console.error("Next action: confirm the EC2 Mac Dedicated Host quota approval is reflected in Service Quotas.");
    console.error("If the request is approved but not visible, rerun after AWS propagation completes.");
    return;
  }

  console.error("Next action: inspect the failed step output above, fix it, then rerun prelaunch.");
}
