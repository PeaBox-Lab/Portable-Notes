
# Portable Notes 2.7 User Guide

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
