from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Literal, Optional

# Section 1: Request Ingestion Payload
class TransactionModel(BaseModel):
    type: Literal["wire_transfer", "credential_reset", "beneficiary_change"]
    amount: float
    currency: str
    beneficiary_account: str
    is_new_beneficiary: bool

class SessionMetadataModel(BaseModel):
    caller_id: str
    device_id: str
    ip_address: str
    is_recognized_device: bool

class AuthorizationRequest(BaseModel):
    request_id: str
    claimed_executive_id: str
    requested_by_staff_id: str
    channel: Literal["phone_call", "video_call", "chat", "email"]
    timestamp: datetime
    transaction: TransactionModel
    session_metadata: SessionMetadataModel
    request_transcript: str

# Section 2 & 3: Pressure Signals
class PressureSignal(BaseModel):
    signal: str
    value: bool
    contribution: float

# Section 3: Risk Decision / WebSocket Event
class RiskDecisionEvent(BaseModel):
    request_id: str
    risk_score: float
    decision: Literal["auto_approve", "step_up_verification", "block_pending_verification", "blocked"]
    triggered_rules: List[str]
    pressure_score: float
    pressure_signals: List[PressureSignal]
    challenge_status: Literal["not_required", "sent", "approved", "denied", "expired"]
    timestamp: datetime

# Section 4: Executive Response Payload
class ExecutiveResponse(BaseModel):
    request_id: str
    challenge_code: str
    response: Literal["approved", "denied"]
    responded_at: datetime

# Section 5: Aggregate KPIs Payload
class AggregateKPIs(BaseModel):
    total_requests: int
    attack_block_rate: float
    legitimate_approval_success_rate: float
    false_challenge_rate: float
    avg_verification_time_seconds: int
    prevented_fraudulent_value: float
