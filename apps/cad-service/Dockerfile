# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 python:3.12.11-slim-bookworm@sha256:519591d6871b7bc437060736b9f7456b8731f1499a57e22e6c285135ae657bf7

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

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
COPY licenses /usr/share/licenses/caddydaddy-cad-service

RUN python -c "import OCP; from api.index import app; assert OCP.__version__ == '7.9.3.1'; assert app"

RUN useradd --create-home --uid 10001 appuser
USER 10001:10001

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()"

CMD ["python", "-m", "uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
