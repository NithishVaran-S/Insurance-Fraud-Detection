import json
import os
import re
import numpy as np
import pandas as pd
import joblib
from kafka import KafkaConsumer, KafkaProducer
import shap
from groq import Groq
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()


# ------------------------------
# ROI calculation function
# ------------------------------
def calculate_roi_only(tp, avg_claim_value, personnel_cost, infra_cost, compliance_cost):
    recovered_amount = tp * avg_claim_value
    total_cost = personnel_cost + infra_cost + compliance_cost
    roi = (recovered_amount - total_cost) / total_cost if total_cost > 0 else 0

    return {
        "True Positives": tp,
        "Average Claim Value": avg_claim_value,
        "Recovered Amount": recovered_amount,
        "Total Cost": total_cost,
        "ROI": roi
    }

# ------------------------------
# MongoDB Atlas setup
# ------------------------------
MONGO_URI = os.getenv("MONGO_URI")
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client["cts_data"]
mongo_collection = mongo_db["input_data"]

# ------------------------------
# Load trained model pickle
# ------------------------------
model_dict = joblib.load("simple_fraud_detection_model.pkl")
models = model_dict['models']
scaler = model_dict['scaler']
encoders = model_dict['encoders']

procedure_encoder = encoders['procedure']
diagnosis_encoder = encoders['diagnosis']
gender_encoder = encoders['gender']

# ------------------------------
# Kafka setup
# ------------------------------
consumer = KafkaConsumer(
    'fraud_input',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda v: json.loads(v.decode('utf-8')),
    auto_offset_reset='earliest',
    enable_auto_commit=True
)

producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

# ------------------------------
# Output folder
# ------------------------------
output_folder = "claims_json_outputs"
os.makedirs(output_folder, exist_ok=True)

# ------------------------------
# Groq client
# ------------------------------
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ------------------------------
# Function to call LLM
# ------------------------------
def explain_claim_with_llm(explanation_json):
    claim_id = explanation_json['claim_id']
    provider_id = explanation_json['provider_id']
    fraud_score = explanation_json['fraud_score']
    predicted_label = explanation_json['predicted_label']
    feature_contributions = explanation_json['feature_contributions']
    metrics = explanation_json['metrics']

    tp = metrics.get("tp", 0)
    fp = metrics.get("fp", 0)
    fn = metrics.get("fn", 0)
    tn = metrics.get("tn", 0)
    avg_claim_value = metrics.get("avg_claim_value", 0)
    personnel_cost = metrics.get("personnel_cost", 0)
    infra_cost = metrics.get("infra_cost", 0)
    compliance_cost = metrics.get("compliance_cost", 0)

    contrib_text = "\n".join([f"- {feat}: {weight:.4f}" for feat, weight in feature_contributions.items()]) \
        if feature_contributions else "No feature-level explanation available."

    explanation_prompt = f"""
You are an expert fraud investigator. Explain this prediction in plain English for a business user.

Claim Details:
- Claim ID: {claim_id}
- Provider ID: {provider_id}
- Fraud Score: {fraud_score:.4f}
- Prediction: {predicted_label}

Why:
{contrib_text}

Metrics:
- TP: {tp}, FP: {fp}, FN: {fn}, TN: {tn}
- Avg Claim Value: ${avg_claim_value:,.2f}
- Costs: Personnel ${personnel_cost}, Infra ${infra_cost}, Compliance ${compliance_cost}

Task:
Explain in 3–4 sentences why this claim was classified this way, using very simple language.
"""

    table_prompt = f"""
Return ONLY a JSON array (no text, no markdown) with the following fields:
- Claim ID
- Provider ID
- Fraud Score
- Prediction
- TP, FP, FN, TN ,TN these values should be not in the confusion matrix values, it should be a real time value (eg: 55 )
- Avg Claim Value , this value should not be in minus, this should be the average of total amount claimed
- Personnel Cost
- Infra Cost
- Compliance Cost

Use this data:
Claim ID: {claim_id}
Provider ID: {provider_id}
Fraud Score: {fraud_score:.4f}
Prediction: {predicted_label}
TP: {tp}, FP: {fp}, FN: {fn}, TN: {tn}
Avg Claim Value: {avg_claim_value}
Personnel Cost: {personnel_cost}
Infra Cost: {infra_cost}
Compliance Cost: {compliance_cost}
"""

    explanation_response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": explanation_prompt}],
        temperature=0
    )
    explanation = explanation_response.choices[0].message.content.strip()

    table_response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": table_prompt}],
        temperature=0
    )
    table_json = table_response.choices[0].message.content.strip()

    cleaned_json = re.sub(r"```json|```", "", table_json).strip()
    json_match = re.search(r"(\[.*\]|\{.*\})", cleaned_json, re.DOTALL)
    if json_match:
        cleaned_json = json_match.group(1)

    try:
        metrics_data = json.loads(cleaned_json)
        if isinstance(metrics_data, dict):
            metrics_data = [metrics_data]
    except json.JSONDecodeError:
        raise ValueError(f"Failed to parse JSON from LLM. Cleaned text:\n{cleaned_json}")

    # Save CSV & JSON
    df = pd.DataFrame(metrics_data)
    csv_file = os.path.join(output_folder, f"{claim_id}_metrics.csv")
    json_file = os.path.join(output_folder, f"{claim_id}_metrics.json")
    df.to_csv(csv_file, index=False)
    df.to_json(json_file, orient="records", indent=4)

    return explanation, metrics_data

# ------------------------------
# Consumer loop
# ------------------------------
print("Kafka consumer started... waiting for claims...")

