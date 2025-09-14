import csv
from libsql_client import create_client_sync

FAILED_ROWS_FILE = "failed_rows.csv"

# -------------------------------
# Turso Credentials
# -------------------------------
DATABASE_URL = "https://mindtrack-blackout2635.aws-ap-south-1.turso.io"
AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3NTc3MDY3NzksImlhdCI6MTc1NzYyMDM3OSwiaWQiOiIwN2RjZGQ4OC1hZTk3LTQ5YTEtOTQ4Ny1hMWNhNzhiM2ZlNTUiLCJyaWQiOiJmMjcwMWM2OS00ZmQ3LTRhOTUtYWFjZi0wMjQyMDY3NmIwNTMifQ.2OFJ-TS_tnlmBxqO923DHGzZUds4lVG1aHXsYaeiFpHOoSMuo_kAI98abkIuZbwOrsG6Q24RuslShDIbofehCw"

# -------------------------------
# Connect to Turso
# -------------------------------
print("[INFO] Connecting to Turso...")
client = create_client_sync(url=DATABASE_URL, auth_token=AUTH_TOKEN)
print("[SUCCESS] Connected to Turso ✅")

# -------------------------------
# Create Tables
# -------------------------------
print("[INFO] Creating tables with enhancements...")

# Questions table
client.execute("""
               CREATE TABLE IF NOT EXISTS questions
               (
                   question_id
                   INTEGER
                   PRIMARY
                   KEY,
                   title
                   TEXT
                   NOT
                   NULL,
                   url
                   TEXT,
                   source
                   TEXT
                   NOT
                   NULL,
                   difficulty
                   TEXT,
                   is_premium
                   BOOLEAN
                   DEFAULT
                   FALSE,
                   acceptance_rate
                   REAL,
                   frequency
                   REAL,
                   description
                   TEXT,
                   created_at
                   TIMESTAMP
                   DEFAULT
                   CURRENT_TIMESTAMP
               );
               """)

# Categories table
client.execute("""
               CREATE TABLE IF NOT EXISTS categories
               (
                   category_id
                   INTEGER
                   PRIMARY
                   KEY
                   AUTOINCREMENT,
                   name
                   TEXT
                   UNIQUE
               );
               """)

# Question ↔ Category mapping
client.execute("""
               CREATE TABLE IF NOT EXISTS question_categories
               (
                   question_id
                   INT,
                   category_id
                   INT,
                   FOREIGN
                   KEY
               (
                   question_id
               ) REFERENCES questions
               (
                   question_id
               ),
                   FOREIGN KEY
               (
                   category_id
               ) REFERENCES categories
               (
                   category_id
               )
                   );
               """)

# Companies table
client.execute("""
               CREATE TABLE IF NOT EXISTS companies
               (
                   company_id
                   INTEGER
                   PRIMARY
                   KEY
                   AUTOINCREMENT,
                   name
                   TEXT
                   UNIQUE
               );
               """)

# Question ↔ Company mapping
client.execute("""
               CREATE TABLE IF NOT EXISTS question_companies
               (
                   question_id
                   INT,
                   company_id
                   INT,
                   FOREIGN
                   KEY
               (
                   question_id
               ) REFERENCES questions
               (
                   question_id
               ),
                   FOREIGN KEY
               (
                   company_id
               ) REFERENCES companies
               (
                   company_id
               )
                   );
               """)

# Sheets table
client.execute("""
               CREATE TABLE IF NOT EXISTS sheets
               (
                   sheet_id
                   INTEGER
                   PRIMARY
                   KEY
                   AUTOINCREMENT,
                   name
                   TEXT
                   UNIQUE,
                   source
                   TEXT
               );
               """)

# Question ↔ Sheet mapping
client.execute("""
               CREATE TABLE IF NOT EXISTS question_sheets
               (
                   question_id
                   INT,
                   sheet_id
                   INT,
                   FOREIGN
                   KEY
               (
                   question_id
               ) REFERENCES questions
               (
                   question_id
               ),
                   FOREIGN KEY
               (
                   sheet_id
               ) REFERENCES sheets
               (
                   sheet_id
               )
                   );
               """)

