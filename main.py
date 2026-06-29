import json
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from routers.chat import router as chat_router
from routers.feedback import router as feedback_router

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

app = FastAPI(title="BuyRight AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(feedback_router)


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response


app.mount("/static", NoCacheStaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    return FileResponse(
        "frontend/index.html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


@app.get("/analytics")
async def analytics(key: str = ""):
    if key != "buyrightai2026":
        return HTMLResponse("<h3 style='font-family:system-ui;padding:40px'>Unauthorized</h3>", status_code=401)

    log_file = Path(__file__).parent / "feedback_log.json"
    data = []
    if log_file.exists():
        with open(log_file) as f:
            data = json.load(f)

    total     = len(data)
    helpful   = sum(1 for d in data if d.get("helpful"))
    pct       = round(helpful / total * 100) if total else 0
    products  = {}
    verdicts  = {}
    for d in data:
        p = d.get("product", "")
        v = d.get("verdict", "")
        if p: products[p] = products.get(p, 0) + 1
        if v: verdicts[v] = verdicts.get(v, 0) + 1

    top_products = sorted(products.items(), key=lambda x: -x[1])[:15]
    product_rows = "".join(f"<tr><td>{p}</td><td>{c}</td></tr>" for p, c in top_products)
    verdict_rows = "".join(f"<tr><td style='text-transform:capitalize'>{v}</td><td>{c}</td></tr>" for v, c in verdicts.items())

    html = f"""<!DOCTYPE html>
<html><head><title>BuyRight Analytics</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; background: #0B0F19; color: #F1F5F9; padding: 40px; margin: 0; }}
  h1 {{ color: #00F5D4; font-size: 22px; margin-bottom: 4px; }}
  .sub {{ color: #94A3B8; font-size: 13px; margin-bottom: 32px; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }}
  .card {{ background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; }}
  .num {{ font-size: 36px; font-weight: 700; color: #00F5D4; }}
  .lbl {{ font-size: 12px; color: #94A3B8; margin-top: 4px; }}
  h2 {{ font-size: 15px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; }}
  table {{ width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; }}
  th {{ text-align: left; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; border-bottom: 1px solid rgba(255,255,255,0.08); }}
  td {{ padding: 10px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); }}
  .two-col {{ display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }}
</style></head>
<body>
<h1>BuyRight AI — Analytics</h1>
<p class="sub">Last updated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}</p>

<div class="grid">
  <div class="card"><div class="num">{total}</div><div class="lbl">Total feedback responses</div></div>
  <div class="card"><div class="num">{helpful}</div><div class="lbl">Marked helpful</div></div>
  <div class="card"><div class="num">{pct}%</div><div class="lbl">Helpfulness rate</div></div>
</div>

<div class="two-col">
  <div>
    <h2>Top products asked about</h2>
    <table><tr><th>Product</th><th>Times</th></tr>{product_rows if product_rows else '<tr><td colspan="2" style="color:#94A3B8">No data yet</td></tr>'}</table>
  </div>
  <div>
    <h2>Verdict distribution</h2>
    <table><tr><th>Verdict</th><th>Count</th></tr>{verdict_rows if verdict_rows else '<tr><td colspan="2" style="color:#94A3B8">No data yet</td></tr>'}</table>
  </div>
</div>
</body></html>"""
    return HTMLResponse(html)
