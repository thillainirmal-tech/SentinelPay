# Contributing to SentinelPay

Thank you for helping improve SentinelPay. Before starting a substantial change, open an issue so the approach can be discussed.

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Never commit credentials. Copy `.env.example` and keep local values private.
3. Build the backend with `mvn -B verify`.
4. Keep each pull request focused and document observable behaviour changes.
5. Update tests and documentation when behaviour changes.

Bug reports should include reproduction steps, expected behaviour, actual behaviour, and relevant sanitized logs. Security reports must follow [SECURITY.md](SECURITY.md) instead of a public issue.
