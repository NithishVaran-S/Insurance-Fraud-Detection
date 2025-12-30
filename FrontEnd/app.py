# Combined Flask Application: Healthcare Fraud Detection + Gemini Chatbot
import os
import json
import logging
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, render_template_string
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import pymysql

# Load environment variables
load_dotenv()
print(f"API Key loaded: {os.getenv('GEMINI_API_KEY') is not None}")

# Initialize Flask app
app = Flask(__name__)
app.secret_key = "leckha@10"  # change to strong key in production

# Configure CORS
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:5000", "your-website-domain.com"])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Gemini API for chatbot
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("⚠️ GEMINI_API_KEY is missing. Chatbot functionality will be disabled.")

# ------------------------
# AWS RDS MySQL Connection
# ------------------------
def get_db_connection():
    return pymysql.connect(
        host="database-1.chouams4o3au.ap-south-1.rds.amazonaws.com",
        user="admin",
        password="ctssmvec2025",
        database="fraud_data",
        cursorclass=pymysql.cursors.DictCursor
    )

# ------------------------
# Gemini Chatbot Class
# ------------------------
class GeminiChatbot:
    def __init__(self):
        if GEMINI_API_KEY:
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self.chat_sessions = {}
            
            # Healthcare-focused system prompt
            self.healthcare_prompt = """
            You are a helpful AI assistant for a Healthcare Fraud Detection and Management Platform. 
            The user may belong to one of the following roles:
            - Patient - seeking information about their claims, coverage, and healthcare services
            - Auditor - reviewing claims for fraud detection and analysis
            - Healthcare Provider - managing patient claims and understanding fraud risk
            
            You can help with:
            - Explaining fraud detection results and risk scores
            - Answering questions about insurance claims and coverage
            - Providing guidance on healthcare procedures and policies
            - Explaining medical billing and coding concepts
            - Helping users understand their dashboard and system features
            
            Always provide clear, accurate, and role-appropriate responses. 
            When discussing fraud detection, explain the reasoning behind AI predictions.
            Maintain patient privacy and confidentiality at all times.
            """
        else:
            self.model = None
            self.chat_sessions = {}
            self.healthcare_prompt = ""

    def get_or_create_session(self, session_id):
        if not self.model:
            return None
        if session_id not in self.chat_sessions:
            self.chat_sessions[session_id] = self.model.start_chat(history=[])
        return self.chat_sessions[session_id]

    def generate_response(self, message, session_id="default", context=None):
        if not self.model:
            return {
                "success": False,
                "error": "Chatbot service unavailable - API key not configured",
                "timestamp": datetime.now().isoformat()
            }
        
        try:
            chat = self.get_or_create_session(session_id)
            if not chat:
                return {
                    "success": False,
                    "error": "Unable to create chat session",
                    "timestamp": datetime.now().isoformat()
                }
            
            # Include healthcare context and user role
            user_role = session.get("userType", "user") if session else "user"
            full_message = f"{self.healthcare_prompt}\n\nUser Role: {user_role}\nContext: {context or ''}\n\nUser: {message}"
            
            response = chat.send_message(full_message)
            return {
                "success": True,
                "response": response.text,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    def clear_session(self, session_id):
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]
            return True
        return False

# Initialize chatbot
chatbot = GeminiChatbot()

# ------------------------
# Healthcare Fraud Detection Routes
# ------------------------
@app.route("/")
def home():
    return render_template("home.html")

@app.route("/login", methods=["GET"])
def login_page():
    return render_template("login.html")

@app.route("/login", methods=["POST"])
def login_api():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        user_type = data.get("userType")

        conn = get_db_connection()
        cursor = conn.cursor()

        if user_type == "patient":
            query = "SELECT * FROM insurance WHERE email=%s AND password=%s"
        elif user_type in ["audit", "provider"]:
            query = "SELECT * FROM audit WHERE email=%s AND password=%s"
        else:
            return jsonify({"status": "error", "message": "Invalid user type"})

        cursor.execute(query, (email, password))
        result = cursor.fetchone()
        conn.close()

        if result:
            session["email"] = email
            session["userType"] = user_type
            if user_type == "patient":
                return jsonify({"status": "user_success"})
            elif user_type == "audit":
                return jsonify({"status": "audit_success"})
            elif user_type == "provider":
                return jsonify({"status": "provider_success"})
        else:
            return jsonify({"status": "error", "message": "Invalid credentials"})
    except Exception as e:
        logger.error(f"LOGIN ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/user_claims")
