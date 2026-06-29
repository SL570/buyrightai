import json
import os
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api", tags=["feedback"])

LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback_log.json")


class FeedbackRequest(BaseModel):
    helpful: bool
    product: str = ""
    verdict: str = ""
    message_preview: str = ""


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "helpful": req.helpful,
        "product": req.product,
        "verdict": req.verdict,
        "message_preview": req.message_preview[:120],
    }
    try:
        data = []
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r") as f:
                data = json.load(f)
        data.append(entry)
        with open(LOG_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass
    return {"ok": True}
