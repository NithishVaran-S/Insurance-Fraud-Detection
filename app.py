from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import pymysql

app = Flask(__name__)
app.secret_key = "leckha@10"  # change in production

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
# Basic routes + login (unchanged logic for audit/provider/patient)
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
            query = "SELECT * FROM patient WHERE email=%s AND password=%s LIMIT 1"
        elif user_type == "audit":
            query = "SELECT * FROM audit WHERE email=%s AND password=%s LIMIT 1"
        elif user_type == "provider":
            # provider users stored in audit table (as per your DB)
            query = "SELECT * FROM audit WHERE email=%s AND password=%s LIMIT 1"
        else:
            conn.close()
            return jsonify({"status": "error", "message": "Invalid user type"})

        cursor.execute(query, (email, password))
        result = cursor.fetchone()
        conn.close()

        if result:
            session["email"] = email
            session["userType"] = user_type
            # Keep provider detection same as before
            if user_type == "patient":
                return jsonify({"status": "user_success"})
            elif user_type == "audit":
                return jsonify({"status": "audit_success"})
            elif user_type == "provider":
                return jsonify({"status": "provider_success"})
        else:
            return jsonify({"status": "error", "message": "Invalid credentials"})
    except Exception as e:
        print("LOGIN ERROR:", str(e))
        return jsonify({"status": "error", "message": "Server error"})

# ------------------------
# Other patient endpoints (kept as before)
# ------------------------
@app.route("/otp", methods=["POST"])
def otp_verify():
    if "userType" not in session or session["userType"] != "patient":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    otp = request.get_json().get("otp")
    if otp:
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Invalid OTP"})

@app.route("/user")
def user_dashboard():
    if "userType" in session and session["userType"] == "patient":
        return render_template("user.html")
    return redirect(url_for("home"))

