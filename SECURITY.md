# Security Policy

Vision Web Workspace touches remote development surfaces and native Apple build workflow metadata. Please report security issues privately before opening a public issue.

## Reporting a vulnerability

Use GitHub private vulnerability reporting if it is enabled for this repository. If not, contact the repository owner privately.

Include:

- Affected workflow, service, script, or native boundary.
- Reproduction steps or a minimal proof of concept.
- Expected and observed behavior.
- Impact on credentials, signing assets, remote sessions, Mac Builder jobs, artifacts, logs, or device workflow.

Do not include:

- Raw SSH keys, GitHub tokens, Apple certificates, provisioning profiles, passwords, or private keys.
- Private hostnames, device identifiers, account details, or production infrastructure diagrams.

## Security boundaries

- The browser and Vision Pro client must not receive SSH keys, GitHub tokens, signing assets, or production deployment authority.
- Native visionOS build, simulator, signing, archive, and `.xcresult` generation require macOS and Xcode.
- Mac Builder requests and artifacts should be explicit, logged, and scoped to the requested project path.

