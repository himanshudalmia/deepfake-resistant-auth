import time
import requests
import json

BASE_URL = "http://localhost:8000"

sample_requests = [
    {
        "request_id": f"req_demo_{int(time.time())}_01",
        "claimed_executive_id": "exec_007",
        "requested_by_staff_id": "staff_042",
        "channel": "video_call",
        "timestamp": "2026-09-03T14:03:00Z",
        "transaction": {
            "type": "wire_transfer",
            "amount": 250000.00,
            "currency": "USD",
            "beneficiary_account": "XXXX-9981",
            "is_new_beneficiary": True
        },
        "session_metadata": {
            "caller_id": "+1-202-555-0179",
            "device_id": "unknown",
            "ip_address": "198.51.100.20",
            "is_recognized_device": False
        },
        "request_transcript": "This is urgent and confidential, I need this wired within the hour, don't loop in anyone else on this."
    },
    {
        "request_id": f"req_demo_{int(time.time())}_02",
        "claimed_executive_id": "exec_007",
        "requested_by_staff_id": "staff_019",
        "channel": "chat",
        "timestamp": "2026-09-03T13:50:00Z",
        "transaction": {
            "type": "wire_transfer",
            "amount": 4500.00,
            "currency": "USD",
            "beneficiary_account": "XXXX-1120",
            "is_new_beneficiary": False
        },
        "session_metadata": {
            "caller_id": "+1-202-555-0112",
            "device_id": "dev_macbook_pro_07",
            "ip_address": "198.51.100.45",
            "is_recognized_device": True
        },
        "request_transcript": "Standard monthly vendor retainer payment for design services."
    },
    {
        "request_id": f"req_demo_{int(time.time())}_03",
        "claimed_executive_id": "exec_003",
        "requested_by_staff_id": "staff_088",
        "channel": "email",
        "timestamp": "2026-09-03T02:15:00Z",
        "transaction": {
            "type": "credential_reset",
            "amount": 0,
            "currency": "USD",
            "beneficiary_account": "N/A",
            "is_new_beneficiary": False
        },
        "session_metadata": {
            "caller_id": "exec003@corp.internal",
            "device_id": "dev_iphone_15",
            "ip_address": "198.51.100.99",
            "is_recognized_device": True
        },
        "request_transcript": "Need root credential reset for emergency server deployment before market open."
    }
]

def run_simulation():
    print(f"--- AEGIS AUTH DEMO REQUEST SIMULATOR ---")
    print(f"Targeting Backend: {BASE_URL}/requests\n")
    
    for i, req in enumerate(sample_requests, 1):
        print(f"[{i}/{len(sample_requests)}] Dispatching {req['request_id']} ({req['transaction']['type']})...")
        try:
            res = requests.post(f"{BASE_URL}/requests", json=req)
            if res.status_code == 200:
                data = res.json()
                print(f"  ✅ SUCCESS: Decision={data.get('decision')}, Risk Score={data.get('risk_score')}, Challenge={data.get('challenge_status')}")
            else:
                print(f"  ❌ ERROR {res.status_code}: {res.text}")
        except Exception as e:
            print(f"  ❌ CONNECTION ERROR: Could not connect to backend at {BASE_URL}. Ensure uvicorn server is running.")
            break
        time.sleep(1.5)

if __name__ == "__main__":
    run_simulation()