@app.route("/user_data")
def user_data():
    if "email" not in session or session.get("userType") != "patient":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        email = session["email"]
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT patient_id, first_name, last_name, age, gender,
                   phone_no, insurance_id, date_of_birth, email,
                   address, medical_history
            FROM patient
            WHERE email=%s
            LIMIT 1
        """, (email,))
        p = cursor.fetchone()
        conn.close()
        if not p:
            return jsonify({"status": "error", "message": "Patient not found"}), 404

        med_hist = p.get("medical_history") or ""
        if isinstance(med_hist, str):
            if "," in med_hist:
                med_list = [m.strip() for m in med_hist.split(",") if m.strip()]
            elif med_hist.strip() == "":
                med_list = []
            else:
                med_list = [med_hist.strip()]
        elif isinstance(med_hist, (list, tuple)):
            med_list = list(med_hist)
        else:
            med_list = []

        processed = {
            "patient_id": p.get("patient_id"),
            "first_name": p.get("first_name"),
            "last_name": p.get("last_name"),
            "date_of_birth": p.get("date_of_birth"),
            "age": p.get("age"),
            "gender": p.get("gender"),
            "phone_no": p.get("phone_no"),
            "insurance_id": p.get("insurance_id"),
            "address": p.get("address") or "",
            "medical_history": med_list,
            "email": p.get("email")
        }
        return jsonify({"status": "success", "data": [processed]})
    except Exception as e:
        print("USER_DATA ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/user_claims")
def user_claims():
    if "email" not in session or session.get("userType") != "patient":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection(); cursor = conn.cursor()
        cursor.execute("SELECT patient_id FROM patient WHERE email=%s LIMIT 1", (session["email"],))
        patient = cursor.fetchone()
        if not patient:
            conn.close(); return jsonify({"status": "error", "message": "Patient not found"}), 404
        patient_id = patient["patient_id"]
        cursor.execute("""
            SELECT claim_id, provider_id, amount, status, fraud_risk, prediction_score
            FROM claims
            WHERE patient_id = %s
            ORDER BY claim_id DESC
        """, (patient_id,))
        rows = cursor.fetchall(); conn.close()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        print("USER_CLAIMS ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"})

# ------------------------
# Audit endpoints (kept)
# ------------------------
@app.route("/audit")
def audit_dashboard():
    if "userType" in session and session["userType"] == "audit":
        return render_template("audit.html")
    return redirect(url_for("home"))

@app.route("/claims_data")
def claims_data():
    try:
        conn = get_db_connection(); cursor = conn.cursor()
        query = """
        SELECT claim_id, patient_id, provider_id, amount, status,
               fraud_risk, reason, prediction_score, explanation,
               review_notes, review_status
        FROM claims
        ORDER BY claim_id DESC
        LIMIT 50
        """
        cursor.execute(query)
        rows = cursor.fetchall(); conn.close()
        return jsonify({"status": "success", "data": rows})
    except Exception as e:
        print("CLAIMS_FETCH ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/claim_details/<claim_id>")
def claim_details(claim_id):
    if "userType" not in session or session["userType"] != "audit":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection(); cursor = conn.cursor()
        cursor.execute("SELECT * FROM claims WHERE claim_id=%s", (claim_id,))
        claim = cursor.fetchone()
        if not claim:
            conn.close(); return jsonify({"status": "error", "message": "Claim not found"})
        patient_id = claim["patient_id"]
        cursor.execute("""
            SELECT patient_id, first_name, last_name, phone_no, insurance_id, date_of_birth, address, medical_history
            FROM patient WHERE patient_id=%s LIMIT 1
        """, (patient_id,))
        patient = cursor.fetchone(); conn.close()

        med_hist = []
        if patient and patient.get("medical_history"):
            mh = patient.get("medical_history")
            if isinstance(mh, str):
                med_hist = [m.strip() for m in mh.split(",")] if "," in mh else ([mh.strip()] if mh.strip() else [])
            elif isinstance(mh, (list, tuple)):
                med_hist = list(mh)

        return jsonify({
            "status": "success",
            "data": {
                "claim_id": claim.get("claim_id"),
                "patient_id": claim.get("patient_id"),
                "provider_id": claim.get("provider_id"),
                "amount": claim.get("amount"),
                "status": claim.get("status"),
                "risk": claim.get("fraud_risk"),
                "prediction_score": claim.get("prediction_score"),
                "explanation": claim.get("explanation"),
                "review_notes": claim.get("review_notes", ""),
                "review_status": claim.get("review_status", ""),
                "patient_name": f"{patient['first_name']} {patient['last_name']}" if patient else "",
                "date_of_birth": patient.get("date_of_birth") if patient else "",
                "insurance_id": (patient.get("insurance_id") if patient else ""),
                "phone_no": patient.get("phone_no") if patient else "",
                "address": patient.get("address") if patient else "",
                "medical_history": med_hist
            }
        })
    except Exception as e:
        print("CLAIM_DETAILS ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"})

# ------------------------
# Provider-related helpers (ADDED/UPDATED)
# ------------------------
def _extract_claim_ids_from_provider_row(row):
    if not row:
        return None
    preferred = ["claim_ids","claims","claims_list","claims_ids","provider_claims","claims_csv"]
    for k in preferred:
        if k in row and row.get(k):
            raw = row.get(k)
            if isinstance(raw, (list, tuple)):
                return [str(x).strip() for x in raw if str(x).strip()]
            if isinstance(raw, str):
                return [c.strip() for c in raw.split(",") if c.strip()]
    for k, v in row.items():
        if isinstance(v, str) and "," in v:
            toks = [t.strip() for t in v.split(",") if t.strip()]
            if toks:
                return toks
    return None

def _normalize_medical_history(mh):
    if not mh:
        return ""
    if isinstance(mh, str):
        if "," in mh:
            return ", ".join([x.strip() for x in mh.split(",") if x.strip()])
        return mh.strip()
    if isinstance(mh, (list, tuple)):
        return ", ".join([str(x).strip() for x in mh if str(x).strip()])
    return str(mh)

# ------------------------
# Provider pages & APIs (UPDATED PER YOUR REQUEST)
# ------------------------
@app.route("/provider")
def provider_dashboard():
    if "userType" in session and session["userType"] == "provider":
        return render_template("provider.html")
    return redirect(url_for("home"))

@app.route("/provider_data")
def provider_data():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection(); cur = conn.cursor()
        # audit table may not have provider_name — select only provider_id + email
        cur.execute("SELECT provider_id, email FROM audit WHERE email=%s LIMIT 1", (session["email"],))
        aud = cur.fetchone()
        provider_row = None
        provider_id = aud.get("provider_id") if aud else None
        if provider_id:
            # attempt to read provider table (may have other metadata)
            cur.execute("SELECT * FROM provider WHERE provider_id=%s LIMIT 1", (provider_id,))
            provider_row = cur.fetchone()
        conn.close()
        out = {}
        if aud:
            out.update(aud)
        if provider_row:
            out.update(provider_row)
        # provider_name might not exist; fallback to email or provider_id
        if "provider_name" not in out:
            out["provider_name"] = out.get("email") or f"Provider {out.get('provider_id','')}"
        return jsonify({"status": "success", "data": out})
    except Exception as e:
        print("PROVIDER_DATA ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"}, 500)

        return jsonify({"status": "error", "message": "Server error"}, 500)

# ------------------------
# Helper to try finding missing fields from other patient rows
# ------------------------
def _find_fallback_for_patient(cur, patient):
    """
    Given a DB cursor and a patient dict (has keys patient_id, insurance_id, phone_no, first_name, last_name),
    try to find another patient row that contains non-empty address or medical_history.
    Returns a dict with possibly 'address' and 'medical_history' filled (address=str, medical_history=list).
    """
    fallback = {"address": "", "medical_history": []}
    pid = patient.get("patient_id")
    ins = patient.get("insurance_id") or ""
    phone = patient.get("phone_no") or patient.get("phone") or ""
    fname = (patient.get("first_name") or "").strip()
    lname = (patient.get("last_name") or "").strip()

    # 1) Try by insurance_id (excluding same patient_id)
    if ins:
        cur.execute("""
            SELECT patient_id, COALESCE(address,'') AS address, COALESCE(medical_history,'') AS medical_history
            FROM patient
            WHERE insurance_id=%s AND COALESCE(address,'')<>'' OR (insurance_id=%s AND COALESCE(medical_history,'')<>'')
            LIMIT 5
        """, (ins, ins))
        rows = cur.fetchall()
        for r in rows:
            if r.get("patient_id") == pid:
                continue
            if not fallback["address"] and r.get("address"):
                fallback["address"] = r.get("address") or ""
            if not fallback["medical_history"] and r.get("medical_history"):
                raw = r.get("medical_history") or ""
                if isinstance(raw, str):
                    if "," in raw:
                        fallback["medical_history"] = [m.strip() for m in raw.split(",") if m.strip()]
                    else:
                        fallback["medical_history"] = [raw.strip()] if raw.strip() else []
                elif isinstance(raw, (list, tuple)):
                    fallback["medical_history"] = list(raw)
            if fallback["address"] and fallback["medical_history"]:
                return fallback

    # 2) Try by phone_no
    if phone:
        cur.execute("""
            SELECT patient_id, COALESCE(address,'') AS address, COALESCE(medical_history,'') AS medical_history
            FROM patient
            WHERE phone_no=%s AND COALESCE(address,'')<>'' OR (phone_no=%s AND COALESCE(medical_history,'')<>'')
            LIMIT 5
        """, (phone, phone))
        rows = cur.fetchall()
        for r in rows:
            if r.get("patient_id") == pid:
                continue
            if not fallback["address"] and r.get("address"):
                fallback["address"] = r.get("address") or ""
            if not fallback["medical_history"] and r.get("medical_history"):
                raw = r.get("medical_history") or ""
                if isinstance(raw, str):
                    if "," in raw:
                        fallback["medical_history"] = [m.strip() for m in raw.split(",") if m.strip()]
                    else:
                        fallback["medical_history"] = [raw.strip()] if raw.strip() else []
                elif isinstance(raw, (list, tuple)):
                    fallback["medical_history"] = list(raw)
            if fallback["address"] and fallback["medical_history"]:
                return fallback

    # 3) Try by name (first + last)
    if fname or lname:
        cur.execute("""
            SELECT patient_id, COALESCE(address,'') AS address, COALESCE(medical_history,'') AS medical_history
            FROM patient
            WHERE (first_name=%s OR last_name=%s OR (first_name=%s AND last_name=%s))
            LIMIT 10
        """, (fname, lname, fname, lname))
        rows = cur.fetchall()
        for r in rows:
            if r.get("patient_id") == pid:
                continue
            if not fallback["address"] and r.get("address"):
                fallback["address"] = r.get("address") or ""
            if not fallback["medical_history"] and r.get("medical_history"):
                raw = r.get("medical_history") or ""
                if isinstance(raw, str):
                    if "," in raw:
                        fallback["medical_history"] = [m.strip() for m in raw.split(",") if m.strip()]
                    else:
                        fallback["medical_history"] = [raw.strip()] if raw.strip() else []
                elif isinstance(raw, (list, tuple)):
                    fallback["medical_history"] = list(raw)
            if fallback["address"] and fallback["medical_history"]:
                return fallback

    return fallback


# ------------------------
# Updated provider_patients route (uses provider.patient_ids CSV OR fallback via claims)
# ------------------------
@app.route("/provider_patients")
def provider_patients():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1) get provider_id from audit table
        cur.execute("SELECT provider_id FROM audit WHERE email=%s LIMIT 1", (session["email"],))
        r = cur.fetchone()
        if not r:
            conn.close()
            return jsonify({"status": "success", "data": []})
        provider_id = r.get("provider_id")

        patients_list = []

        # 2) try provider.patient_ids CSV first (preferred)
        cur.execute("SELECT COALESCE(patient_ids,'') AS patient_ids FROM provider WHERE provider_id=%s LIMIT 1", (provider_id,))
        prow = cur.fetchone()
        if prow and prow.get("patient_ids"):
            ids = [pid.strip() for pid in prow["patient_ids"].split(",") if pid.strip()]
            for pid in ids:
                cur.execute("""
                    SELECT patient_id, first_name, last_name, age, phone_no, insurance_id,
                           COALESCE(address,'') AS address,
                           COALESCE(medical_history,'') AS medical_history
                    FROM patient
                    WHERE patient_id=%s LIMIT 1
                """, (pid,))
                p = cur.fetchone()
                if not p:
                    # log and continue
                    print(f"[provider_patients] patient_id not found: {pid}")
                    continue

                # normalize med history to list
                mh_raw = p.get("medical_history") or ""
                if isinstance(mh_raw, str):
                    if "," in mh_raw:
                        mh_list = [m.strip() for m in mh_raw.split(",") if m.strip()]
                    elif mh_raw.strip() == "":
                        mh_list = []
                    else:
                        mh_list = [mh_raw.strip()]
                elif isinstance(mh_raw, (list, tuple)):
                    mh_list = list(mh_raw)
                else:
                    mh_list = []

                # If address or medical_history empty, try fallbacks
                address_val = (p.get("address") or "").strip()
                if (not address_val) or (not mh_list):
                    fb = _find_fallback_for_patient(cur, p)
                    if not address_val and fb.get("address"):
                        address_val = fb.get("address")
                    if (not mh_list) and fb.get("medical_history"):
                        mh_list = fb.get("medical_history")

                patients_list.append({
                    "patient_id": p.get("patient_id"),
                    "patient_name": f"{(p.get('first_name') or '').strip()} {(p.get('last_name') or '').strip()}".strip(),
                    "age": p.get("age"),
                    "phone": p.get("phone_no"),
                    "insurance_id": p.get("insurance_id"),
                    "address": address_val,
                    "medical_history": mh_list
                })

            conn.close()
            return jsonify({"status": "success", "data": patients_list})

        # 3) fallback: select distinct patients by claims -> provider_id
        cur.execute("""
            SELECT DISTINCT p.patient_id, p.first_name, p.last_name, p.age, p.phone_no, p.insurance_id,
                   COALESCE(p.address,'') AS address,
                   COALESCE(p.medical_history,'') AS medical_history
            FROM claims c
            JOIN patient p ON p.patient_id = c.patient_id
            WHERE c.provider_id = %s
            ORDER BY p.first_name, p.last_name
        """, (provider_id,))
        rows = cur.fetchall()
        for p in rows:
            mh_raw = p.get("medical_history") or ""
            if isinstance(mh_raw, str):
                if "," in mh_raw:
                    mh_list = [m.strip() for m in mh_raw.split(",") if m.strip()]
                elif mh_raw.strip() == "":
                    mh_list = []
                else:
                    mh_list = [mh_raw.strip()]
            elif isinstance(mh_raw, (list, tuple)):
                mh_list = list(mh_raw)
            else:
                mh_list = []

            address_val = (p.get("address") or "").strip()
            if (not address_val) or (not mh_list):
                fb = _find_fallback_for_patient(cur, p)
                if not address_val and fb.get("address"):
                    address_val = fb.get("address")
                if (not mh_list) and fb.get("medical_history"):
                    mh_list = fb.get("medical_history")

            patients_list.append({
                "patient_id": p.get("patient_id"),
                "patient_name": f"{(p.get('first_name') or '').strip()} {(p.get('last_name') or '').strip()}".strip(),
                "age": p.get("age"),
                "phone": p.get("phone_no"),
                "insurance_id": p.get("insurance_id"),
                "address": address_val,
                "medical_history": mh_list
            })

        conn.close()
        return jsonify({"status": "success", "data": patients_list})

    except Exception as e:
        print("PROVIDER_PATIENTS ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"}, 500)


@app.route("/provider_claims")
def provider_claims():
    if "email" not in session or session.get("userType") != "provider":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        conn = get_db_connection(); cur = conn.cursor()
        # get provider_id
        cur.execute("SELECT provider_id FROM audit WHERE email=%s LIMIT 1", (session["email"],))
        r = cur.fetchone()
        if not r:
            conn.close(); return jsonify({"status": "success", "data": [], "claim_count": 0})
        provider_id = r.get("provider_id")

        # fetch claims for this provider
        cur.execute("""
            SELECT c.claim_id, c.patient_id,
                   CONCAT(p.first_name,' ',p.last_name) AS patient_name,
                   c.amount, c.status
            FROM claims c
            LEFT JOIN patient p ON p.patient_id = c.patient_id
            WHERE c.provider_id = %s
            ORDER BY c.claim_id DESC
        """, (provider_id,))
        rows = cur.fetchall(); conn.close()
        return jsonify({"status": "success", "data": rows, "claim_count": len(rows)})
    except Exception as e:
        print("PROVIDER_CLAIMS ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"}, 500)

# ------------------------
# Save review / Forgot password / logout (unchanged)
# ------------------------
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
        conn = get_db_connection(); cursor = conn.cursor()
        query = "UPDATE claims SET review_notes=%s, review_status=%s WHERE claim_id=%s"
        cursor.execute(query, (review_notes, review_status, claim_id))
        conn.commit(); conn.close()
        return jsonify({"status": "success", "message": "Review saved successfully"})
    except Exception as e:
        print("SAVE_REVIEW ERROR:", e)
        return jsonify({"status": "error", "message": "Server error"})

@app.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "GET":
        return render_template("forgot_password.html")
    data = request.get_json(); email = data.get("email"); new_password = data.get("new_password"); user_type = data.get("userType")
    try:
        conn = get_db_connection(); cursor = conn.cursor()
        if user_type == "patient":
            query = "UPDATE patient SET password=%s WHERE email=%s"
        else:
            query = "UPDATE audit SET password=%s WHERE email=%s"
        cursor.execute(query, (new_password, email))
        conn.commit(); conn.close()
        return jsonify({"status": "success", "message": "Password updated successfully"})
    except Exception as e:
        print("FORGOT_PASSWORD ERROR:", e)
        return jsonify({"status": "error", "message": "Update failed"})

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


# ------------------------
# Run
# ------------------------
if __name__ == "__main__":
    app.run(debug=True)

