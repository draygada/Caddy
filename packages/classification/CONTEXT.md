# Classification lane

The Strafe Forge lane that runs one item of a product or part through the whole order of review against the U.S. export-control lists and returns its jurisdictional determination. It runs end to end with no human gate. It renders no memo and recommends no filing.

## Language

### The regulation

**Reference pack**:
The dated, content-addressed set of regulatory text the engine may cite: the USML, the CCL and the two "specially designed" definitions, at paragraph grain, with a manifest naming each source file's hash and retrieval date.
_Avoid_: corpus, knowledge base, the regs

**Unit**:
One quotable paragraph of the reference pack with its own hash, citation and parent. The only thing a citation may point into.
_Avoid_: chunk, span, passage

**Provision**:
The canonical name of a unit as a candidate: `USML XII(e)(1)`, `9A012.a.2`, `22 CFR 120.41(b)(2)`, `EAR99`.
_Avoid_: code (ambiguous), entry (the DNHacks rule engine's word)

### The facts

**Fact snapshot**:
The immutable, hashed view of what one item asserts: a description and facts, from a Forge part revision or a plain product. The engine's only input besides the pack.
_Avoid_: intake, product record

**Item**:
The classified unit of a part or product: its commodity, its software or its technology. Each gets its own run.
_Avoid_: device, product (as the unit)

**Explicit unknown**:
A fact given as "unknown", "tbd" or "?". Recorded as such and never folded into a value; to the engine it is an open fact, not an answer.

### The analysis

**Candidate**:
One provision the engine considered for the item, with its stage and status and the reasons. The board is the list of candidates in stage order.
_Avoid_: hit, match, result

**Stage**:
The candidate's place in the order of review: `usml_enumerated`, `specially_designed_itar`, `six_hundred_series`, `specially_designed_ear`, `other_ccl`, `residual`.

**Status**:
`supported`, `knocked_out`, `undetermined` or `not_reached`. A knockout carries its written reason and a cited element that fails; `undetermined` means the candidate could not be closed on the facts given; `not_reached` means the order of review decided before this candidate's stage and it was never analysed.
_Avoid_: leading, blocked, verdict

**Knockout / negative finding**:
A candidate ruled out on a cited element failure. `knocked_out` is the schema value; any surface that renders the board for an outsider says "ruled out" or "negative finding". Rendering is outside this lane.
_Avoid_: "knocked out" in prose, rejected, eliminated

**Element**:
One clause of a candidate's unit held against the facts: `met`, `not_met` or `indeterminate`, with the facts relied on and, when the model claims the text says so, a verified citation.

**Advocate / judge**:
The two mutually blind model calls of the analysis wave, per provision. The advocate argues that the provision applies and cannot knock it out; the judge may knock out only on a cited element failure and may rule supported only when every element is met.

**Floor candidate**:
The one candidate seated by code, not the model: `EAR99` on every board, elected only when every specific candidate is knocked out.

**Determination**:
The engine's answer: the jurisdiction (`ITAR`, `EAR`, `EAR99`, or `UNDETERMINED` when the USML step cannot close on the facts given), the provisions it rests on, the step outcomes, the basis lines, and the open candidates. Computed by code from the board; never a model's pick.
_Avoid_: verdict, confidence, classification (for the whole answer)

**Undetermined**:
The honest outcome when a USML candidate cannot be closed. The run still completes and returns; nothing waits on a person. It never means ITAR and never means the item is clear of the USML.
_Avoid_: ambiguous, insufficient facts, blocked

**Reference note**:
A code-authored note on a candidate or a run: a citation struck, a disposition dropped, a code generalised, a model abstention. The trail of what the engine refused to accept.
