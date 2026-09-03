from fastapi import WebSocket
from typing import List
import json
from models import RiskDecisionEvent

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_decision(self, decision_event: RiskDecisionEvent):
        payload = decision_event.model_dump_json()
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                # Connection might be closed or broken
                disconnected_clients.append(connection)
        
        for connection in disconnected_clients:
            self.disconnect(connection)

manager = ConnectionManager()