def user_claims():
    if "email" not in session or session.get("userType") != "patient":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT patient_id FROM insurance WHERE email=%s", (session["email"],))
    patient = cursor.fetchone()
    if not patient:
        conn.close()
        return jsonify({"status": "error", "message": "Patient not found"}), 404

    patient_id = patient["patient_id"]

    cursor.execute("""
        SELECT claim_id, provider_id, amount, status
        FROM claims
        WHERE patient_id = %s
        ORDER BY claim_id DESC
    """, (patient_id,))
    rows = cursor.fetchall()
    conn.close()

    return jsonify({"status": "success", "data": rows})

# Dashboard routes
@app.route("/user")
def user_dashboard():
    if "userType" in session and session["userType"] == "patient":
        return render_template("user.html")
    return redirect(url_for("home"))

@app.route("/audit")
def audit_dashboard():
    if "userType" in session and session["userType"] == "audit":
        return render_template("audit.html")
    return redirect(url_for("home"))

@app.route("/provider")
def provider_dashboard():
    if "userType" in session and session["userType"] == "provider":
        return render_template("provider.html")
    return redirect(url_for("home"))

@app.route("/user_data")
def user_data():
    if "email" not in session or session.get("userType") != "patient":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    email = session["email"]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM insurance WHERE email=%s", (email,))
    rows = cursor.fetchall()
    conn.close()

    processed = []
    for row in rows:
        medical_history = []
        for key, value in row.items():
            if key.startswith("ChronicCond_") and value in ("Included", "Yes"):
                medical_history.append(key.replace("ChronicCond_", ""))

        processed.append({
            "patient_id": row["patient_id"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "dob": row["dob"],
            "age": row["age"],
            "gender": row["gender"],
            "race": row["race"],
            "state": row["State"],
            "county": row["County"],
            "insurance_id": row["insurance_id"],
            "phone_no": row["phone_no"],
            "address": row["address"],
            "medical_history": medical_history
        })

    return jsonify({"status": "success", "data": processed})

@app.route("/claims_data")
def claims_data():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
        SELECT claim_id, patient_id, provider_id, amount, status,
               fraud_risk, reason, prediction_score, explanation,
               review_notes, review_status
        FROM claims
        ORDER BY claim_id DESC
        LIMIT 50
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        logger.error(f"CLAIMS FETCH ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/claim_details/<claim_id>")
def claim_details(claim_id):
    if "userType" not in session or session["userType"] != "audit":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM claims WHERE claim_id=%s", (claim_id,))
        claim = cursor.fetchone()
        if not claim:
            conn.close()
            return jsonify({"status": "error", "message": "Claim not found"})

        patient_id = claim["patient_id"]
        cursor.execute("SELECT * FROM insurance WHERE patient_id=%s", (patient_id,))
        patient = cursor.fetchone()
        conn.close()

        return jsonify({
            "status": "success",
            "data": {
                "claim_id": claim["claim_id"],
                "patient_id": claim["patient_id"],
                "provider_id": claim["provider_id"],
                "amount": claim["amount"],
                "status": claim["status"],
                "risk": claim["fraud_risk"],
                "prediction_score": claim["prediction_score"],
                "explanation": claim["explanation"],
                "review_notes": claim.get("review_notes", ""),
                "review_status": claim.get("review_status", ""),
                "patient_name": f"{patient['first_name']} {patient['last_name']}" if patient else "",
                "dob": patient["dob"] if patient else "",
                "insurance_id": patient["insurance_id"] if patient else "",
                "phone_no": patient["phone_no"] if patient else "",
                "address": patient["address"] if patient else ""
            }
        })
    except Exception as e:
        logger.error(f"CLAIM DETAILS ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/save_review", methods=["POST"])
def save_review():
    if "userType" not in session or session["userType"] != "audit":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    try:
        data = request.get_json()
        claim_id = data.get("claim_id")
        review_notes = data.get("review_notes", "")
        review_status = data.get("review_status", "")

        if not claim_id or not review_status:
            return jsonify({"status": "error", "message": "Missing claim_id or review_status"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            UPDATE claims
            SET review_notes = %s,
                review_status = %s
            WHERE claim_id = %s
        """
        cursor.execute(query, (review_notes, review_status, claim_id))
        conn.commit()
        conn.close()

        return jsonify({"status": "success", "message": "Review saved successfully"})
    except Exception as e:
        logger.error(f"SAVE REVIEW ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "GET":
        return render_template("forgot_password.html")

    data = request.get_json()
    email = data.get("email")
    new_password = data.get("new_password")
    user_type = data.get("userType")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        if user_type == "patient":
            query = "UPDATE insurance SET password=%s WHERE email=%s"
        else:
            query = "UPDATE audit SET password=%s WHERE email=%s"
        cursor.execute(query, (new_password, email))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Password updated successfully"})
    except Exception as e:
        logger.error(f"FORGOT PASSWORD ERROR: {str(e)}")
        return jsonify({"status": "error", "message": "Update failed"})

# Provider-specific routes
@app.route("/provider_data")
def provider_data():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""SELECT provider_id, provider_name, email
                       FROM audit WHERE email=%s LIMIT 1""", (session["email"],))
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({"status": "error", "message": "Provider not found"}), 404
        return jsonify({"status": "success", "data": row})
    except Exception as e:
        logger.error(f"PROVIDER_DATA ERROR: {e}")
        return jsonify({"status": "error", "message": "Server error"}), 500

@app.route("/provider_patients")
def provider_patients():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT provider_id FROM audit WHERE email=%s", (session["email"],))
        r = cur.fetchone()
        if not r:
            conn.close()
            return jsonify({"status": "success", "data": []})
        provider_id = r["provider_id"]

        cur.execute("""
            SELECT DISTINCT i.patient_id,
                            CONCAT(i.first_name, ' ', i.last_name) AS name,
                            i.age, i.phone_no AS phone,
                            i.insurance_id,
                            COALESCE(i.address,'') AS address
            FROM claims c
            JOIN insurance i ON i.patient_id = c.patient_id
            WHERE c.provider_id = %s
            ORDER BY name
        """, (provider_id,))
        rows = cur.fetchall()
        conn.close()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        logger.error(f"PROVIDER_PATIENTS ERROR: {e}")
        return jsonify({"status": "error", "message": "Server error"}), 500

@app.route("/provider_claims")
def provider_claims():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT provider_id FROM audit WHERE email=%s", (session["email"],))
        r = cur.fetchone()
        if not r:
            conn.close()
            return jsonify({"status": "success", "data": []})
        provider_id = r["provider_id"]

        cur.execute("""
            SELECT c.claim_id AS id,
                   c.patient_id,
                   CONCAT(i.first_name,' ',i.last_name) AS patient_name,
                   c.claim_type AS type,
                   c.amount,
                   c.status,
                   DATE_FORMAT(c.created_at, '%%Y-%%m-%%d') AS date_submitted,
                   c.fraud_risk,
                   c.prediction_score AS fraud_prob
            FROM claims c
            LEFT JOIN insurance i ON i.patient_id = c.patient_id
            WHERE c.provider_id = %s
            ORDER BY c.claim_id DESC
        """, (provider_id,))
        rows = cur.fetchall()
        conn.close()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        logger.error(f"PROVIDER_CLAIMS ERROR: {e}")
        return jsonify({"status": "error", "message": "Server error"}), 500

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

# ------------------------
# Chatbot API Endpoints
# ------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        message = data.get("message", "").strip()
        session_id = data.get("session_id", "default")
        context = data.get("context", "")

        if not message:
            return jsonify({"success": False, "error": "Message is required"}), 400

        # Add user role context if user is logged in
        if "userType" in session:
            user_role = session["userType"]
            if user_role == "patient":
                enhanced_context = f"{context}\n\nUser Role: Patient - Provide patient-friendly explanations about claims, coverage, and fraud detection results."
            elif user_role == "audit":
                enhanced_context = f"{context}\n\nUser Role: Auditor - Provide detailed fraud analysis and claim review guidance."
            elif user_role == "provider":
                enhanced_context = f"{context}\n\nUser Role: Healthcare Provider - Provide information relevant to claim submission and fraud prevention."
            else:
                enhanced_context = context
        else:
            enhanced_context = context

        result = chatbot.generate_response(message, session_id, enhanced_context)
        return jsonify(result), 200 if result["success"] else 500

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/chat/clear", methods=["POST"])
def clear_chat():
    try:
        data = request.json
        session_id = data.get("session_id", "default")
        success = chatbot.clear_session(session_id)
        return jsonify({
            "success": success,
            "message": "Chat session cleared" if success else "Session not found"
        })
    except Exception as e:
        logger.error(f"Error clearing chat: {str(e)}")
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "sessions": len(chatbot.chat_sessions),
        "chatbot_available": GEMINI_API_KEY is not None
    })

