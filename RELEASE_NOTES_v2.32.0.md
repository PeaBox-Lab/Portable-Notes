# Portable Notes 2.32.0: Version consistency and reliability fixes

## Version alignment

This release aligns all version references across the codebase to **2.32.0**:

- Backend (`app.py`, `core/vault.py`, `api/system.py`): version `2.32.0`
- Config (`data/config.json`): version `2.32.0`
- Python package (`pyproject.toml`): version `2.32.0`
- UI (`static/index.html`, `static/app.js`, `static/style.css`): cache-busting param `?v=2.32.0`
- Startup banner: `Portable Notes 2.32.0 running at ...`
- E2E regression suite: validates `v=2.32.0` in served HTML and `2.32.0` in health endpoint

## Retained

- All v2.31.0 corporate UI features: token-driven design system, editor toolbar, dialogs, tabs, tree, attachments, task and project intelligence commands
- All task APIs: dependencies, critical path, risk radar, workload, capacity, burndown, forecast, schedule plan, slippage, baseline health, metadata quality, execution readiness
- 24 unit tests passing; 68-check live-server E2E suite all green
- Python 3.9+ standard library only; no third-party dependencies
