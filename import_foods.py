import sqlite3
import csv

# Connect to database
conn = sqlite3.connect('database.sqlite')
cursor = conn.cursor()

# Create table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS global_foods (
        id TEXT PRIMARY KEY,
        name TEXT,
        calories INTEGER,
        protein INTEGER,
        carbs INTEGER,
        fat INTEGER
    )
''')

# Clear table if we want a fresh import
cursor.execute('DELETE FROM global_foods')

# Read CSV and insert
count = 0
with open('global_foods.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader) # skip header
    for row in reader:
        if len(row) == 6:
            cursor.execute('''
                INSERT INTO global_foods (id, name, calories, protein, carbs, fat)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (row[0], row[1], int(row[2]), int(row[3]), int(row[4]), int(row[5])))
            count += 1

conn.commit()
conn.close()

print(f"Successfully inserted {count} foods into database.sqlite")
