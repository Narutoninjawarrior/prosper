# init_db.py
# Initializes the SQLite database using schema.sql

from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'stewardship.db'
SCHEMA_PATH = BASE_DIR / 'schema.sql'

def init_database():
    print(f"Initializing database at: {DB_PATH}")
    
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found at: {SCHEMA_PATH}")
        
    with SCHEMA_PATH.open('r', encoding='utf-8') as f:
        schema_sql = f.read()

    if DB_PATH.exists():
        DB_PATH.unlink()

    # Connect to SQLite (creates database file if it doesn't exist)
    conn = sqlite3.connect(DB_PATH)
    try:
        # Enable foreign keys session-level
        conn.execute("PRAGMA foreign_keys = ON;")
        
        # Execute schema statements
        conn.executescript(schema_sql)
        conn.commit()
        print("Database schema successfully applied.")
    except Exception as e:
        conn.rollback()
        print(f"Failed to apply database schema: {e}")
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    init_database()
