"""FastAPI transport for the stateless CAD service."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .errors import CadError
from .executor import NativeExecutor
from .models import AssemblyRequest, AssemblyResponse, ExchangeRequest, ExchangeResponse, RecomputeRequest, RecomputeResponse
from .settings import DeploymentSettings


def create_app(
    settings: DeploymentSettings | None = None,
    executor: NativeExecutor | None = None,
) -> FastAPI:
    settings = settings or DeploymentSettings.from_env()
    executor = executor or NativeExecutor(settings)
    application = FastAPI(
        title="CADdyDaddy CAD Service",
        version="0.2.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))
    if settings.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type", "X-Request-ID"],
            expose_headers=["X-CADdyDaddy-Payload-Limit"],
            max_age=600,
        )

    @application.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; sandbox"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @application.exception_handler(CadError)
    async def cad_error_handler(_: Request, exc: CadError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "schema_version": "caddydaddy.cad-runtime-status/1",
                "status": "BLOCKED" if exc.status_code == 503 else "FAILED",
                "diagnostic": exc.diagnostic.model_dump(mode="json", exclude_none=True),
                "diagnostics": [exc.diagnostic.model_dump(mode="json", exclude_none=True)],
            },
        )

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "cad-service", "execution": "native-runtime-gated"}

    @application.get("/ready")
    def ready():
        try:
            proof = executor.readiness()
        except CadError as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "schema_version": "caddydaddy.cad-runtime-status/1",
                    "status": "BLOCKED",
                    "service": "cad-service",
                    "diagnostic": exc.diagnostic.model_dump(mode="json", exclude_none=True),
                },
            )
        return {
            "status": "ready",
            "service": "cad-service",
            "execution": "isolated-real-occt",
            "proof": proof,
            "limits": settings.public_limits(),
        }

    @application.get("/v1/capabilities")
    def get_capabilities():
        try:
            result = executor.capabilities()
        except CadError as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "schema_version": "caddydaddy.cad-capabilities/1",
                    "status": "BLOCKED",
                    "kernel": None,
                    "runtime_gate": {"status": "BLOCKED"},
                    "diagnostic": exc.diagnostic.model_dump(mode="json", exclude_none=True),
                },
            )
        result["deployment"] = {
            "execution": "SUBPROCESS_ISOLATED",
            "state": "STATELESS",
            "limits": settings.public_limits(),
        }
        return result

    @application.post("/v1/recompute", response_model=RecomputeResponse)
    def post_recompute(request: RecomputeRequest) -> RecomputeResponse:
        return executor.recompute(request)

    @application.post("/v1/assemblies/solve", response_model=AssemblyResponse)
    def post_assembly(request: AssemblyRequest) -> AssemblyResponse:
        return executor.assemble(request)

    @application.post("/v1/exchange", response_model=ExchangeResponse)
    def post_exchange(request: ExchangeRequest) -> ExchangeResponse:
        return executor.exchange(request)

    return application


app = create_app()
