# FB-06 — Bounded AI and classification bridges

Owner lane: integrations. Priority: P2 and fully cuttable.

## Outcome

Demonstrate that models and the existing classification service can assist around the deterministic loop without becoming the source of a live tripwire.

## Three isolated actions

1. Datasheet extractor proposes typed facts plus exact byte spans.
2. Replacement search proposes candidate parts; every proposed fact is verified and re-evaluated locally before display.
3. “Request determination” sends the current verified design/spec and fired-rule evidence to the existing classification API and renders its memo separately from local tripwires.

## Boundaries

- None runs on model change.
- No output enters the design until exact source bytes and units verify.
- Cached synthetic/demo responses exist for every network action and are visibly labeled.
- A model assertion without a resolving span is rejected, not shown with lower opacity.
- The classification memo never overwrites local determinations or masquerades as the live engine result.

## Acceptance

- Poisoned datasheet fixture rejects the hidden/conflicting number and preserves the conflict.
- Timeout, malformed JSON, wrong units, missing span, and unsupported source all fail closed.
- Replacement candidate is re-run through the same deterministic engine before appearing as “lower impact.”
- Network-disabled demo uses pinned fixtures and says so on screen.
- Live calls are optional and require exact current credential/spend authority; no builder assumes it.

## Cut line

Cut this entire bible before risking FB-01 through FB-04 or the offline rehearsal. Its absence does not weaken the north-star demo.
