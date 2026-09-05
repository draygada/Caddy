# Classification lane

The Strafe Forge lane that reads one part's facts against the U.S. export-control lists and records what it considered, what it ruled out and why, what it could not decide and what fact would decide it. It proposes; a human adopts. It never emits a legal conclusion.

## Language

### The regulation

**Reference pack**:
The dated, content-addressed set of regulatory text the engine may cite: the USML, the CCL and the two "specially designed" definitions, at paragraph grain, with a manifest naming each source file's hash and retrieval date.
_Avoid_: corpus, knowledge base, the regs

**Unit**:
One quotable paragraph of the reference pack with its own hash, citation and parent. The only thing a citation may point into.
_Avoid_: chunk, span, passage

**Provision**:
The canonical name of a unit as a candidate: `USML XII(e)(1)`, `9A012.a.2`, `22 CFR 120.41(b)(2)`, `EAR99`, `NOT_SUBJECT`.
_Avoid_: code (ambiguous), entry (the DNHacks rule engine's word)

### The facts

**Fact snapshot**:
The immutable view of what one part revision asserts about one item, every fact with its evidence grade, hashed. The engine's only input besides the pack.
_Avoid_: intake, description, product record

**Item**:
The classified unit of a part: its commodity, its software or its technology. Each gets its own board. The UI may label the commodity "the device".
_Avoid_: device (in code), product

**Evidence grade**:
How a fact got onto the snapshot: `asserted` (typed into the design or declared by an agent), `attested` (declared by a human), `verified` (measured, with an artifact reference). Caps the claim class.
_Avoid_: confidence, trust level

**Explicit unknown**:
A declared answer of "unknown", "tbd" or "?". Recorded as such, never folded into a value, never counted toward readiness.

**Readiness**:
Whether the snapshot carries enough facts to analyze at all: `insufficient`, `preliminary` or `classifiable`. Insufficient blocks before any model call.

### The analysis

**Candidate**:
One provision the analysis considered for one item, with its stage, status and the reasons on both axes. The board is the list of candidates in stage order.
_Avoid_: hit, match, result

**Stage**:
The candidate's place in the order of review: `usml_enumerated`, `specially_designed_itar`, `six_hundred_series`, `specially_designed_ear`, `other_ccl`, `residual`. Data, not presentation; an empty stage still renders.

**Status**:
`leading`, `knocked_out`, `blocked_on_facts` or `not_reached`. A knockout carries its written reason and a cited element that fails; `not_reached` means the order of review decided before this candidate's stage and it was never analysed.
_Avoid_: verdict, result, decision

**Knockout / negative finding**:
A candidate ruled out on a cited element failure. `knocked_out` is the schema value; any surface that renders the board for an outsider says "ruled out" or "negative finding". Rendering (a memo) is outside this lane.
_Avoid_: "knocked out" in prose, rejected, eliminated

**Pursuit**:
Whether a surfaced candidate was worth pursuing or explicitly not. A depth-of-analysis choice, separate from status so "we did not pursue this" never reads as "this does not apply".

**Element**:
One clause of a candidate's unit held against the facts: `met`, `not_met` or `indeterminate`, with the facts relied on and, when the model claims the text says so, a verified citation.

**Advocate / judge**:
The two mutually blind model calls of the analysis wave, per provision. The advocate argues that the provision applies and cannot knock it out; the judge may knock out only on a cited element failure.

**Floor candidate**:
A candidate seated by code, not the model: `EAR99` on every board; a USML category an intake signal names.

**Route**:
The order-of-review decision over the board's records: the USML step, the CCL step, the posture (`ITAR`, `EAR`, `EAR99`, `AMBIGUOUS`) and the leading candidate.
_Avoid_: determination, verdict, classification

**Claim class**:
What the record can carry: `insufficient_facts`, `conditional`, `supported`, `ambiguous`. Ordinal, computed, capped by the evidence grade of the decisive facts. No number exists beside it.
_Avoid_: confidence, score, percentage

**Recommended instrument**:
When the claim class is ambiguous, which instrument the ambiguity calls for: `cj` (jurisdiction is the question), `ccats` (the entry is the question), `counsel`.

**Concern**:
An adversarial reading of the stated use that surfaces on the board and can reach no candidate's status. Has no path to a disposition by construction.

**Legal tension**:
One of the shortcuts the analysis records for counsel and never applies: strictest regime supersedes, whole-regime dismissal, destination as classification, use as dispositive.

### The loop

**Question**:
A fact the analysis needs, in the regulation's words, naming the candidate and element it would unblock and ranked by how much of the board it would move.

**Round**:
One batch of at most five questions and the human's answers, which become attested facts on a new snapshot. A round with no new questions closes the loop.
_Avoid_: clarification, chat, turn

**Envelope**:
The engine's one output: the board, the route, the claim class, the questions, the concerns and tensions, the provenance. Pure data; the payload of an analysis proposal.
_Avoid_: result, response, report

**Analysis proposal**:
An envelope appended to the product thread by an agent. It authorizes nothing.

**Adopted classification record**:
The human act that makes an analysis the company's internal classification record, with a name and a role. The only terminal event; the lane cannot write it.
_Avoid_: determination, approval, sign-off, "classified as"

**Impact**:
The list of candidates whose cited units changed between two reference packs. A diff, never a model call.
