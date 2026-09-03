from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from routers.requests import router as requests_router
from websocket import manager

app = FastAPI(
    title="Deepfake-Resistant Executive Transaction Authorization API",
    description="Backend API for request ingestion, risk decision, and executive verification",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(requests_router)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection open and listen for any incoming messages from client (if needed)
            data = await websocket.receive_text()
            # For this architecture, the server primarily broadcasts to the client
            # But we need to handle receive to detect client disconnects
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"message": "Deepfake-Resistant Auth API is running."}
