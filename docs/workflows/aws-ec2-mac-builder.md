# AWS EC2 Mac Builder Workflow

This workflow uses Amazon EC2 Mac as the remote Mac execution plane for native
visionOS builds. It keeps the main development desk in Linux/Web/Vision Pro and
delegates only Apple-native work to an audited Mac builder.

## Current AWS constraints

- EC2 Mac instances run as bare metal instances on EC2 Dedicated Hosts.
- A Dedicated Host has a 24-hour minimum allocation period before it can be
  released.
- One Mac instance runs on one Dedicated Host.
- EC2 Mac is On-Demand only; Spot and Reserved Instances are not available.
- SSH and GUI access are supported, but the builder workflow should prefer
  SSH/SSM and non-interactive jobs over manual GUI operation.

Sources:

- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-mac-instances.html
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-to-mac-instance.html
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/mac-instance-stop.html
- https://aws.amazon.com/ec2/instance-types/mac/faqs/
- https://aws.amazon.com/blogs/aws/announcing-amazon-ec2-m4-and-m4-pro-mac-instances/

## Target architecture

```text
Vision Web Workspace / Linux Agent
  -> submits MacBuildRequest through VISIONOS_MAC_BUILDER_URL

Mac Builder API
  -> receives request, checks policy, creates job, returns job id

AWS EC2 Mac Host
  -> pulls repo ref
  -> runs Xcode / xcodebuild / xcrun simctl / xcresulttool
  -> writes logs and artifacts to S3
  -> returns scoped artifact refs

S3 / CloudWatch / AWS audit
  -> encrypted logs, build products, .xcresult, archives, audit records
```

The browser simulator and Vision Pro client never receive AWS credentials,
SSH keys, signing identities, provisioning profiles, or App Store Connect
credentials.

## AWS resource baseline

This repository now includes a baseline configuration script and CloudFormation
template for the non-Mac part of the setup:

```bash
pnpm aws:mac:plan
pnpm aws:mac:doctor
pnpm aws:mac:ensure-budget
pnpm aws:mac:cost-check
pnpm aws:mac:deploy-baseline
```

`aws:mac:deploy-baseline` may create only Budget, S3, KMS, CloudWatch, IAM role,
and IAM instance profile resources. It does not allocate an EC2 Mac Dedicated
Host or run an EC2 Mac instance.

The real worker launch flow is intentionally separated:

```bash
pnpm aws:mac:worker:plan
pnpm aws:mac:worker:prelaunch
pnpm aws:mac:worker:quota-status
pnpm aws:mac:worker:cost-status
pnpm aws:mac:worker:price-check
pnpm aws:mac:worker:status
AWS_MAC_WORKER_CONFIRM=allocate-24h-mac-host pnpm aws:mac:worker:launch
```

The launch command allocates one Dedicated Host and starts one Mac instance
only after the pricing estimate and monthly budget guard pass.

## Prelaunch checklist

Run this checklist after AWS approves the EC2 Mac quota and before allocating
the first host:

```bash
AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:worker:prelaunch
```

The checklist is read-only. It does not allocate a Dedicated Host, launch an
instance, import Apple credentials, or upload signing material. It stops at the
first failed gate and prints the next corrective action.

Required gates:

1. Local launch plan: confirm region, instance type, macOS AMI family, the
   24-hour EC2 Mac host minimum, and the guarded launch command.
2. AWS identity and region: confirm the SSO profile, account identity, and
   `us-east-2` region access.
3. Existing Mac resource inventory: confirm there is no already-allocated EC2
   Mac Dedicated Host or running/stopped Mac instance in the region.
4. EC2 Mac quota status: confirm the approved quota value is visible through
   Service Quotas for the selected instance family.
5. Monthly budget and live cost status: confirm the configured 100 USD budget
   guard, month-to-date spend, and the 24-hour minimum estimate.
6. Enforced price guard: fail if current spend plus the 24-hour Mac host
   estimate would exceed the budget guard.
7. Required baseline budget guard: confirm the AWS Budget exists and no Mac
   host is already allocated.
8. Baseline stack and Xcode artifact target: confirm the CloudFormation outputs
   for the instance profile, S3 artifact bucket, KMS key, and log group.

If the checklist fails because the AWS SSO token is expired, refresh it first:

```bash
AWS_PROFILE=vision-mac-builder aws sso login --profile vision-mac-builder --no-browser
```

If it fails because the baseline stack or budget is missing, run:

```bash
AWS_PROFILE=vision-mac-builder AWS_REGION=us-east-2 pnpm aws:mac:deploy-baseline
```

Teardown is explicit and guarded:

```bash
AWS_MAC_WORKER_CONFIRM=terminate-and-release-mac-host pnpm aws:mac:worker:teardown
```

