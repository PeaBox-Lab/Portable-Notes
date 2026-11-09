import re, sys, os
from pathlib import Path

ROOT = Path('C:/Users/Rajesh/Documents/My Apps/GitHub/Portable-Notes')

issues = []
files_checked = [
    'app.py', 'data/config.json', 'api/system.py', 'static/index.html',
    'static/style.css', 'static/app.js', 'core/vault.py', 'pyproject.toml',
]

# 1. Version consistency check
all_versions = set()
for fname in files_checked:
    p = ROOT / fname
    if not p.exists():
        continue
    content = p.read_text(encoding='utf-8')
    versions = re.findall(r'2\.\d+\.\d+', content)
    unique = set(versions) - {'v'}  # remove false positives like 'v' + number
    if unique:
        all_versions |= unique
        print(f"{fname}: {unique}")

print(f"\nAll versions found: {all_versions}")
if all_versions == {'2.32.0'}:
    print("PASS: Single version 2.32.0 found everywhere")
else:
    print("FAIL: Multiple or conflicting versions found")
    for v in sorted(all_versions):
        if v != '2.32.0':
            issues.append(f"Version conflict: {v} found in multiple files")

# 2. Check for hardcoded old versions
old_checks = [
    ('README.md', r'What\'s new in 2\.31\.0'),
    ('tests/e2e_ui_actions.py', r'v=2\.31\.0'),
]
print("\n--- Old version references remaining ---")
any_remaining = False
for fname, pattern in old_checks:
    p = ROOT / fname
    if p.exists():
        content = p.read_text(encoding='utf-8')
        matches = re.findall(pattern, content)
        if matches:
            any_remaining = True
            print(f"FAIL: {fname} still references 2.31.0 ({matches[:3]})")
if not any_remaining:
    print("PASS: No old version references remain")

# 3. Check that startup banner is correct
with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()
    if '2.32.0 running' in content and '2.31.0 running' not in content:
        print("\nPASS: Startup banner says 2.32.0")
    else:
        print("\nFAIL: Startup banner still says 2.31.0")
        issues.append("Startup banner still shows 2.31.0")

# 4. Syntax check
import py_compile
for fname in ['app.py', 'core/tasks.py', 'core/vault.py', 'services/task_repository.py']:
    p = ROOT / fname
    try:
        py_compile.compile(str(p), doraise=True)
        print(f"PASS: {fname} compiles cleanly")
    except py_compile.PyCompileError as e:
        print(f"FAIL: {fname} has syntax errors: {e}")
        issues.append(f"Syntax error in {fname}")

# 5. Check CHANGELOG has latest entry
changelog = ROOT / 'CHANGELOG.md'
if changelog.exists():
    content = changelog.read_text(encoding='utf-8')
    if '## [2.32.0]' in content:
        print("PASS: CHANGELOG has 2.32.0 entry")
    else:
        print("WARN: CHANGELOG missing 2.32.0 entry (RELEASE_NOTES_v2.32.0.md exists)")

# 6. Summary
print(f"\n{'='*60}")
if issues:
    print(f"AUDIT RESULTS: {len(issues)} ISSUES FOUND")
    for i, issue in enumerate(issues, 1):
        print(f"  {i}. {issue}")
    sys.exit(1)
else:
    print("AUDIT RESULTS: ALL CLEAN")
    sys.exit(0)