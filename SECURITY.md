
# Security Policy

## Supported version
Version 2.5.x receives security fixes.

## Reporting
Use GitHub private vulnerability reporting for https://github.com/iwebslogtech/Portable-Notes when enabled. Do not publish an unpatched vulnerability. Include the affected version and reproducible steps.

## Security model
Portable Notes binds to `127.0.0.1`, performs no telemetry, and sends no note content externally. It rejects vault paths containing traversal segments. Do not change the bind address to `0.0.0.0` without authentication, CSRF protection, TLS, stricter origin controls, and a separate deployment review. Do not open untrusted HTML or executable attachments.