The teardown command refuses to release an EC2 Mac Dedicated Host before the
24-hour minimum allocation period has elapsed.

### Accounts and IAM

- Dedicated AWS account or isolated workload account for Mac builder.
- IAM role for provisioning hosts.
- IAM role for the builder instance with least privilege:
  - read repository bootstrap material or GitHub App credentials,
  - write logs/artifacts to a dedicated S3 bucket,
  - write CloudWatch logs,
  - read only the secrets needed for signing.
- AWS Budgets and alarms for Dedicated Host spend.

### Network

- VPC private subnet preferred.
- Security group should not expose Mac builder APIs to the public internet.
- Use one of:
  - AWS Systems Manager Session Manager,
  - VPN or private network,
  - restricted SSH from fixed admin IPs.
- Builder API should be reachable only from the gateway/agent network.

### Storage

- Encrypted EBS root volume.
- S3 artifact bucket with SSE-KMS.
- Prefix artifacts by job id:

```text
s3://vision-web-workspace-artifacts/mac-builder/jobs/<job-id>/
  build.log
  result.xcresult.zip
  build-products.zip
  archive.xcarchive.zip
  app.ipa
```

## Provisioning workflow

1. Select region and Mac instance type.
   - Prefer Apple silicon Mac for visionOS work.
   - Use M4/M4 Pro where available; fall back to M2 if region or quota limits
     require it.
2. Request or verify EC2 Mac Dedicated Host quota.
3. Allocate the Dedicated Host.
4. Launch the EC2 Mac instance from a compatible macOS AMI.
5. Attach IAM instance profile.
6. Attach encrypted EBS volume.
7. Apply tags:

```text
Project=vision-web-workspace
Role=mac-builder
Environment=dev|ci|prod
Owner=<team>
CostCenter=<id>
LeaseWindow=<date>
```

8. Verify host health:

```bash
sw_vers
uname -m
xcodebuild -version
xcrun simctl list runtimes
```

## Bootstrap workflow

Bootstrap is run by an admin or automation, not by the Vision Pro client.

1. Connect using SSH or SSM.
2. Install or select the required Xcode version.
3. Install the visionOS simulator runtime required by the project.
4. Accept Xcode license and first-launch tasks:

```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

5. Install project support tools:

```bash
brew install git git-lfs jq node pnpm
```

6. Install the Mac Builder agent.
7. Configure agent service with `launchd`.
8. Configure artifact bucket, KMS key, CloudWatch log group, and builder API
   endpoint.
9. Import signing material into the macOS keychain only if this host is allowed
   to archive/sign. Build-only hosts should not receive distribution signing
   assets.

Repository bootstrap script:

```bash
scripts/mac-builder-bootstrap.sh
```

Full Xcode is installed only from an Apple-provided `Xcode.xip` that you place
on the host or in the private artifact bucket:

```bash
XCODE_XIP_PATH=/path/to/Xcode.xip pnpm aws:mac:xcode:upload

XCODE_XIP_PATH=/path/to/Xcode.xip scripts/mac-builder-install-xcode.sh
# or
XCODE_S3_URI=s3://<artifact-bucket>/toolchains/Xcode.xip scripts/mac-builder-install-xcode.sh

scripts/mac-builder-verify-xcode.sh
```

The native agent package is `@vision-web-workspace/mac-builder-agent`. It
exposes the same `/health`, `/jobs`, and `/jobs/:id` contract as the mock
service, but refuses Xcode execution unless it is running on macOS.

## Builder API workflow

The existing local mock protocol is the base contract.

Current local adapter:

```bash
VISIONOS_MAC_BUILDER_URL=http://127.0.0.1:3101 pnpm visionos:mac-build:check
```

AWS production adapter:

```bash
pnpm aws:mac:worker:ssm-tunnel

VISIONOS_MAC_BUILDER_URL=http://127.0.0.1:3201 \
VISIONOS_MAC_BUILDER_TOKEN="$MAC_BUILDER_CLIENT_TOKEN" \
VISIONOS_SCHEME=VisionWebWorkspace \
VISIONOS_CONFIGURATION=Debug \
VISIONOS_DESTINATION="platform=visionOS Simulator,name=Apple Vision Pro" \
VISIONOS_SDK=xrsimulator \
pnpm visionos:mac-build:check
```

Request lifecycle:

1. Agent creates `MacBuildRequest` with:
   - `repoRef`,
   - `project`,
   - `target`,
   - `audit`,
   - approval decision,
   - requested capabilities.
2. Builder API validates policy and creates `MacBuildJob`.
3. Worker clones/fetches the exact commit SHA.
4. Worker runs the requested native operation.
5. Worker records segmented command logs in the job.
6. Worker compresses `.xcresult`/`.xcarchive` directories and uploads artifacts
   to S3 when `MAC_BUILDER_ARTIFACT_S3_URI` is set.
7. Builder API returns job state and scoped artifact refs.

## Build job commands

Build:

```bash
xcodegen generate --spec "$GENERATOR_SPEC_PATH"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "$DESTINATION" \
  -sdk "$SDK" \
  build
