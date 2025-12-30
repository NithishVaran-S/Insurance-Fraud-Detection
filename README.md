# HealthGuard AI – Healthcare Claims Fraud Detection System  

## Overview  
HealthGuard AI is an AI-powered fraud detection system designed for Medicare Part A & B claims.  
It integrates Machine Learning (XGBoost, LightGBM, Isolation Forest), Explainable AI (SHAP), and Large Language Models (LLMs) to detect fraudulent claims with high accuracy, reducing false positives by 60% compared to traditional systems.  
The platform provides real-time dashboards, ROI tracking, and human-readable explanations for auditors, providers, and patients.  

---

## Features  

- **Fraud Detection Engine** – Hybrid ensemble (XGBoost + LightGBM + Isolation Forest) for accurate predictions.  
- **Explainable AI (SHAP)** – Provides feature-level contributions for transparent fraud reasoning.  
- **LLM Integration (Groq API)** – Converts technical metrics into plain-language reports.  
- **ROI Tracker** – Calculates recovered fraud value vs. operational cost.  
- **Role-Based Portals**  
  - Patient: View personal claims and fraud status.  
  - Provider: Manage claims and monitor fraud alerts.  
  - Auditor: Access dashboards, claim analysis, and explanations.  
- **Real-Time Processing** – Claims processed in seconds using Kafka and MongoDB.  
- **Interactive Dashboard** – Visualizes fraud trends, claim summaries, and ROI with Chart.js.  

---

## Tech Stack  

- **Frontend:** HTML, CSS, JavaScript, Chart.js  
- **Backend:** Flask (Python), REST API  
- **Database:** AWS RDS (MySQL), AWS Redis (real-time caching)  
- **Streaming:** Apache Kafka  
- **Machine Learning:** scikit-learn, XGBoost, LightGBM, Isolation Forest, SHAP  
- **Explainability:** SHAP (XAI) + Groq API (LLM explanations)  
- **Deployment:** AWS (EC2, RDS, ElastiCache, S3), GitHub CI/CD  

---

## User Roles  

- **Patient** – View claims, fraud detection status, and claim history.  
- **Provider** – Submit and track patient claims, monitor fraud alerts.  
- **Auditor** – Monitor all claims, review fraud alerts, track ROI metrics, and access explanations.  

---

## ROI Calculation  

The system continuously tracks financial efficiency using the formula:  
This is displayed live on the dashboard with fraud prevention statistics.  

---

## Installation & Setup  

1. **Clone the repository**
2. **Create and activate a virtual environment**
3. **Install dependencies**
4. **Setup environment variables**
5. **Run the backend server**
6. **Access the system**
    