try:
    for message in consumer:
        claim = message.value
        claim_id = claim.get('claim_id', f"SYN_CLM{np.random.randint(1000,999999)}")
        provider_id = claim.get('provider_id', f"PR{np.random.randint(1000,999999)}")
        print(f"\nReceived claim: {claim_id}")

        # --- Existing feature encoding & prediction ---
        procedure_code_enc = procedure_encoder.transform([claim.get('procedure_code','')])[0] \
            if claim.get('procedure_code','') in procedure_encoder.classes_ else 0
        diagnosis_code_enc = diagnosis_encoder.transform([claim.get('diagnosis_code','')])[0] \
            if claim.get('diagnosis_code','') in diagnosis_encoder.classes_ else 0
        gender_enc = gender_encoder.transform([claim.get('gender','')])[0] \
            if claim.get('gender','') in gender_encoder.classes_ else 0

        claim_start = pd.to_datetime(claim.get('claim_start_date', pd.Timestamp.now()))
        claim_thru = pd.to_datetime(claim.get('claim_thru_date', pd.Timestamp.now()))
        claim_duration = (claim_thru - claim_start).days + 1

        peer_stats = [0,0,0,0]

        features = [
            float(claim.get('claim_amount', 0.0)),
            float(claim.get('length_of_stay', 0)),
            float(claim.get('patient_age', 0)),
            claim_duration,
            procedure_code_enc,
            diagnosis_code_enc,
            gender_enc,
            float(claim.get('comorbidity_count',0)),
            0
        ] + peer_stats

        features_scaled = scaler.transform([features])

        xgb_model = models['xgb']
        fraud_score = float(xgb_model.predict_proba(features_scaled)[0][1])
        predicted_label = "FRAUD" if fraud_score >= 0.5 else "NON-FRAUD"

        explainer = shap.TreeExplainer(xgb_model)
        shap_values = explainer.shap_values(features_scaled)[0]

        feature_names = [
            "claim_amount", "length_of_stay", "patient_age", "claim_duration",
            "procedure_code_encoded", "diagnosis_code_encoded", "gender_encoded",
            "comorbidity_count", "fraud_tendency", "peer_avg_amount",
            "peer_std_amount", "peer_avg_los", "peer_total_claims"
        ]

        feature_contributions = {}
        for name, val in zip(feature_names, shap_values):
            if "amount" in name:
                condition = f"{name} <= 1000.00"
            elif "stay" in name:
                condition = f"{name} <= 5.00"
            elif "age" in name:
                condition = f"{name} <= 65"
            else:
                condition = name
            feature_contributions[condition] = round(float(val), 4)

        label = str(claim.get('label', '')).strip().upper()
        predicted_label_norm = predicted_label.strip().upper()

        tp = int(predicted_label_norm == "FRAUD" and label == "FRAUD")
        fp = int(predicted_label_norm == "FRAUD" and label == "NON-FRAUD")
        fn = int(predicted_label_norm == "NON-FRAUD" and label == "FRAUD")

        metrics = {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "avg_claim_value": round(float(claim.get('claim_amount',50.0)), 2),
            "personnel_cost": 5000,
            "infra_cost": 1500,
            "compliance_cost": 800
        }

        explanation_json = {
            "claim_id": claim_id,
            "provider_id": provider_id,
            "fraud_score": round(fraud_score, 8),
            "predicted_label": predicted_label,
            "feature_contributions": feature_contributions,
            "metrics": metrics
        }

        # Send to Kafka
        producer.send('fraud_explanation_output', value=explanation_json)
        producer.flush()

        # Save JSON in folder
        json_file_path = os.path.join(output_folder, f"{claim_id}.json")
        with open(json_file_path,'w') as f:
            json.dump(explanation_json,f,indent=4)

        # --- Call LLM for explanation & metrics ---
        explanation_text, metrics_data = explain_claim_with_llm(explanation_json)

        # --- Merge ROI into metrics_data without touching existing code ---
        roi_result = calculate_roi_only(
            tp=metrics_data[0].get("TP", 0),
            avg_claim_value=metrics_data[0].get("Avg Claim Value", 0),
            personnel_cost=metrics_data[0].get("Personnel Cost", 0),
            infra_cost=metrics_data[0].get("Infra Cost", 0),
            compliance_cost=metrics_data[0].get("Compliance Cost", 0)
        )
        metrics_data[0].update({
            "ROI": roi_result["ROI"],
            "Recovered Amount": roi_result["Recovered Amount"],
            "Total Cost": roi_result["Total Cost"]
        })

        print(f" SHAP explanation & LLM metrics (with ROI) saved for claim {claim_id} in {output_folder}")
        print("\n=== HUMAN-FRIENDLY EXPLANATION ===")
        print(explanation_text)
        print("\n=== METRICS JSON (from LLM + ROI) ===")
        print(json.dumps(metrics_data, indent=4))

        # --- Push structured output to MongoDB Atlas ---
        website_output = [
            {"Received claim": claim_id},
            {"llm_message": explanation_text},
            metrics_data[0]
        ]
        try:
            mongo_collection.insert_one({
                "claim_id": claim_id,
                "data": website_output
            })
            print(f" Website JSON with ROI pushed to MongoDB Atlas for claim {claim_id}")
        except Exception as e:
            print(f" Failed to push website JSON: {e}")

except KeyboardInterrupt:
    print("\nConsumer stopped manually.")
finally:
    consumer.close()
    producer.close()
    mongo_client.close()
    print("Kafka & Mongo connections closed.")
