import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClassificationClientError,
  evaluateClassification,
  type ClassificationDetermination,
  type ClassificationItemKind,
} from '../lib/classification-client';
import { useStore } from '../store';

export type ClassificationExecutionMode = 'scripted' | 'live-claude';

export function classificationExecutionEnabled(
  mode: ClassificationExecutionMode,
  running: boolean,
  accessToken: string,
  publicSyntheticConfirmed: boolean,
): boolean {
  return !running && (mode === 'scripted' || (accessToken.trim().length > 0 && publicSyntheticConfirmed));
}

function dollars(microusd: number): string {
  return `$${(microusd / 1_000_000).toFixed(2)}`;
}

export function LiveClassificationPanel() {
  const project = useStore((state) => state.project);
  const parts = useStore((state) => state.parts);
  const span = useStore((state) => state.span);
  const geometry = useStore((state) => state.geo);
  const sourceFacts = useMemo(() => ({
    'data.classification': 'SYNTHETIC_PUBLIC_DEMO_ONLY',
    'project.name': project?.name ?? 'Untitled project',
    'project.description': project?.description ?? '',
    'declared.end_use': project?.intake?.endUse ?? 'not supplied',
    'declared.end_user': project?.intake?.endUser ?? 'not supplied',
    'declared.ship_to': project?.intake?.shipTo ?? 'not supplied',
    'design.span_m': span,
    'design.geometry_kind': geometry.kind,
    'design.components': Object.entries(parts)
      .filter(([, partId]) => Boolean(partId))
      .map(([slot, partId]) => ({ slot, part_id: partId })),
  }), [geometry.kind, parts, project, span]);
  const defaultDescription = `${project?.name ?? 'CADdyDaddy design'}: ${project?.description || 'multi-body unmanned-aircraft design and component assembly'}`;
  const [description, setDescription] = useState(defaultDescription);
  const [factsText, setFactsText] = useState(JSON.stringify(sourceFacts, null, 2));
  const [itemKind, setItemKind] = useState<ClassificationItemKind>('commodity');
  const [mode, setMode] = useState<ClassificationExecutionMode>('scripted');
  const [accessToken, setAccessToken] = useState('');
  const [publicSyntheticConfirmed, setPublicSyntheticConfirmed] = useState(false);
  const [state, setState] = useState<'idle' | 'running' | 'valid' | 'error'>('idle');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<ClassificationDetermination | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function refreshFromDesign() {
    setDescription(defaultDescription);
    setFactsText(JSON.stringify(sourceFacts, null, 2));
    setError(null);
  }

  async function run() {
    let facts: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(factsText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Facts must be a JSON object.');
      facts = parsed as Record<string, unknown>;
    } catch (cause) {
      setState('error');
      setError({ code: 'REQUEST_INVALID', message: cause instanceof Error ? cause.message : 'Facts must be valid JSON.' });
      return;
    }

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState('running');
    setError(null);
    try {
      const determination = await evaluateClassification(
        { description, facts, item_kind: itemKind },
        mode === 'live-claude'
          ? { signal: controller.signal, liveAuthorization: { accessToken, publicSyntheticDataConfirmed: publicSyntheticConfirmed } }
          : { signal: controller.signal },
      );
      if (request.current !== controller) return;
      setResult(determination);
      setState('valid');
    } catch (cause) {
      if (request.current !== controller) return;
      const failure = cause instanceof ClassificationClientError
        ? { code: cause.code, message: cause.message }
        : { code: 'BACKEND_UNAVAILABLE', message: cause instanceof Error ? cause.message : 'Charlie engine request failed.' };
      setState('error');
      setError(failure);
    }
  }

  const enabled = classificationExecutionEnabled(mode, state === 'running', accessToken, publicSyntheticConfirmed);
  const decision = result?.determination;

  return (
    <section className="panel" aria-labelledby="connected-classification-title">
      <div className="panel-head">
        <div>
          <div id="connected-classification-title" className="panel-title">Charlie engine</div>
          <div className="sub">Ordered USML to CCL to EAR99 review with strict structured output</div>
        </div>
        <span className="chip chip-sm">legal effect: NONE</span>
      </div>
      <div className="p-4 grid gap-4">
        <div role="note" className="border-l-4 border-amber bg-surface px-3 py-2 text-[12px] leading-[1.45]">
          Jurisdiction-screening support only. This is not legal advice, an export authorization, transaction clearance, sanctions screening, or permission to ship.
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.72fr)]">
          <div className="grid gap-3">
            <label className="grid gap-1 text-[12px] font-semibold">
              Product or part description
              <textarea aria-label="Classification product description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-r border border-line bg-surface p-2 font-normal" />
            </label>
            <label className="grid gap-1 text-[12px] font-semibold">
              Declared facts
              <textarea aria-label="Classification facts JSON" rows={9} spellCheck={false} value={factsText} onChange={(event) => setFactsText(event.target.value)} className="w-full rounded-r border border-line bg-surface p-2 font-mono text-[11px] font-normal" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn" onClick={refreshFromDesign}>Refresh from active design</button>
              <label className="text-[12px] font-semibold">Item kind{' '}
                <select aria-label="Classification item kind" value={itemKind} onChange={(event) => setItemKind(event.target.value as ClassificationItemKind)} className="rounded-r border border-line bg-surface px-2 py-1 font-normal">
                  <option value="commodity">Commodity</option>
                  <option value="software">Software</option>
                  <option value="technology">Technology</option>
                </select>
              </label>
            </div>
          </div>

          <div className="grid content-start gap-3">
            <fieldset className="grid gap-2 rounded-r border border-line p-3">
              <legend className="px-1 text-[12px] font-semibold">Execution mode</legend>
              <label className="flex items-start gap-2 text-[12px]"><input type="radio" name="classification-execution-mode" checked={mode === 'scripted'} onChange={() => setMode('scripted')} /><span><b>ScriptedModel</b><br /><span className="text-muted">Deterministic zero-token readiness path.</span></span></label>
              <label className="flex items-start gap-2 text-[12px]"><input type="radio" name="classification-execution-mode" checked={mode === 'live-claude'} onChange={() => setMode('live-claude')} /><span><b>Live Claude</b><br /><span className="text-muted">Sends only the entered description and facts to Anthropic.</span></span></label>
            </fieldset>

            {mode === 'live-claude' && <div aria-label="Live Claude authorization" className="grid gap-3 rounded-r border border-amber bg-surface p-3">
              <div role="note" className="text-[12px] leading-[1.45]"><b>External data transfer.</b> Public or synthetic demo data only. Never submit CUI, export-controlled technical data, customer data, credentials, or secrets.</div>
              <label className="grid gap-1 text-[12px] font-semibold">Demo access token
                <input aria-label="Live Claude demo access token" type="password" autoComplete="off" spellCheck={false} value={accessToken} onChange={(event) => setAccessToken(event.target.value)} className="rounded-r border border-line bg-bg p-2 font-normal" />
                <span className="text-[11px] font-normal text-muted">This is the deployment access token, not an Anthropic API key. It remains in this browser session only.</span>
              </label>
              <label className="flex items-start gap-2 text-[12px] font-semibold"><input aria-label="Confirm public or synthetic data only" type="checkbox" checked={publicSyntheticConfirmed} onChange={(event) => setPublicSyntheticConfirmed(event.target.checked)} /><span>I confirm this request contains public or synthetic data only.</span></label>
            </div>}

            <button type="button" className="btn btn-primary" disabled={!enabled} onClick={run}>
              {state === 'running' ? 'Running Charlie engine...' : mode === 'live-claude' ? 'Run with live Claude' : 'Run deterministic engine'}
            </button>
            {error && <div role="alert" className="rounded-r border border-red bg-surface p-3 text-[12px]"><b className="font-mono">{error.code}</b> - {error.message}{result ? ' The last valid result remains below.' : ''}</div>}
          </div>
        </div>

        {result ? <div aria-label="Connected classification result" className="grid gap-3 border-t border-line2 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-[18px] font-semibold">{decision?.jurisdiction}{decision?.classification.length ? ` - ${decision.classification.join(', ')}` : ''}</div><div className="text-[12px] text-muted">{decision?.basis.join(' ') || 'No positive classification basis was accepted.'}</div></div>
            <div className="text-right font-mono text-[11px] text-muted"><div>{result.provenance.model || 'model not reported'}</div><div>{result.provenance.budget.calls_used}/{result.provenance.budget.calls_cap} calls - {dollars(result.provenance.budget.cost_used_microusd)} reported</div></div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{result.candidates.map((candidate) => <article key={candidate.candidate_id} className="rounded-r border border-line p-3 text-[12px]"><div className="flex justify-between gap-2"><b className="font-mono">{candidate.provision}</b><span className="chip chip-sm">{candidate.status}</span></div><div className="mt-2 text-muted">{candidate.why_considered}</div>{candidate.why_rejected && <div className="mt-2">Rejected: {candidate.why_rejected}</div>}{candidate.challenge && <div className="mt-2">Challenge {candidate.challenge.resolution}: {candidate.challenge.text}</div>}</article>)}</div>
          <div className="grid gap-1 font-mono text-[10px] text-muted"><div>snapshot {result.snapshot_sha256}</div><div>reference pack {result.pack_sha256}</div></div>
        </div> : <div className="text-[12px] text-muted">No connected-service result yet. Run the deterministic path for a no-spend check, or use the guarded live path with the deployment token.</div>}
      </div>
    </section>
  );
}
