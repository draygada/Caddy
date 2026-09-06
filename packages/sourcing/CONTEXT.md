# Sourcing lane: the domain language

One line per term. Implementation lives in `forge_sourcing/`; decisions in `docs/adr/`. Source of the vocabulary: strafe-prototype `docs/dnhacks_engineering_direction_2026-09-05.md` §3.6–§3.7 and `docs/dnhacks_feature_specs_2026-09-05.md` F-13…F-17, as cut by Diego's 2026-09-03 research and 2026-09-05 validation.

## The round

- **Round**: one attempt to buy every part of one exact design state. Bound to the design hash and log sequence it was opened against; a later design state opens a new round that names the one it supersedes. Never edited, only superseded.
- **Round defaults**: ship-to, transport mode, quantity and assembly country as typed at open. They are defaults, refinable per offer and per shipment; a refinement re-runs screening and cost for the affected lines and records provenance and staleness.
- **Ship-to**: where the parts go. The US bench or the Taiwan assembly site. The destination country decides whether a line takes the export-gate path.
- **Line**: one part node of the design in the round, with the quantity needed and the engine's evaluation of that node carried verbatim.
- **Round state**: `opened → offers_resolved → screened → costed → selection_confirmed → gated → package_ready`, plus `superseded`. Moves only by appended events; a gate before package applies only when the ship-to is outside the US.

## Offers and parties

- **Offer**: a seller's declared availability, price, classification and tariff code for one manufacturer part number as of the fixture date. Not a quote, not a classification determination. Stored by content hash.
- **Seller / manufacturer**: who is paid and who made it. Two different parties with two different countries; "ships from" is a warehouse and never sets origin.
- **Origin**: the declared country of origin, per offer and per lot, badged "declared". The tool never decides origin.
- **Declared ECCN / HTS**: a part-level manufacturer claim with a source and a date, or "not yet classified". The buyer's own determination sits beside it and is never collapsed into it.
- **Party**: any name in an offer's tree: seller, manufacturer, or an owner found in the ownership table.
- **Party tree**: the seller's and manufacturer's owners walked upward through the committed ownership table. Each edge carries relation, percent and an evidence URL.
- **Relation**: exactly one of `owns_ge_50`, `owns_lt_50`, `controls`, or `no_controlling_owner` (the walk ends on a public record saying nobody owns half).
- **Ownership unknown**: a party with no row in the ownership table. Printed as such, never omitted, never a percentage, never a block; it is a review flag and an attested risk acceptance.
- **Depth tier**: how far the walk goes. `seller_and_manufacturer` for a domestic, EAR99 commodity part; `full_walk` when the part is controlled, foreign-origin, a red flag fired, or a prime flow-down requires it. The tier is printed on the card.
- **SYNTHETIC**: a seller, owner or part invented for the demo. Badged on every screen and said aloud.

## Screening

- **Screening run**: one name checked against one dated snapshot of the Consolidated Screening List. Records the query, the normalization, the match kind, the entries hit, and the snapshot hash.
- **Match kind**: `exact`, `normalized` (case, punctuation and legal suffixes stripped), `none`, or `abstained` (the name was empty or unparseable). Never fuzzy; "not fuzzy" is printed.
- **Offer status** (the roll-up): the worst node in the offer's tree, in this order: `review_blocked` (any exact or normalized match) > `review_required` (ownership unknown, or a match an analyst marked false positive pending counsel) > `abstained` > `no_candidate_match`. "Cleared" is not in the vocabulary.
- **Adjudication**: a human's disposition of a match, bound to the list snapshot it was made against so it cannot be replayed against a newer list. Two roles: an **analyst** records a likely false positive, which lowers the node to review required; an **empowered official** resolves an unresolved match or escalates, which pins review blocked.
- **Review required** does not stop a selection. **Review blocked** does.

## Cost

- **Estimate**: the landed-cost ladder for one offer at the round quantity: a pure function of offer hash, quantity, declared tariff code, declared origin, entry date, transport mode and tariff fixture hash. Same inputs, same hash. Not a customs determination.
- **Ladder**: one row per layer with citation, rate, amount and note: base rate by heading with HTS revision; Section 301 by Chapter 99 heading; Section 232 (in or out of scope); country action; AD/CVD scope; merchandise processing fee by fiscal-year row; harbor maintenance fee (ocean only); the de minimis note; the Section 122 status banner. Never one folded duty number.
- **Rate not verified**: a rate the fixture carries but nobody read from the schedule this pass. Printed grey; the line sorts last.
- **Domestic purchase**: seller in the ship-to country. Every import layer "not applicable"; the note says "no entry".
- **Landed cost per unit**: the ladder total divided by quantity. The sort key after status, never before it.

## Selection and the gate

