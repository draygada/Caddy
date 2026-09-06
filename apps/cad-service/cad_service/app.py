"""FastAPI transport for the stateless CAD service."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .kernel import CadError, assemble, capabilities, exchange, recompute
from .models import AssemblyRequest, AssemblyResponse, ExchangeRequest, ExchangeResponse, RecomputeRequest, RecomputeResponse


app = FastAPI(title="CADdyDaddy CAD Service", version="0.1.0")


@app.exception_handler(CadError)
async def cad_error_handler(_: Request, exc: CadError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"status": "FAILED", "diagnostics": [exc.diagnostic.model_dump(mode="json")]})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cad-service", "execution": "real-occt"}


@app.get("/v1/capabilities")
def get_capabilities() -> dict:
    return capabilities()


@app.post("/v1/recompute", response_model=RecomputeResponse)
def post_recompute(request: RecomputeRequest) -> RecomputeResponse:
    return recompute(request)


@app.post("/v1/assemblies/solve", response_model=AssemblyResponse)
def post_assembly(request: AssemblyRequest) -> AssemblyResponse:
    return assemble(request)


@app.post("/v1/exchange", response_model=ExchangeResponse)
def post_exchange(request: ExchangeRequest) -> ExchangeResponse:
    return exchange(request)
