# Security Policy

## Scope

This project includes a static preview, a read-only API foundation and PostgreSQL schema migrations. There is no public user signup, production database, deployed API or executable workspace runtime at this stage.

## Reporting a vulnerability

- Do not publish exploit details in a public issue or discussion.
- Use GitHub's private vulnerability reporting feature for this repository if it is enabled. Otherwise, contact the repository owner through a private channel before sharing details.
- Include the affected commit or file, impact, prerequisites, and a minimal reproducible proof of concept.
- Do not include real credentials, personal data, tenant data or third-party secrets in a report.

## Testing boundaries

- Only test the repository code and environments you own or have explicit authorization to assess.
- Do not scan or attack unrelated systems, identity providers, cloud accounts or infrastructure.
- Do not attempt cross-tenant tests against a live service. Use the ephemeral PostgreSQL CI environment and synthetic fixtures.

## Release gates

General availability remains blocked until identity and MFA controls, browser session security, production database isolation, runtime sandboxing, network egress controls, abuse handling, backups, independent penetration testing and incident-response procedures have evidence of completion.
