import pymysql

# ------------------------
# AWS RDS Connection
# ------------------------
def get_db_connection():
    return pymysql.connect(
        host="database-1.chouams4o3au.ap-south-1.rds.amazonaws.com",
        user="admin",              # 🔹 replace with your RDS username
        password="ctssmvec2025",   # 🔹 replace with your RDS password
        database="fraud_data",     # 🔹 replace with your DB name
        cursorclass=pymysql.cursors.DictCursor
    )
conn = get_db_connection()
cursor = conn.cursor()

# --- Step 2: Function to check & add column ---
def add_column_if_not_exists(table_name, column_name, column_type):
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE '{column_name}'")
    result = cursor.fetchone()
    if not result:  # column missing
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type};")
        print(f"✅ Added column: {column_name}")
    else:
        print(f"ℹ️ Column {column_name} already exists")

# --- Step 3: Add review_notes (TEXT) and review_status (VARCHAR) ---
add_column_if_not_exists("claims", "review_notes", "TEXT")
add_column_if_not_exists("claims", "review_status", "VARCHAR(50)")

conn.commit()
cursor.close()
conn.close()

print("✅ Table update completed!")

# # ------------------------
# # Create Table + Insert Data
# # ------------------------
# def setup_claims_table():
#     conn = get_db_connection()
#     cursor = conn.cursor()

#     # 1. Create table if not exists
#     create_table_query = """
#     CREATE TABLE IF NOT EXISTS claims (
#         claim_id VARCHAR(20) PRIMARY KEY,
#         patient_id VARCHAR(20),
#         provider_id VARCHAR(20),
#         amount DECIMAL(10,2),
#         status VARCHAR(20),
#         fraud_risk VARCHAR(20),
#         explanation TEXT,
#         prediction_score DECIMAL(5,2),
#         reason TEXT
#     );
#     """
#     cursor.execute(create_table_query)

#     # 2. Insert sample data
#     insert_query = """
#     INSERT INTO claims (claim_id, patient_id, provider_id, amount, status, fraud_risk, explanation, prediction_score, reason)
#     VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
#     """

#     sample_data = [
#         ('CL7801', 'BENE13708', 'PRV52300', 2250, 'Approved', 'Low',
#          'Normal claim, consistent with patient history.', 0.58, 'Chronic heart disease claim'),

#         ('CL7802', 'BENE14604', 'PRV53398', 1537, 'Approved', 'Low',
#          'Normal claim, consistent with patient history.', 0.34, 'Diabetes management claim'),

#         ('CL7803', 'BENE11120', 'PRV52311', 1758, 'Approved', 'Low',
#          'Claim amount within normal range, consistent with patient history.', 0.24, 'Cancer chemotherapy claim'),

#         ('CL7804', 'BENE14035', 'PRV52344', 3391, 'Approved', 'Low',
#          'Claim amount within normal range, consistent with patient history.', 0.31, 'Kidney dialysis claim'),

#         ('CL7805', 'BENE14194', 'PRV52333', 2779, 'Rejected', 'High',
#          'Unusually high claim amount or pattern inconsistent with provider\'s past claims.', 0.92, 'Hypertension management claim'),

#         ('CL7806', 'BENE14241', 'PRV52322', 3620, 'Rejected', 'High',
#          'Unusually high claim amount or provider flagged for anomalies.', 0.89, 'Cardiac surgery claim'),

#         ('CL7807', 'BENE14604', 'PRV52355', 2987, 'Suspicious', 'Medium',
#          'Some irregularities detected, requires manual review.', 0.55, 'Chronic lung disease claim')
#     ]

#     try:
#         cursor.executemany(insert_query, sample_data)
#         conn.commit()
#         print("✅ Claims table created and sample data inserted successfully.")
#     except Exception as e:
#         print("❌ Error inserting data:", str(e))
#         conn.rollback()

#     cursor.close()
#     conn.close()

# if __name__ == "__main__":
#     setup_claims_table()
