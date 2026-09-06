from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS = (
    REPO_ROOT / "apps/cad-service/README.md",
    REPO_ROOT / "apps/cad-service/THIRD_PARTY_NOTICES.md",
    REPO_ROOT / "apps/cad-service/REDISTRIBUTION_EVIDENCE.md",
    REPO_ROOT / "packages/cad-contracts/ADOPTION.md",
)
REQUIRED_RELEASE_CLOSURE = (
    "licenses/**",
    "THIRD_PARTY_NOTICES.md",
    "REDISTRIBUTION_EVIDENCE.md",
)


def test_release_documents_share_evidence_and_legal_status() -> None:
    for path in DOCS:
        text = path.read_text(encoding="utf-8")
        assert "Artifact evidence: **PASS**" in text
        assert "Legal determination: **NOT_PERFORMED**" in text


def test_every_release_document_requires_the_complete_closure() -> None:
    for path in DOCS:
        text = path.read_text(encoding="utf-8")
        for required in REQUIRED_RELEASE_CLOSURE:
            assert required in text


def test_adoption_docs_do_not_retain_validation_only_solver_claim() -> None:
    stale_claim = "Constraints are checked against authored coordinates"
    for path in (DOCS[0], DOCS[3]):
        text = path.read_text(encoding="utf-8")
        assert stale_claim not in text
        assert "bounded" in text.lower()
        assert "degree-of-freedom" in text
        assert "heuristic" in text.lower()
