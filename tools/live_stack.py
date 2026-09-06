"""Run the product service locally in the explicit live-classification lane.

    python3 tools/live_stack.py init     # writes .env.live.local with every live variable except the key
    python3 tools/live_stack.py serve    # reads .env.live.local and starts the product service on 127.0.0.1:4173

The key is read from the file and handed to the child process; it is never printed. The file is gitignored
by name pattern (*.local). Live mode fails closed on the server if any variable is missing or out of range.
"""
import os, pathlib, secrets, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / '.env.live.local'
LIVE = {
    'REAL_LLM_AUTHORIZED': 'true',
    'ANTHROPIC_MODEL': 'claude-opus-5',                      # allowlist: claude-opus-5, claude-sonnet-5
    'CADDYDADDY_LIVE_LLM_CALLS_CAP': '64',                   # server maximum
    'CADDYDADDY_LIVE_LLM_COST_CAP_MICROUSD': '20000000',     # 20 USD for the session
    'CADDYDADDY_LIVE_LLM_ESTIMATED_CALL_COST_MICROUSD': '250000',  # 0.25 USD reserved per call
    'CADDYDADDY_LIVE_LLM_TIMEOUT_SECONDS': '90',                   # one structured opus call takes about 20 s
}
REQUIRED = ('ANTHROPIC_API_KEY', 'CADDYDADDY_LIVE_LLM_ACCESS_TOKEN', *LIVE)


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                values[k.strip()] = v.strip()
    return values


def init() -> None:
    if ENV_FILE.exists():
        print(f'{ENV_FILE.name} already exists; not overwriting'); return
    token = secrets.token_urlsafe(24)
    lines = ['# Local live-classification lane. Gitignored. Paste the Anthropic key after the equals sign.', 'ANTHROPIC_API_KEY=']
    lines += [f'{k}={v}' for k, v in LIVE.items()]
    lines += ['# Shared secret between the browser and the product service; paste it in Settings as the live access token.', f'CADDYDADDY_LIVE_LLM_ACCESS_TOKEN={token}']
    ENV_FILE.write_text('\n'.join(lines) + '\n')
    print(f'wrote {ENV_FILE.name}; live access token: {token}')


def serve(scripted: bool = False) -> None:
    """scripted: the same service and paths without the live variables, so the engine answers with its deterministic model."""
    values = {} if scripted else read_env()
    missing = [] if scripted else [k for k in REQUIRED if not values.get(k)]
    if missing:
        sys.exit('cannot start live: missing ' + ', '.join(missing) + f' in {ENV_FILE.name}')
    env = dict(os.environ)
    env.pop('REAL_LLM_AUTHORIZED', None)
    env.update(values)
    env.setdefault('CADDYDADDY_SNAPSHOT_PATH', str(ROOT / 'apps' / 'product-service' / 'candidate-snapshot.v1.json'))
    env.setdefault('CADDYDADDY_CAD_SERVICE_URL', 'http://127.0.0.1:8000')
    env['PYTHONPATH'] = os.pathsep.join(str(ROOT / p) for p in ('apps/product-service', 'packages/compliance-bridge', 'packages/sourcing', 'packages/classification', 'packages/core-kernel/src', 'packages/cad-output/src'))
    cmd = ['uv', 'run', '--python', '3.12', '--with', 'jsonschema', '--with', 'pydantic', '--with', 'anthropic', '--with', 'rfc8785', '--with', 'httpx', 'python', '-m', 'product_service', '--host', '127.0.0.1', '--port', '4173']
    print('starting the product service in the', 'scripted lane' if scripted else 'live lane · model ' + values['ANTHROPIC_MODEL'] + ' · calls cap ' + values['CADDYDADDY_LIVE_LLM_CALLS_CAP'])
    os.execvpe(cmd[0], cmd, env)


if __name__ == '__main__':
    {'init': init, 'serve': serve, 'serve-scripted': lambda: serve(scripted=True)}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: sys.exit(__doc__))()
