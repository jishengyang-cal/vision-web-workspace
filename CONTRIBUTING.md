# Contributing

Vision Web Workspace separates Linux-runnable development workflow from Apple-required native execution. Contributions should keep that boundary explicit.

## Contribution workflow

1. Identify whether the change affects contracts, simulator behavior, gateway sessions, Mac Builder workflow, native visionOS source, AWS Mac workflow, or docs.
2. Keep browser simulator behavior and native visionOS behavior clearly separated.
3. Do not claim Linux can compile, sign, install, or run the native visionOS app.
4. Update docs and tests when a workflow or contract changes.
5. Run the relevant verification before opening a pull request.

## Local verification

```bash
pnpm install
pnpm workflow:check
pnpm test:mac-builder
```

For documentation-site changes:

```bash
node --check docs-site/assets/app.js
python3 -m http.server 4173 --directory docs-site
```

## Pull request expectations

- Explain the workflow boundary that changed.
- List affected packages, services, scripts, native files, or docs.
- Include verification output or explain why a check is not applicable.
- Do not include signing assets, credentials, API keys, certificates, provisioning profiles, or private device data.

