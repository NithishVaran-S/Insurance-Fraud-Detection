import pymysql
import pandas as pd

# --- Connect to AWS RDS MySQL ---
conn = pymysql.connect(
        host="database-1.chouams4o3au.ap-south-1.rds.amazonaws.com",
        user="admin",              # 🔹 replace with your RDS username
        password="ctssmvec2025",   # 🔹 replace with your RDS password
        database="fraud_data",     # 🔹 replace with your DB name
        cursorclass=pymysql.cursors.DictCursor
    )

cursor = conn.cursor()

# ✅ Step 1: Check if medical_history column exists
cursor.execute("SHOW COLUMNS FROM insurance LIKE 'medical_history'")
result = cursor.fetchone()

if not result:  # if column does not exist
    cursor.execute("ALTER TABLE insurance ADD COLUMN medical_history TEXT;")
    print("✅ Added column medical_history")
else:
    print("ℹ️ Column medical_history already exists")

# Step 2: Fetch all data
query = "SELECT * FROM insurance"
df = pd.read_sql(query, conn)

# Step 3: Identify chronic condition columns
chronic_cols = [col for col in df.columns if col.startswith("ChronicCond_")]

# Step 4: Build medical history values
def build_medical_history(row):
    conditions = []
    for col in chronic_cols:
        if str(row[col]).strip().lower() == "included":  # check for "Included"
            conditions.append(col.replace("ChronicCond_", ""))  # take condition name
    return ", ".join(conditions) if conditions else "None"

df["medical_history"] = df.apply(build_medical_history, axis=1)

# Step 5: Update back into AWS table
update_query = "UPDATE insurance SET medical_history = %s WHERE patient_id = %s"

for _, row in df.iterrows():
    cursor.execute(update_query, (row["medical_history"], row["patient_id"]))

conn.commit()
cursor.close()
conn.close()

print("✅ medical_history column updated successfully!")