# Users table
client.execute("""
               CREATE TABLE IF NOT EXISTS users
               (
                   user_id
                   TEXT
                   PRIMARY
                   KEY,
                   leetcode_username
                   TEXT,
                   app_username
                   TEXT,
                   is_verified
                   BOOLEAN
                   DEFAULT
                   FALSE,
                   easy_solved
                   INT
                   DEFAULT
                   0,
                   medium_solved
                   INT
                   DEFAULT
                   0,
                   hard_solved
                   INT
                   DEFAULT
                   0,
                   total_solved
                   INT
                   DEFAULT
                   0,
                   current_streak
                   INT
                   DEFAULT
                   0,
                   longest_streak
                   INT
                   DEFAULT
                   0,
                   last_solved_date
                   DATE
               );
               """)

# User Question Progress table
client.execute("""
               CREATE TABLE IF NOT EXISTS user_question_progress
               (
                   user_id
                   TEXT,
                   question_id
                   INT,
                   is_solved
                   BOOLEAN
                   DEFAULT
                   FALSE,
                   is_starred
                   BOOLEAN
                   DEFAULT
                   FALSE,
                   solved_at
                   TIMESTAMP
                   NULL,
                   PRIMARY
                   KEY
               (
                   user_id,
                   question_id
               ),
                   FOREIGN KEY
               (
                   user_id
               ) REFERENCES users
               (
                   user_id
               ),
                   FOREIGN KEY
               (
                   question_id
               ) REFERENCES questions
               (
                   question_id
               )
                   );
               """)

print("[SUCCESS] All tables created ✅")

# -------------------------------
# GLOBALS
# -------------------------------
failed_rows = []
MIXED_START_ID = 5001
current_mixed_id = MIXED_START_ID


# -------------------------------
# Helper functions
# -------------------------------

def get_or_create_category(name):
    name = name.strip()
    if not name:
        return None
    result = client.execute("SELECT category_id FROM categories WHERE name = ?", [name])
    if result:
        return result[0]["category_id"]
    client.execute("INSERT INTO categories (name) VALUES (?)", [name])
    return client.execute("SELECT category_id FROM categories WHERE name = ?", [name])[0]["category_id"]


def get_or_create_company(name):
    name = name.strip()
    if not name:
        return None
    result = client.execute("SELECT company_id FROM companies WHERE name = ?", [name])
    if result:
        return result[0]["company_id"]
    client.execute("INSERT INTO companies (name) VALUES (?)", [name])
    return client.execute("SELECT company_id FROM companies WHERE name = ?", [name])[0]["company_id"]


def get_or_create_sheet(name, source=None):
    name = name.strip()
    if not name:
        return None
    result = client.execute("SELECT sheet_id FROM sheets WHERE name = ?", [name])
    if result:
        return result[0]["sheet_id"]
    client.execute("INSERT INTO sheets (name, source) VALUES (?, ?)", [name, source])
    return client.execute("SELECT sheet_id FROM sheets WHERE name = ?", [name])[0]["sheet_id"]


def insert_question(title, url, source, difficulty=None, premium=False, acceptance=None, freq=None, question_id=None):
    if question_id:
        sql = """
              INSERT INTO questions (question_id, title, url, source, difficulty, is_premium, acceptance_rate, \
                                     frequency)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING question_id \
              """
        result = client.execute(sql, [question_id, title, url, source, difficulty, premium, acceptance, freq])
    else:
        sql = """
              INSERT INTO questions (title, url, source, difficulty, is_premium, acceptance_rate, frequency)
              VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING question_id \
              """
        result = client.execute(sql, [title, url, source, difficulty, premium, acceptance, freq])
    return result[0]["question_id"]


