import { useStore, designHashOf } from '../store';
import { PACKS } from '../lib/catalog';
import { FIXTURES } from '../lib/sourcing';

/** GET /now as Shipyard would read it: read-only, UNKNOWN by default, never a second source of truth. */
export function Now() {
  const s = useStore();
  const head = s.events[0];
  const obs = {
    as_of: new Date().toISOString(),
    candidate: {
      git_sha: 'UNKNOWN',
      design_hash: designHashOf(s.snapshot()),
      log_head_seq: s.events.length,
      log_head_hash: head?.hash ?? 'UNKNOWN',
      export_pack_sha: PACKS[s.pack].sha,
      duty_pack_sha: '7d19c0',
      fixture_manifest_shas: Object.values(FIXTURES).map((f) => f.split(' ')[0]),
      mode: { llm: 'cache', api: 'cached' },
    },
    round_status: s.round?.status ?? 'UNKNOWN',
    last_event: head ? { seq: head.seq, kind: head.kind, lane: head.lane } : 'UNKNOWN',
    tests: { passed: 'UNKNOWN', skipped: 'UNKNOWN' },
    features: [
      { id: 'F-01', claim_class: 'design-intent' }, { id: 'F-02', claim_class: 'design-intent' }, { id: 'F-03', claim_class: 'design-intent' }, { id: 'F-04', claim_class: 'design-intent' }, { id: 'F-05', claim_class: 'design-intent' },
      { id: 'F-06', claim_class: 'design-intent' }, { id: 'F-07', claim_class: 'design-intent' }, { id: 'F-08', claim_class: 'design-intent' }, { id: 'F-09', claim_class: 'design-intent' }, { id: 'F-10', claim_class: 'design-intent' },
      { id: 'F-11', claim_class: 'design-intent' }, { id: 'F-12', claim_class: 'design-intent' }, { id: 'F-13', claim_class: 'design-intent' }, { id: 'F-14', claim_class: 'design-intent' }, { id: 'F-15', claim_class: 'design-intent' },
      { id: 'F-16', claim_class: 'design-intent' }, { id: 'F-17', claim_class: 'design-intent' }, { id: 'F-18', claim_class: 'design-intent' }, { id: 'F-19', claim_class: 'design-intent' }, { id: 'F-20', claim_class: 'design-intent' },
      { id: 'F-21', claim_class: 'design-intent' }, { id: 'F-22', claim_class: 'design-intent' }, { id: 'F-23', claim_class: 'design-intent' }, { id: 'F-24', claim_class: 'design-intent' }, { id: 'F-25', claim_class: 'design-intent' },
    ],
    note: 'frontend-local observation · nothing here is demonstrated until the named test is green on a fresh clone · the backend GET /now replaces this',
  };
  return (
    <div className="h-full overflow-auto p-6 bg-bg text-ink">
      <div className="max-w-[900px] mx-auto grid gap-3">
        <div className="flex items-baseline gap-3"><span className="font-semibold">/now</span><span className="text-[13px] text-muted">read-only observation for Shipyard · GET only · UNKNOWN by default</span><a href="/" className="btn ml-auto">back to the app</a></div>
        <pre className="panel p-4 font-mono text-[12px] whitespace-pre-wrap m-0">{JSON.stringify(obs, null, 2)}</pre>
      </div>
    </div>
  );
}
