
# Portable Notes 2.30.3 User Guide

## Start

Run `python app.py` or use `start.bat`. Create notes with `Ctrl+N`, organize them by changing the Folder property, and add comma-separated tags. Saves occur automatically after a short pause.

## Links and backlinks

Type `[[Project Plan]]` to link a note. Clicking a missing link creates it. Renaming a note updates exact wiki-link references throughout the vault.

## Daily notes

Use the calendar button or the command palette. Daily notes are stored under `vault/Daily Notes/` with ISO `YYYY-MM-DD` names.

## External editing

Markdown files may be edited in Obsidian, Notepad++, or VS Code. Portable Notes checks file modification times and refreshes its index. Use “Rebuild search index” from the command palette if needed.

## Backup and recovery

Use Export to download the complete vault as a ZIP. Deleted notes are moved to `vault/.portable-notes/trash/`. Copy the full `vault/` directory for a direct backup.

## Custom vault

Run `python app.py --vault "PATH"`. The selected absolute path is saved locally in `data/config.json`.

## Search and knowledge
Use the search box for full-text queries. Use the command palette to save the current search, inspect unlinked mentions of the current note title, or detect notes with duplicate normalized content.

## Tasks
Write tasks as `- [ ] Task`. Optional due dates use `due: YYYY-MM-DD` or `📅 YYYY-MM-DD`. Open Global open tasks from the command palette to aggregate incomplete tasks across notes.

## Task intelligence
Examples: `- [ ] Ship release due: 2026-11-10 priority: high project: PortableNotes` and `- [ ] Review docs 📅 2026-11-08 !medium #project/Docs`. Past due incomplete tasks are flagged as overdue in the task API and dedicated command-palette view.

## Project dashboard
Open the command palette and choose **Task & project dashboard**. Tasks using `project: Name` or `#project/Name` are grouped by project; tasks without project metadata appear as Unassigned.

## Task calendar
Tasks containing `due: YYYY-MM-DD` or `📅 YYYY-MM-DD` automatically appear in the Task calendar. The API supports `start` and `end` date parameters for bounded agenda views.

## Task board
Task Board automatically derives workflow lanes from task completion and due dates. Add project metadata to filter the API to one project. Markdown remains canonical.

## Focus view
Choose **7-day focus** in the command palette to surface actionable open tasks. Overdue and today items lead the list, followed by dated upcoming work and undated high/medium-priority tasks.

## Weekly review
Choose **Weekly review** from the command palette. The review summarizes open and completed tasks, overdue work, tasks due in the next seven days, undated work, and workload grouped by project.

## Productivity stats
Choose **Productivity stats** from the command palette. It reports completion percentage, overdue and due-today counts, priority distribution, and project-level progress without changing your Markdown files.

## Project health
Choose **Project health** in the command palette. Each project shows completion percentage, open tasks, overdue tasks, high-priority tasks, and its next open due date.

## Project workspace
Choose **Project workspace**, enter the project identifier used in `project: Name` or `#project/Name`, and review completion, risk metrics, source-note count, and project tasks.

## Project timeline
Choose **Project timeline**, optionally enter a project, and review dated tasks chronologically with monthly progress rollups.

## Milestones
Add milestone metadata to a task with `milestone: Name` or `#milestone/Name`. Open **Milestones** from the command palette to review grouped progress.

## Milestone board
Open **Milestone board**, optionally enter a project and milestone, and review milestone tasks in Overdue, Active, and Done lanes with progress summaries.

## Task dependencies
Give tasks IDs using `taskid: ID` or `#task/ID`. Add one or more `depends: ID` or `#depends/ID` references to dependent tasks. Open **Task dependencies** to inspect Ready, Blocked, and Unresolved work.

## Critical path
After assigning task IDs and dependencies, choose **Critical path**. Portable Notes calculates dependency depth, highlights the deepest chain candidates, and reports cycles.

## Risk radar
Choose **Risk radar** and optionally a project. Tasks are classified Critical, High, Medium, or Low using overdue status, priority, and dependency signals; the displayed reasons explain each score.

## Workload planning
Add an effort estimate such as `estimate: 3h` or `est: 1.5h`. Choose **Workload** to review project demand for the next seven days and identify unestimated tasks.

## Capacity planning
Choose **Capacity**, provide weekly available hours, and optionally a project. Portable Notes compares estimated work due within seven days against that capacity and reports utilization, remaining hours, overdue work, and unestimated tasks.

## Burndown planning
Choose **Burndown**, optionally provide a project, and choose a horizon from 1 to 90 days. The view compares ideal remaining effort with work implied by task due dates.

## Delivery forecast
Choose **Delivery forecast**, provide weekly capacity, and optionally a project. The forecast reports remaining effort, estimated weeks, projected finish date, latest due date, and schedule status.

## Schedule plan
Choose **Schedule plan**, enter daily hours, and optionally a project. Portable Notes creates a due-date and priority ordered execution plan and divides large tasks across capacity-constrained days.

## Schedule slippage
Add a baseline date such as `baseline: 2026-11-10` to a dated task. When the current `due:` date changes, **Schedule slippage** shows the variance in days and aggregates schedule movement by project.

## Baseline health
Choose **Baseline health** to see baseline coverage, slipped/ahead/on-baseline counts, average slippage and a deterministic Green/Amber/Red status for each project.

## Metadata quality
Choose **Metadata quality** to identify incomplete task metadata. Open tasks are checked for task ID, due date, baseline and estimate; task IDs are checked for duplicates, and dependency references are checked for unresolved IDs.

## Execution readiness
Choose **Execution readiness** to identify work that can start now versus tasks needing attention or blocked by metadata, dependencies, duplicate IDs, or overdue status.
