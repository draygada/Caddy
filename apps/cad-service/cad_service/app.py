"""FastAPI transport for the stateless CAD service."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .executor import NativeExecutor
from .kernel import CadError, capabilities
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
        status_code = 504 if exc.diagnostic.code == "NATIVE_OPERATION_TIMEOUT" else 422
        return JSONResponse(
            status_code=status_code,
            content={"status": "FAILED", "diagnostics": [exc.diagnostic.model_dump(mode="json")]},
        )

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "cad-service", "execution": "real-occt"}

    @application.get("/ready")
    def ready():
        try:
            proof = executor.readiness()
        except CadError:
            return JSONResponse(status_code=503, content={"status": "not-ready", "service": "cad-service"})
        return {
            "status": "ready",
            "service": "cad-service",
            "execution": "isolated-real-occt",
            "proof": proof,
            "limits": settings.public_limits(),
        }

    @application.get("/v1/capabilities")
    def get_capabilities() -> dict:
        result = capabilities()
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
