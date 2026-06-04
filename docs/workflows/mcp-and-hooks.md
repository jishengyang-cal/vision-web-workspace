# MCP and Hook Boundaries

This repository uses workflows as the executable control plane, skills as agent
guidance, MCP interfaces as future dynamic capability adapters, and hooks as
local enforcement.

## MCP role

MCP adapters should expose audited capabilities that cannot run safely inside
the browser simulator or Vision Pro client.

Initial interface specs live in `mcp/interfaces`:

- `mac-builder.json`: native Xcode build, simulator, archive, and `.xcresult`
  export through a controlled Mac host. A local mock implementation is
  available through `pnpm dev:mac-builder:mock`; the planned production
  deployment target is AWS EC2 Mac, documented in
  `docs/workflows/aws-ec2-mac-builder.md`.
- `docs-index.json`: searchable project and Apple documentation index.
- `device-lab.json`: Apple Vision Pro install, debug capture, and test records.

These specs are contracts. They are not active network servers yet.

## Required MCP boundary

The browser simulator and Vision Pro client may request work, but they must not
receive direct access to:

- SSH private keys.
- GitHub tokens.
- signing certificates.
- provisioning profiles.
- App Store Connect credentials.
- production deployment credentials.

MCP servers must enforce approval, policy, audit logging, and artifact scoping
before running privileged operations.

## Hook role

Git hooks are local guardrails:

- `pre-commit` runs `pnpm compliance:check`.
- `pre-push` runs `pnpm workflow:check`.

Install hooks in this repository with:

```bash
pnpm hooks:install
```

The hooks do not replace CI or the future Mac builder. They catch boundary
violations before changes leave the local repo.

## Adapter escalation rule

When an agent or workflow reaches a macOS/Xcode-only phase:

1. Run `pnpm visionos:mac-build:check`.
2. If no Mac builder adapter URL exists, stop with the missing capability.
3. If `VISIONOS_MAC_BUILDER_URL` exists, send only the minimum build request
   and repo ref.
4. Keep credentials and device authority inside the Mac builder or device lab.
5. Return logs, summaries, and scoped artifacts to the repo workflow.