- **Selection**: the engineer's choice of one offer for one line, with every other shown offer recorded as **declined** with a reason code (`price`, `lead_time`, `quality`, `owner_screened`, `ownership_unknown`, `origin`, `export_gate`, `other`) and the offer's status and the part's classification state at the moment of decline. Append-only, attested, with a predecessor pointer on re-selection.
- **Escalation**: a line the round cannot resolve by itself: no offer match, classification conflict between sellers, ownership unknown, origin depends on lot. A human resolves it; an agent may only propose.
- **Export gate**: for a ship-to outside the US, the engine's destination cell for the part, verbatim. NLR passes; STA, GBS, LVS and ENC pass with the paragraph named; LIC, "LIC no exception", DDTC and DENIAL block the package. The gate adds no regulatory logic.
- **Authorization reference**: a typed, attested string (licence number, agreement, exemption citation, DSP-5 or DSP-73 number) that lifts a LIC or DDTC block. The gate checks that a human attested a reference exists, never that the authorization is valid, and says so. DENIAL has no reference field.
- **Technical-data declaration**: per supplier or assembler, the person status, what will be shared, and the reference the three-line rule requires: ITAR plus foreign person plus controlled drawings needs a DDTC reference; EAR technology plus foreign person needs a licence or exception reference with the 734.13 sentence printed; EAR99 needs none.

## The package and the order

- **Package**: three artefacts stored by hash, built only after every bound blob and fixture manifest re-verifies: the **pre-entry lines** (for a broker; not an entry), the **diligence record** (parties, screenings, adjudications, declined alternatives, declarations, gates, retention), and the **export references** (design hash, fired entries per line). Refused with a structured reason on any mismatch; no partial package.
- **Order packet**: the package bound to the approved revision, a recipient placeholder, quantities, attachment hashes and an approver. Dispatched exactly once by idempotency key through a **synthetic adapter**, labelled SYNTHETIC. A retry returns the first receipt. Never a real send.
- **Retention**: the longest applicable window for the transaction, computed per regime from its own anchor date (EAR five years, ITAR five years, OFAC ten years, customs five years).

## The thread

- **Event**: one appended fact in the hash-chained thread. Sourcing events bind the design hash, the design sequence and the fixture hashes they read. Terminal kinds (`offer_selected`, `match_adjudicated`, `technical_data_declared`, `escalation_resolved`, `order_dispatched`) require a human attestor.
- **Re-derive**: walk the chain, verify every hash, recompute every estimate and screening from its bound inputs, and print one line. **Tamper** edits one stored field so Re-derive prints the break.
- **Claim ceiling**: the sentence printed on every output that says what it is not. Offers, roll-ups, estimates, gates and packages each have one and never lose it.

## The search

- **Candidate pool**: the parts the team owns data for, per node: a comparator and candidates with declared fields, documents and an offer block. The proposer chooses from it and nowhere else. It is the ceiling of the search until a distributor's terms are read by a human.
- **Approved-manufacturer match / opportunistic find**: whether a candidate's manufacturer is on the approved-manufacturer list. Printed on every card; "available" is not "approved".
- **Document**: bytes fetched under the allowlist (or a committed fixture), content-addressed by sha256, never committed; its text is what the verifier binds.
- **Span**: a quote plus its character offsets `[start:end]` into a document's text, and the text's sha256. The verifier checks the characters, not the meaning.
- **Verified spec**: a field, a decimal value and a unit that the verifier constructed from a span. The only kind of number the dry-run reads.
- **Extraction (Call A)**: one model call that reports spans for the fields the rule rows read. Its schema has no classification, jurisdiction, origin, ownership or screening key. A schema-invalid response is an abstain.
- **Dry-run**: the draft rule rows evaluated against the verified specs of one candidate, on a copy. A row with an unpublished field cannot fire; a row whose own `not` guard holds is suppressed and says by which atom (a guard that is false or unknown never suppresses); a row that needs the tree is not evaluated here, and a green card names it as deferred. Replaced by the engine seam when it lands.
- **Flip gone**: the rows that fired on the current part do not fire on the candidate, no new control row fires, and every field those rows read was verified.
- **Fit comparator**: the slot's stored function, performance, form (including material) and fit. Each dimension resolves, fails or stays unresolved; unresolved is never a pass.
- **Green / grey / red**: green when every single-node check concluded (the tree-dependent rows it could not evaluate are named as deferred to the engine seam, never counted as concluded); red when a fit dimension fails, the tripped row still fires or a new one fires, or a party matches the list; grey when a check could not conclude. Grey sits in a separate needs-input queue, never in the ranked list.
- **Proposal**: an agent's record of a search or of sources for an escalation: pending, never terminal. `alternative_proposed` and `escalation_proposed` are the only kinds an agent writes. A human accepts an escalation proposal (an `escalation_resolved` event) or rejects any proposal; an alternative is accepted in the design lane as a `part_swapped`.
- **Confident**: a binary flag on a proposal: at least one green candidate and no abstain. A proposal for sources is never confident.
- **Hidden line**: text in a document that a reader would not see. It stays in the document text (a PDF's white text would too), is printed on the card, and has no schema slot to land in.
- **Cache / live**: where a model answer came from. Cached answers are keyed by the prompt hash and committed; live answers are opt-in, budgeted in micro-dollars, and recorded once.