```

Simulator test:

```bash
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -destination "$DESTINATION" \
  -resultBundlePath "$RESULT_BUNDLE_PATH" \
  test
```

Archive:

```bash
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  archive
```

Export:

```bash
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"
```

## Artifact contract

Every returned artifact must include:

- `id`
- `type`
- `name`
- `uri`
- `createdAt`
- optional `sha256`
- optional `sizeBytes`
- optional `retentionExpiresAt`

Allowed artifact types:

- `log`
- `build-products`
- `xcresult`
- `archive`
- `ipa`
- `screenshot`

The workflow should return S3 URIs or pre-signed URLs only to callers that pass
policy checks.

## Signing and secret policy

Keep these inside AWS/Mac builder boundaries:

- SSH private keys.
- GitHub App private key or installation token.
- signing certificates.
- provisioning profiles.
- keychain password.
- App Store Connect API key.

Rules:

- Build/test hosts can operate without distribution signing material.
- Archive/release hosts require explicit approval.
- Import certificates only for the job window when possible.
- Delete temporary keychains and provisioning files after the job.
- Never return raw secret values through builder API responses.

## Operating model

### Daily development

1. Develop in Vision Web Workspace.
2. Run Linux checks:

```bash
pnpm visionos:preflight
pnpm workflow:check
pnpm test:mac-builder
```

3. Submit native build to AWS Mac builder:

```bash
VISIONOS_MAC_BUILDER_URL=https://mac-builder.internal.example.com \
pnpm visionos:mac-build:check
```

4. Read returned logs and `.xcresult` reference.
5. Fix code in the web workspace.
6. Repeat.

### Batch cost window

Because the EC2 Mac Dedicated Host has a 24-hour minimum allocation period:

1. Queue native build/test/archive work into a scheduled window.
2. Allocate host at window start.
3. Run all pending jobs.
4. Create or refresh a builder AMI after controlled updates.
5. Stop/terminate the instance.
6. Release the Dedicated Host only after the 24-hour minimum is satisfied.
7. Confirm AWS scrubbing workflow completes before reusing assumptions about
   local SSD/NVRAM state.

## Cost guard implementation

The repository cost guard defaults to a 100 USD monthly cap:

```bash
AWS_PROFILE=vision-mac-builder \
AWS_REGION=us-east-1 \
AWS_BUDGET_LIMIT_USD=100 \
pnpm aws:mac:cost-check
```

The guard checks:

- current month-to-date unblended cost through Cost Explorer,
- presence of the configured AWS Budget,
- absence of EC2 Mac Dedicated Hosts in the selected region.

Deployment command:

```bash
AWS_PROFILE=vision-mac-builder \
AWS_REGION=us-east-1 \
AWS_BUDGET_LIMIT_USD=100 \
AWS_BUDGET_EMAIL=you@example.com \
pnpm aws:mac:deploy-baseline
```

`AWS_BUDGET_EMAIL` is optional, but without it the budget is created without
email notifications. Do not proceed to real EC2 Mac allocation until a budget
exists and `pnpm aws:mac:cost-check` passes.

## Teardown workflow

1. Drain builder queue.
2. Upload final logs/artifacts.
3. Delete temporary keychains.
4. Remove transient provisioning profiles.
5. Stop or terminate EC2 Mac instance.
6. Wait for AWS host scrubbing where applicable.
7. Release Dedicated Host after the 24-hour minimum allocation window.
8. Review S3, CloudWatch, IAM, and cost records.

## Failure handling

- Host allocation fails: check EC2 Mac quota, region availability, Dedicated
  Host capacity, and instance type/AMI compatibility.
- SSH/SSM fails: check security group, IAM profile, route table, SSM agent, and
  key pair.
- Xcode runtime missing: install the matching Xcode/visionOS simulator runtime.
- Signing fails: validate keychain, certificate, provisioning profile, bundle
  id, team id, and export options.
- Job timeout: upload partial logs and mark job `failed`.
- Artifact upload fails: retry S3 upload, then preserve local logs until manual
  cleanup.

## Integration milestones

1. Keep current mock builder as local protocol test.
2. Add AWS provisioning scripts under a future `infra/aws-mac-builder`.
3. Add real Mac Builder agent that implements the mock HTTP contract.
4. Store artifacts in S3 and logs in CloudWatch.
5. Add `visionos.build`, `visionos.testSimulator`, and `visionos.archive`
   support.
6. Add device lab workflow after the AWS builder can produce signed artifacts.
