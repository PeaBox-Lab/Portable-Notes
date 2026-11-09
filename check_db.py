import sqlite3

conn = sqlite3.connect("C:/Users/Rajesh/Documents/My Apps/GitHub/Portable-Notes/data/index.db")
print("Tables:")
for row in conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table'"):
    print(" -", row[0])
    print(row[1])
    print("---")
print("Notes count:", conn.execute("SELECT COUNT(*) FROM notes").fetchone())
conn.close()
