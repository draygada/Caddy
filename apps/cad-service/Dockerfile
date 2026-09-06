# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 python:3.12.11-slim-bookworm@sha256:519591d6871b7bc437060736b9f7456b8731f1499a57e22e6c285135ae657bf7

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    CAD_MAX_REQUEST_BYTES=4250000 \
    CAD_MAX_RESPONSE_BYTES=4250000 \
    CAD_TRANSPORT_TIMEOUT_SECONDS=40 \
    CAD_NATIVE_TIMEOUT_SECONDS=30 \
    CAD_NATIVE_CPU_SECONDS=25 \
    CAD_NATIVE_MAX_ADDRESS_SPACE_MIB=0 \
    CAD_NATIVE_MAX_OPEN_FILES=256 \
    CAD_MAX_CONCURRENCY=1 \
    CAD_KEEPALIVE_SECONDS=5 \
    CAD_CORS_ORIGINS= \
    CAD_ALLOWED_HOSTS=localhost,127.0.0.1,testserver

WORKDIR /app

COPY requirements-runtime.txt ./requirements-runtime.txt
RUN python -m pip install --no-cache-dir -r requirements-runtime.txt

ARG OCP_WHEEL_URL=https://files.pythonhosted.org/packages/89/6b/ee2d35470b0136c7435eff392d6617795219dad46a176f168fcd4d26f19e/cadquery_ocp_novtk-7.9.3.1-cp312-cp312-manylinux_2_31_x86_64.whl
ARG OCP_WHEEL_SHA256=8582570e148e5e08cfb9242113edaf73068bbfb3c46b32518e879071b50c345b
COPY scripts/install_ocp_wheel.py ./scripts/install_ocp_wheel.py
RUN OCP_WHEEL_URL="$OCP_WHEEL_URL" OCP_WHEEL_SHA256="$OCP_WHEEL_SHA256" \
    python scripts/install_ocp_wheel.py

COPY cad_service ./cad_service
COPY api ./api
COPY licenses /usr/share/licenses/caddydaddy-cad-service/licenses
COPY THIRD_PARTY_NOTICES.md REDISTRIBUTION_EVIDENCE.md /usr/share/licenses/caddydaddy-cad-service/
COPY scripts/verify_redistribution_evidence.py /usr/share/licenses/caddydaddy-cad-service/scripts/verify_redistribution_evidence.py

RUN python /usr/share/licenses/caddydaddy-cad-service/scripts/verify_redistribution_evidence.py \
      --site-packages /usr/local/lib/python3.12/site-packages >/tmp/native-evidence.json \
 && python -c "import OCP; from OCP.BRepCheck import BRepCheck_Analyzer; from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox; from api.index import app; shape=BRepPrimAPI_MakeBox(1,1,1).Shape(); assert OCP.__version__ == '7.9.3.1'; assert BRepCheck_Analyzer(shape, True).IsValid(); assert app" \
 && rm /tmp/native-evidence.json

RUN useradd --create-home --uid 10001 appuser
USER 10001:10001

EXPOSE 8000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').getenv('PORT', '8000') + '/ready', timeout=8).read()"

CMD ["python", "-m", "cad_service.server"]
