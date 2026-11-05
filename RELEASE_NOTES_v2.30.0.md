# Portable Notes 2.30.0: Architecture and Reliability

This cumulative stabilization release retains the v2.29 feature and API surface while addressing the architecture and test gaps identified in the v2.29 audit.

## Architecture
- Added a canonical immutable `Task` model and `parse_task_line()` / `parse_tasks()` in `core/tasks.py`.
- Centralized all task metadata regex definitions used by the existing API handlers.
- Added `TaskRepository` as the reusable task query boundary.
- Added explicit `core`, `services`, and `api` package boundaries.
- Added typed application errors for validation, not-found, and conflict cases.

## Reliability
- Expanded automated coverage from 3 tests to 19 tests.
- Added task syntax, aliases, defaults, multiple dependencies, line-number and serialization tests.
- Added repository filtering tests and extended path/name security tests.
- Restored missing v2.3 historical release-document continuity.
- Updated core documentation to be version-neutral while retaining historical details in release notes and CHANGELOG.

## Compatibility
- Existing v2.29 routes and user-facing workflows are retained.
- Markdown remains the canonical source of truth.
- Python standard-library-only portability is retained.
