"""
Unit tests and verification for Person A's analyze_request pressure scorer.
"""

import sys
import os

# Add parent directory to sys.path so ml can be imported directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.scorer import analyze_request


def test_contract_sample_request():
    """Test using the exact sample request from Section 1 of contracts.md."""
    sample_request = {
        "request_id": "req_20260903_0001",
        "claimed_executive_id": "exec_007",
        "requested_by_staff_id": "staff_042",
        "channel": "video_call",
        "timestamp": "2026-09-03T14:03:00Z",
        "transaction": {
            "type": "wire_transfer",
            "amount": 250000.00,
            "currency": "USD",
            "beneficiary_account": "XXXX-9981",
            "is_new_beneficiary": True,
        },
        "session_metadata": {
            "caller_id": "+1-202-555-0179",
            "device_id": "unknown",
            "ip_address": "198.51.100.20",
            "is_recognized_device": False,
        },
        "request_transcript": "This is urgent and confidential, I need this wired within the hour, don't loop in anyone else on this.",
    }

    result = analyze_request(sample_request)
    print("\n--- Test 1: Contract Sample Request ---")
    print("Transcript:", sample_request["request_transcript"])
    print("Result:", result)

    assert "pressure_score" in result
    assert "signals" in result
    assert isinstance(result["pressure_score"], float)
    assert 0.70 <= result["pressure_score"] <= 1.0, f"Expected high pressure score, got {result['pressure_score']}"

    # Verify signals detected
    signals_by_name = {s["signal"]: s for s in result["signals"]}
    assert signals_by_name["urgency_language"]["value"] is True
    assert signals_by_name["secrecy_language"]["value"] is True
    assert signals_by_name["deadline_pressure"]["value"] is True
    print("Test 1 Passed: High-pressure attack transcript correctly identified.")


def test_benign_request():
    """Test a routine, non-urgent executive transaction request."""
    benign_request = {
        "request_id": "req_20260903_0002",
        "claimed_executive_id": "exec_002",
        "requested_by_staff_id": "staff_015",
        "channel": "email",
        "timestamp": "2026-09-03T10:00:00Z",
        "transaction": {
            "type": "wire_transfer",
            "amount": 1200.00,
            "currency": "USD",
            "beneficiary_account": "ACC-5421",
            "is_new_beneficiary": False,
        },
        "session_metadata": {
            "caller_id": "+1-202-555-0100",
            "device_id": "dev_corporate_mac",
            "ip_address": "10.0.1.15",
            "is_recognized_device": True,
        },
        "request_transcript": "Good morning, please process the standard recurring quarterly subscription invoice for CloudServices when time permits this week. Thank you.",
    }

    result = analyze_request(benign_request)
    print("\n--- Test 2: Benign Routine Request ---")
    print("Transcript:", benign_request["request_transcript"])
    print("Result:", result)

    assert result["pressure_score"] <= 0.15, f"Expected low pressure score for benign request, got {result['pressure_score']}"
    for s in result["signals"]:
        assert s["value"] is False, f"Signal {s['signal']} should be False"
    print("Test 2 Passed: Benign request produces 0.0 pressure score.")


def test_channel_switch_and_authority():
    """Test authority invocation and off-channel communication request."""
    vishing_request = {
        "request_id": "req_20260903_0003",
        "request_transcript": "Per CEO and board of directors direct orders, switch to my personal WhatsApp immediately to complete the executive wire transfer.",
    }

    result = analyze_request(vishing_request)
    print("\n--- Test 3: Authority & Channel Switch Request ---")
    print("Transcript:", vishing_request["request_transcript"])
    print("Result:", result)

    signals_by_name = {s["signal"]: s for s in result["signals"]}
    assert signals_by_name["authority_invocation"]["value"] is True
    assert signals_by_name["channel_switch_request"]["value"] is True
    assert signals_by_name["urgency_language"]["value"] is True
    assert result["pressure_score"] >= 0.70
    print("Test 3 Passed: Authority + Channel switch accurately triggered.")


def test_edge_cases():
    """Test edge cases such as empty transcript and missing parameters."""
    print("\n--- Test 4: Edge Cases ---")
    empty_result = analyze_request({"request_transcript": ""})
    assert empty_result["pressure_score"] == 0.0
    assert len(empty_result["signals"]) == 5

    none_result = analyze_request({})
    assert none_result["pressure_score"] == 0.0

    invalid_result = analyze_request("not a dict")
    assert invalid_result["pressure_score"] == 0.0
    print("Test 4 Passed: Handled edge cases safely without errors.")


if __name__ == "__main__":
    print("Running Person A Pressure-Signal Scorer test suite...")
    test_contract_sample_request()
    test_benign_request()
    test_channel_switch_and_authority()
    test_edge_cases()
    print("\nAll tests passed successfully!")
