# Contracts — Deepfake-Resistant Executive Transaction Authorization

**Frozen once all three of you agree.** Any change gets announced to the team before anyone edits code against it.

Ownership:
- **Person A (ML/Signals)** owns internals of `analyze_request()` — shape below is fixed.
- **Person B (Backend)** owns sections 1, 3, 4, 5 — request ingestion, decision engine, challenge flow.
- **Person C (Frontend)** consumes sections 3 and 5 (dashboard), and drives section 4 from the mock exec-device screen.

---

## 1. Authorization request — `POST /requests`

```json
{
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
    "is_new_beneficiary": true
  },
  "session_metadata": {
    "caller_id": "+1-202-555-0179",
    "device_id": "unknown",
    "ip_address": "198.51.100.20",
    "is_recognized_device": false
  },
  "request_transcript": "This is urgent and confidential, I need this wired within the hour, don't loop in anyone else on this."
}
```

**Field notes:**
- `channel`: one of `phone_call | video_call | chat | email`
- `transaction.type`: one of `wire_transfer | credential_reset | beneficiary_change`
- `request_transcript`: plain text — the staff member's note or a call/meeting transcript snippet. This is what Person A's scorer reads.

---

## 2. Pressure-signal scorer — Person A's `analyze_request()`

```python
def analyze_request(request: dict) -> dict:
    """
    Input: full request dict from section 1.
    Output:
    {
      "pressure_score": 0.88,
      "signals": [
        {"signal": "urgency_language", "value": true, "contribution": 0.30},
        {"signal": "secrecy_language", "value": true, "contribution": 0.35},
        {"signal": "authority_invocation", "value": true, "contribution": 0.20}
      ]
    }
    """
```
- `pressure_score`: float 0–1.
- `signals`: known signal names — `urgency_language`, `secrecy_language`, `authority_invocation`, `deadline_pressure`, `channel_switch_request`. Add new ones only after updating this doc.

---

## 3. Risk decision — computed by Person B, returned from `POST /requests`, broadcast on `/ws`

```json
{
  "request_id": "req_20260903_0001",
  "risk_score": 0.91,
  "decision": "block_pending_verification",
  "triggered_rules": ["new_beneficiary_high_amount", "unrecognized_device"],
  "pressure_score": 0.88,
  "pressure_signals": [
    {"signal": "urgency_language", "value": true, "contribution": 0.30}
  ],
  "challenge_status": "sent",
  "timestamp": "2026-09-03T14:03:01.200Z"
}
```

**`decision` values:**
| decision | meaning |
|---|---|
| `auto_approve` | low risk, no challenge needed |
| `step_up_verification` | moderate risk, challenge sent, transaction proceeds only on approval |
| `block_pending_verification` | high risk, challenge sent, defaults to blocked if no response |
| `blocked` | hard rule fired or challenge was denied/expired |

**Known rule identifiers** (`triggered_rules`): `new_beneficiary_high_amount`, `unrecognized_device`, `off_hours_request`, `high_pressure_language`

**`challenge_status` values:** `not_required | sent | approved | denied | expired`

---

## 4. Executive response — `POST /requests/{request_id}/respond` (called from the mock exec-device screen)

```json
{
  "request_id": "req_20260903_0001",
  "challenge_code": "482913",
  "response": "approved",
  "responded_at": "2026-09-03T14:04:12Z"
}
```
- `response`: `approved | denied`
- Backend validates `challenge_code` matches what it generated, then re-broadcasts the updated section-3 event with `decision` and `challenge_status` updated accordingly.

---

## 5. Aggregate KPIs — `GET /stats` (polled by dashboard, not WebSocket)

Pulled directly from the problem statement's stated success metrics.

```json
{
  "total_requests": 214,
  "attack_block_rate": 0.94,
  "legitimate_approval_success_rate": 0.98,
  "false_challenge_rate": 0.06,
  "avg_verification_time_seconds": 42,
  "prevented_fraudulent_value": 1850000.00
}
```

---

## Transport notes

- Ingestion: `POST /requests` (section 1 in, section 3 out).
- Executive approval: `POST /requests/{id}/respond` (section 4 in, updated section 3 broadcast out).
- Live feed: WebSocket `/ws` — pushes section-3 events on both initial decision and challenge resolution (two events per high-risk request; one event for auto-approved ones).
- History: `GET /history?limit=50`.
- KPIs: `GET /stats`, polled every few seconds by the dashboard.
