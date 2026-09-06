"""Call A: prompt → model → schema check → verifier per claim. A schema-invalid response is an abstain of the whole
call (S3 §(b)); a claim is accepted only by the verifier."""
from __future__ import annotations

from dataclasses import dataclass, field

from .model import Abstain, ModelClient, prompt_sha256
from .prompts import extract_prompt
from .schemas import EXTRACT_SCHEMA, validate
from .verify import Accepted, Spec, verify


@dataclass
class ExtractResult:
    prompt_sha256: str
    mode: str
    abstained: str | None
    claims: list[dict] = field(default_factory=list)
    accepted: list[Spec] = field(default_factory=list)
    rejected: list[dict] = field(default_factory=list)
    usage: dict | None = None


def extract(text: str, doc_sha256: str, part_class: str, field_units: dict[str, str], rule_sentences: dict[str, str], model: ModelClient) -> ExtractResult:
    prompt = extract_prompt(text, doc_sha256, part_class, field_units, rule_sentences)
    result = ExtractResult(prompt_sha256("extract", prompt), getattr(model, "mode", "SCRIPTED"), None)
    response = model.propose("extract", prompt, EXTRACT_SCHEMA)
    calls = getattr(model, "calls", [])
    result.usage = calls[-1].usage if calls else None
    if isinstance(response, Abstain):
        result.abstained = response.reason
        return result
    error = validate(response, EXTRACT_SCHEMA)
    if error:
        result.abstained = f"schema violation: {error}"
        return result
    result.claims = list(response["specs"])
    for claim in result.claims:
        out = verify(text, claim, field_units=field_units)
        if isinstance(out, Accepted):
            result.accepted.append(out.spec)
        else:
            result.rejected.append({"claim": claim, "reason": out.reason, "detail": out.detail})
    return result
