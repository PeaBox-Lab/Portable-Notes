
# Migration to 2.1.0

Version 2.1.0 uses Markdown files instead of SQLite as its source of truth. If upgrading from the generated 2.0.0 web build, first use its Export function and copy the exported `.md` files into the new `vault/` directory. Start 2.1.0 and choose “Rebuild search index” from the command palette. Keep the old `notes.db` backup until the imported notes have been checked.

The original Tkinter edition already used Markdown files. Copy its notes directory into `vault/`, preserving folders, then rebuild the index. Existing files without front matter remain readable; front matter is created when a note is saved through Portable Notes.
