import random
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend connection

# MongoDB Connection
MONGO_URI = "mongodb+srv://leckhasri2005_db_user:Dh8dbU45T8DFBSas@ctsproj.fy4uhpg.mongodb.net/"
client = MongoClient(MONGO_URI)
db = client["cts_data"]
collection = db["input_data"]

def generate_patient_id():
    """Generate a unique patient ID"""
    return f"PT{random.randint(100000,999999)}"

def generate_patient_details():
    """Random patient details"""
    names = ["Vincent Sean", "Jane Smith", "Alice Johnson", "Robert Brown", "Emma Davis","Elwin Sans"]
    age = random.randint(66, 90) if random.random() < 0.7 else random.randint(18, 65)
    insurance = random.choice(["Policy A", "Policy B", "Policy C"])
    service_type = random.choice(["Inpatient", "Outpatient"])
    
    return {
        "name": random.choice(names),
        "age": age,
        "insurance": insurance,
        "service_type": service_type
    }

def calculate_fraud_risk(score):
    """Classify fraud risk based on score"""
    if score >= 0.65:
        return "High"
    elif score <= 0.30:
        return "Low"
    else:
        return "Medium"

# Serve the main HTML page
@app.route("/")
def index():
    return send_from_directory('.', 'audit.html')

# Serve static files (CSS, JS)
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory('.', filename)

@app.route("/all_claims", methods=["GET"])
def all_claims():
    try:
        print("Fetching claims from MongoDB...")  # Debug log
        
        # Fetch latest 30 claims
        cursor = collection.find({}, {"_id": 0}).sort("_id", -1).limit(30)
        claims = []
        
        for doc in cursor:
            claim_data = doc["data"][-1]  # last dict has main info
            patient_id = generate_patient_id()
            fraud_score = claim_data.get("Fraud Score", 0)
            fraud_risk = calculate_fraud_risk(fraud_score)
            
            claims.append({
                "claim_id": claim_data.get("Claim ID"),
                "patient_id": patient_id,
                "provider_id": claim_data.get("Provider ID"),
                "amount": claim_data.get("Avg Claim Value"),
                "status": claim_data.get("Prediction"),
                "fraud_risk": fraud_risk,
                "llm_message": doc["data"][1].get("llm_message"),
                "patient_details": generate_patient_details(),
                "prediction_score": fraud_score,  # Include prediction score
                # Additional fields for frontend compatibility
                "reason": doc["data"][1].get("llm_message"),
                "detection_reason": doc["data"][1].get("llm_message"),
                "amount_claimed": claim_data.get("Avg Claim Value"),
                "risk": fraud_risk,
                "review_notes": "",
                "review_status": None,
                "roi":claim_data.get("ROI"),
                "TP": claim_data.get("TP"),
                "FP": claim_data.get("FP"),
                "FN": claim_data.get("FN"),
                "TN": claim_data.get("TN")
            })
        
        print(f"Returning {len(claims)} claims")  # Debug log
        return jsonify({"status": "success", "data": claims})
        
    except Exception as e:
        print(f"Error in all_claims: {str(e)}")  # Debug log
        return jsonify({"status": "error", "message": str(e)})

if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, port=5002, host='0.0.0.0')