# -------------------------------
# Upload LeetCode CSV
# -------------------------------
def upload_leetcode(csv_file):
    print(f"\n[INFO] Uploading LeetCode data from {csv_file}")
    count = 0
    with open(csv_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_number, row in enumerate(reader, start=1):
            try:
                qid = insert_question(
                    title=row["Title"].strip(),
                    url="https://leetcode.com" + row["URL"].strip(),
                    source="LeetCode",
                    difficulty=row.get("Difficulty"),
                    premium=row.get("Is Premium") == "Y",
                    acceptance=float(row["Acceptance %"].replace("%", "")) if row.get("Acceptance %") else None,
                    freq=float(row["Frequency %"].replace("%", "")) if row.get("Frequency %") else None,
                    question_id=int(row["ID"])
                )

                # Categories
                if row.get("Topics"):
                    for topic in row["Topics"].split(","):
                        cid = get_or_create_category(topic)
                        if cid:
                            client.execute("INSERT INTO question_categories (question_id, category_id) VALUES (?, ?)",
                                           [qid, cid])

                # Companies
                if row.get("Company"):
                    for comp in row["Company"].split(","):
                        cid = get_or_create_company(comp)
                        if cid:
                            client.execute("INSERT INTO question_companies (question_id, company_id) VALUES (?, ?)",
                                           [qid, cid])

                # Sheets
                if row.get("is_Blind75") == "1":
                    sid = get_or_create_sheet("Blind75", "LeetCode")
                    client.execute("INSERT INTO question_sheets (question_id, sheet_id) VALUES (?, ?)", [qid, sid])
                if row.get("is_neetCode150") == "1":
                    sid = get_or_create_sheet("NeetCode150", "LeetCode")
                    client.execute("INSERT INTO question_sheets (question_id, sheet_id) VALUES (?, ?)", [qid, sid])

                count += 1
                if count % 50 == 0:
                    print(f"   [PROGRESS] {count} LeetCode rows inserted...")

            except Exception as e:
                print(f"[ERROR] Row #{row_number} caused an error: {e}")
                print("Row data:", row)
                failed_rows.append(row)

    print(f"[DONE] {count} LeetCode rows inserted ✅")


# -------------------------------
# Upload Mixed CSV
# -------------------------------
def upload_mixed(csv_file):
    global current_mixed_id
    print(f"\n[INFO] Uploading Mixed data from {csv_file}")
    count = 0
    with open(csv_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_number, row in enumerate(reader, start=1):
            try:
                title_key = row.get("Title") or row.get("Title ")
                url = row.get("Link") or row.get("link")

                # Check if this question already exists in LeetCode
                existing = client.execute("SELECT question_id FROM questions WHERE url = ?", [url.strip()])
                if existing:
                    qid = existing[0]["question_id"]
                else:
                    qid = insert_question(
                        title=title_key.strip(),
                        url=url.strip(),
                        source="Mixed",
                        question_id=current_mixed_id
                    )
                    current_mixed_id += 1

                # Category
                if row.get("Topics"):
                    for topic in row["Topics"].split(","):
                        cid = get_or_create_category(topic)
                        if cid:
                            client.execute("INSERT INTO question_categories (question_id, category_id) VALUES (?, ?)",
                                           [qid, cid])

                # Sheets
                if row.get("is_kodnest150") == "1":
                    sid = get_or_create_sheet("Kodnest150", "Mixed")
                    client.execute("INSERT INTO question_sheets (question_id, sheet_id) VALUES (?, ?)", [qid, sid])
                if row.get("is_Final450") == "1":
                    sid = get_or_create_sheet("Final450", "Mixed")
                    client.execute("INSERT INTO question_sheets (question_id, sheet_id) VALUES (?, ?)", [qid, sid])
                if row.get("is_AlgoPrep150") == "1":
                    sid = get_or_create_sheet("AlgoPrep150", "Mixed")
                    client.execute("INSERT INTO question_sheets (question_id, sheet_id) VALUES (?, ?)", [qid, sid])

                count += 1
                if count % 50 == 0:
                    print(f"   [PROGRESS] {count} Mixed rows inserted...")

            except Exception as e:
                print(f"[ERROR] Row #{row_number} caused an error: {e}")
                print("Row data:", row)
                failed_rows.append(row)

    print(f"[DONE] {count} Mixed rows inserted ✅")


# -------------------------------
# Run Migration
# -------------------------------
if __name__ == "__main__":
    upload_leetcode("leetcode.csv")
    upload_mixed("mixed.csv")

    # -------------------------------
    #  SAVE FAILED ROWS
    # -------------------------------
    if failed_rows:
        keys = failed_rows[0].keys()
        with open("failed_rows.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(failed_rows)
        print(f"\n[INFO] {len(failed_rows)} failed rows saved to failed_rows.csv")
    else:
        print("\n[INFO] No failed rows.")

    print("\n✅ Migration completed successfully!")