import csv
import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MySQL connection parameters using environment variables
cnx = mysql.connector.connect(
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    host=os.getenv('DB_HOST'),
    database=os.getenv('DB_NAME')
)
cursor = cnx.cursor()

# CSV file path
csv_file_path = os.path.join(os.getcwd(), 'data/verses_with_index.csv')

# Batch size for inserts
batch_size = 100  # Adjust as needed
batch = []

with open(csv_file_path, mode='r') as csvfile:
    reader = csv.reader(csvfile)
    next(reader)  # Skip the header row
    for row in reader:
        batch.append(row)
        if len(batch) >= batch_size:
            cursor.executemany("INSERT INTO verses (`index`, reference, verse) VALUES (%s, %s, %s)", batch)
            batch = []

    # Insert any remaining rows
    if batch:
        cursor.executemany("INSERT INTO verses (`index`, reference, verse) VALUES (%s, %s, %s)", batch)

cnx.commit()
cursor.close()
cnx.close()