@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    return jsonify({
        "active_sessions": len(chatbot.chat_sessions),
        "session_ids": list(chatbot.chat_sessions.keys())
    })

# Chat UI Route
@app.route("/chat")
def chat_ui():
    return render_template_string("""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Healthcare Assistant Chat</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .chat-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .chat-header { background: #2c5aa0; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .chat-messages { height: 400px; overflow-y: auto; padding: 20px; border-bottom: 1px solid #eee; }
        .message { margin: 10px 0; padding: 10px; border-radius: 8px; }
        .user-message { background: #e3f2fd; text-align: right; }
        .bot-message { background: #f1f8e9; }
        .chat-input { display: flex; padding: 20px; }
        .chat-input input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin-right: 10px; }
        .chat-input button { padding: 12px 20px; background: #2c5aa0; color: white; border: none; border-radius: 6px; cursor: pointer; }
        .chat-input button:hover { background: #1e4080; }
        .loading { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h2>Healthcare Assistant</h2>
            <p>Ask questions about claims, fraud detection, or healthcare processes</p>
        </div>
        <div class="chat-messages" id="chatMessages">
            <div class="message bot-message">
                Hello! I'm your Healthcare Assistant. I can help you with questions about:
                <ul>
                    <li>Insurance claims and fraud detection</li>
                    <li>Understanding risk scores and explanations</li>
                    <li>Healthcare processes and policies</li>
                    <li>System features and navigation</li>
                </ul>
                How can I assist you today?
            </div>
        </div>
        <div class="chat-input">
            <input type="text" id="messageInput" placeholder="Type your message..." />
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        const sessionId = 'session_' + Date.now();
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (!message) return;
            
            addMessage(message, 'user');
            input.value = '';
            
            // Show loading message
            const loadingDiv = addMessage('Thinking...', 'bot', 'loading');
            
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    session_id: sessionId,
                    context: 'Healthcare fraud detection platform user'
                })
            })
            .then(response => response.json())
            .then(data => {
                loadingDiv.remove();
                if (data.success) {
                    addMessage(data.response, 'bot');
                } else {
                    addMessage('Sorry, I encountered an error: ' + data.error, 'bot');
                }
            })
            .catch(error => {
                loadingDiv.remove();
                addMessage('Sorry, I encountered a network error.', 'bot');
                console.error('Error:', error);
            });
        }
        
        function addMessage(text, sender, className = '') {
            const messagesDiv = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}-message ${className}`;
            messageDiv.innerHTML = text.replace(/\n/g, '<br>');
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return messageDiv;
        }
        
        document.getElementById('messageInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
    """)

# Add this test function to your app.py
@app.route("/test_gemini")
def test_gemini():
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content("Hello, this is a test")
        return jsonify({"success": True, "response": response.text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


if __name__ == "__main__":
    app.run(debug=True)
