# ADR-0002: Status outranks price, and the declined offer is the record

- Status: accepted (lane-local), 2026-09-06
- Source: THE BUILD §2.8 S2 and §3.10; Diego's 2026-09-03 research steps 3, 4 and 7; design spec D-9 (recommended, unratified)

## Context

The cheaper motor from a seller 60 % owned by a listed company must be visible and must lose. A tool that hides the blocked offer produces no record that the engineer saw it; a tool that ranks on price first invites the wrong click.

## Decision

1. Offers on a line sort by **screening status ascending by severity, then per-unit landed cost**; review-blocked offers are shown last, never hidden. Unverified estimates sort last within their status.
2. Screening is **exact and suffix-normalized name matching only**, printed "not fuzzy", over the seller, the manufacturer and the owners found in the committed ownership table. Depth is **risk-tiered**: seller and manufacturer only for a domestic EAR99 commodity part; the full walk when the part is foreign-origin, controlled, carries a red flag, or the product declares a prime flow-down. The tier and its reasons are printed on the card.
3. The roll-up is the **worst node**: `review_blocked` > `review_required` > `abstained` > `no_candidate_match`. Ownership unknown is `review_required`, never a block, never a percentage. "Cleared" is not in the vocabulary.
4. **Two adjudication roles**, both bound to the list snapshot hash: an analyst may record a likely false positive (the node drops to review required, pending counsel); an empowered official may resolve or escalate (escalate pins review blocked). An adjudication against one snapshot never applies to a later one.
5. A selection **refuses** a review-blocked offer, a stale tariff fixture, or a failed hash re-verification, and **records every shown-and-declined offer** with a reason code (`price`, `lead_time`, `quality`, `owner_screened`, `ownership_unknown`, `origin`, `export_gate`, `other`), the offer's status at decline and the part's classification state at decline. Append-only, attested, with a predecessor pointer on re-selection.
6. Wording: "the record of the purchase decision", never "procurement decision support". Review required does not stop a selection; review blocked does; the card says which.

## Consequences

- The DJI match in the fixture lands on two lists at once (Treasury's CMIC list by name; the BIS Entity List by alternate name). The card prints what the data says, not what the spec assumed.
- With the typed ownership table, six of thirteen Kestrel lines are review-required at baseline (GroupGets, T-Motor, JLCPCB and LCSC have no ownership row). That is the honest state and the test asserts it.
