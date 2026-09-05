"""FastAPI skeleton. Signing, the fetch allowlist, kicad-cli and the API proxy live here."""
from fastapi import FastAPI
app = FastAPI(title="Tripwire")

@app.get("/health")
def health(): return {"ok": True}

@app.post("/evaluate")
def post_evaluate(payload: dict): return {"determinations": {}, "stub": True}
