from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict
from datetime import datetime, timezone
import random

from models import (
    AuthorizationRequest,
    RiskDecisionEvent,
    ExecutiveResponse,
    AggregateKPIs,
    PressureSignal
)
from websocket import manager

router = APIRouter()

# In-memory storage for demonstration/mocking
db_requests: Dict[str, AuthorizationRequest] = {}
db_decisions: Dict[str, RiskDecisionEvent] = {}
db_challenges: Dict[str, str] = {} # request_id -> challenge_code

# Mock stats
mock_stats = AggregateKPIs(
    total_requests=214,
    attack_block_rate=0.94,
    legitimate_approval_success_rate=0.98,
    false_challenge_rate=0.06,
    avg_verification_time_seconds=42,
    prevented_fraudulent_value=1850000.00
)

from ml.scorer import analyze_request

def evaluate_rules(request: AuthorizationRequest, pressure_score: float) -> List[str]:
    triggered_rules = []
    
    if request.transaction.is_new_beneficiary and request.transaction.amount > 50000:
        triggered_rules.append("new_beneficiary_high_amount")
        
    if not request.session_metadata.is_recognized_device:
        triggered_rules.append("unrecognized_device")
        
    # Check off-hours (e.g., weekend or night time UTC for simplicity)
    hour = request.timestamp.hour
    if hour < 6 or hour > 20:
        triggered_rules.append("off_hours_request")
        
    if pressure_score > 0.6:
        triggered_rules.append("high_pressure_language")
        
    return triggered_rules

async def broadcast_decision_async(decision: RiskDecisionEvent):
    await manager.broadcast_decision(decision)

@router.post("/requests", response_model=RiskDecisionEvent)
async def create_request(request: AuthorizationRequest, background_tasks: BackgroundTasks):
    db_requests[request.request_id] = request
    
    # 1. Run ML Scorer
    analysis = analyze_request(request.model_dump())
    pressure_score = analysis["pressure_score"]
    pressure_signals = [PressureSignal(**s) for s in analysis["signals"]]
    
    # 2. Evaluate Rules
    triggered_rules = evaluate_rules(request, pressure_score)
    
    # 3. Determine Decision and Challenge Status
    # Simple logic based on rules and pressure
    risk_score = min(1.0, (len(triggered_rules) * 0.2) + (pressure_score * 0.5))
    
    decision = "auto_approve"
    challenge_status = "not_required"
    
    if risk_score > 0.8 or "new_beneficiary_high_amount" in triggered_rules:
        decision = "block_pending_verification"
        challenge_status = "sent"
    elif risk_score > 0.4 or "unrecognized_device" in triggered_rules:
        decision = "step_up_verification"
        challenge_status = "sent"
        
    if risk_score >= 0.95:
        # Extreme risk could just be blocked
        decision = "blocked"
        challenge_status = "not_required"
        
    # 4. Generate Challenge Code if needed
    if challenge_status == "sent":
        db_challenges[request.request_id] = "482913" # Static for demo matching contract, or random
        # In a real app we might use: str(random.randint(100000, 999999))
    
    decision_event = RiskDecisionEvent(
        request_id=request.request_id,
        risk_score=risk_score,
        decision=decision,
        triggered_rules=triggered_rules,
        pressure_score=pressure_score,
        pressure_signals=pressure_signals,
        challenge_status=challenge_status,
        timestamp=datetime.now(timezone.utc)
    )
    
    db_decisions[request.request_id] = decision_event
    
    # Update Stats
    mock_stats.total_requests += 1
    
    # Broadcast to WebSocket via Background Task to not block response
    background_tasks.add_task(broadcast_decision_async, decision_event)
    
    return decision_event

@router.post("/requests/{request_id}/respond", response_model=RiskDecisionEvent)
async def respond_to_challenge(request_id: str, response: ExecutiveResponse, background_tasks: BackgroundTasks):
    if request_id not in db_decisions:
        raise HTTPException(status_code=404, detail="Request ID not found")
        
    decision_event = db_decisions[request_id]
    
    if decision_event.challenge_status != "sent":
        raise HTTPException(status_code=400, detail="Challenge is not currently pending")
        
    expected_code = db_challenges.get(request_id)
    if not expected_code or expected_code != response.challenge_code:
        raise HTTPException(status_code=401, detail="Invalid challenge code")
        
    # Update status based on response
    if response.response == "approved":
        decision_event.challenge_status = "approved"
        # If it was blocking pending verification, now it's approved
        if decision_event.decision in ["block_pending_verification", "step_up_verification"]:
            decision_event.decision = "auto_approve" # Or some terminal approved state
    else:
        decision_event.challenge_status = "denied"
        decision_event.decision = "blocked"
        
    decision_event.timestamp = datetime.now(timezone.utc)
    db_decisions[request_id] = decision_event
    
    # Clean up challenge code
    db_challenges.pop(request_id, None)
    
    # Update stats slightly for dynamic feeling
    if response.response == "denied":
        mock_stats.prevented_fraudulent_value += db_requests[request_id].transaction.amount
        
    # Broadcast updated decision
    background_tasks.add_task(broadcast_decision_async, decision_event)
    
    return decision_event

@router.get("/history", response_model=List[RiskDecisionEvent])
async def get_history(limit: int = 50):
    # Return recent decisions, sorted by timestamp descending
    decisions = list(db_decisions.values())
    decisions.sort(key=lambda x: x.timestamp, reverse=True)
    return decisions[:limit]

@router.get("/stats", response_model=AggregateKPIs)
async def get_stats():
    return mock_stats
