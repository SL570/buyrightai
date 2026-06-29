from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.claude_service import stream_response

router = APIRouter(prefix="/api", tags=["chat"])


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    feature: str = "general"
    message: str
    history: list[Message] = []


@router.post("/chat")
async def chat(req: ChatRequest):
    history = [{"role": m.role, "content": m.content} for m in req.history]

    def generate():
        try:
            for chunk in stream_response(req.feature, req.message, history):
                yield chunk
        except Exception as e:
            yield f"\n\n[Error: {e}]"

    return StreamingResponse(generate(), media_type="text/plain", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
