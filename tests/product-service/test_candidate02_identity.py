from __future__ import annotations

from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[2]
for source in (
    REPO / "apps" / "product-service",
    REPO / "packages" / "compliance-bridge",
):
    sys.path.insert(0, str(source))

from product_service.app import (  # noqa: E402
    CANDIDATE02_POST_ROUTES,
    RELEASE_CANDIDATE_ID,
    RELEASE_CANDIDATE_VERSION,
    RELEASE_REVISION_ID,
    CandidateRuntime,
    CandidateState,
)


def _runtime() -> CandidateRuntime:
    legacy_public = {
        "candidate": {
            "id": "candidate:0.1",
            "version": "0.1",
            "status": "CANDIDATE_0_1_RUNTIME",
            "claim": "Legacy claim",
        },
        "capabilities": {
            "authoring": False,
            "recompute": False,
            "import": False,
            "export": False,
            "regulatoryClassification": False,
            "ordering": False,
        },
        "document": {
            "revisionId": "revision:caddydaddy-candidate-0.1",
            "complianceBindings": {"entity:legacy": {"request": {"entity_id": "entity:legacy"}}},
            "scene": {
                "revisionId": "revision:caddydaddy-candidate-0.1",
                "nodes": [{"metadata": {"sourceRevisionId": "revision:caddydaddy-candidate-0.1"}}],
            },
        },
        "forgeRevision": {"revision_id": "revision:caddydaddy-candidate-0.1"},
        "history": [{"revisionId": "revision:caddydaddy-candidate-0.1"}],
        "kernelProvenance": {"platformImage": "fixture"},
        "snapshotProvenance": {"coreExecutedAtRuntime": False},
        "sourcingRound": {"sourceRevisionId": "revision:caddydaddy-candidate-0.1"},
        "states": {
            "current": {
                "displayedRevisionId": "revision:caddydaddy-candidate-0.1",
                "requestedRevisionId": "revision:caddydaddy-candidate-0.1",
            }
        },
    }
    state = CandidateState(
        public=legacy_public,
        revision={},
        bindings={},
        records={},
        integrity_hash="a" * 64,
        snapshot_receipt={"document_sha256": "b" * 64},
    )
    runtime = object.__new__(CandidateRuntime)
    runtime.state = state
    return runtime


def test_candidate_endpoint_has_one_canonical_candidate02_identity() -> None:
    body = _runtime().candidate()

    assert body["candidate"]["id"] == RELEASE_CANDIDATE_ID
    assert body["candidate"]["version"] == RELEASE_CANDIDATE_VERSION
    assert body["candidate"]["revisionId"] == RELEASE_REVISION_ID
    assert body["releaseIdentity"]["candidateId"] == RELEASE_CANDIDATE_ID
    assert body["releaseIdentity"]["candidateVersion"] == RELEASE_CANDIDATE_VERSION
    assert body["releaseIdentity"]["revisionId"] == RELEASE_REVISION_ID
    assert body["document"]["revisionId"] == RELEASE_REVISION_ID
    assert body["document"]["scene"]["revisionId"] == RELEASE_REVISION_ID
    assert body["document"]["scene"]["nodes"][0]["metadata"]["sourceRevisionId"] == RELEASE_REVISION_ID
    assert body["forgeRevision"]["revision_id"] == RELEASE_REVISION_ID
    assert body["history"][0]["revisionId"] == RELEASE_REVISION_ID
    assert body["sourcingRound"]["sourceRevisionId"] == RELEASE_REVISION_ID
    assert body["states"]["current"]["displayedRevisionId"] == RELEASE_REVISION_ID
    assert body["states"]["current"]["requestedRevisionId"] == RELEASE_REVISION_ID
    assert body["document"]["evidenceRole"] == "LEGACY_CANDIDATE_0_1_TRIPWIRE_BINDING_PROJECTION"
    assert "sourceSnapshotIdentity" not in body


def test_current_capabilities_and_boundaries_are_explicit_and_honest() -> None:
    body = _runtime().candidate()
    capabilities = body["capabilities"]

    for key in (
        "authoring",
        "recompute",
        "import",
        "export",
        "classification",
        "sourcing",
        "provenance",
        "cadOutputs",
        "ordering",
    ):
        assert capabilities[key] is True

    assert capabilities["liveSupplierSend"] is False
    assert capabilities["govCloudAuthorized"] is False
    assert capabilities["cuiAuthorized"] is False

    contracts = body["capabilityContracts"]
    assert contracts["cadExchange"]["formats"] == ["STEP", "IGES", "STL"]
    assert contracts["cadExchange"]["editableExternalNativeHistoryRoundTrip"] is False
    assert contracts["classification"]["legalDetermination"] is False
    assert contracts["sourcingAndProvenance"]["fullCslScreening"] is False
    assert contracts["ordering"]["externalEffect"] == "NONE"

    boundaries = body["boundaryMetadata"]
    assert boundaries["cad"]["sketchSolver"] == "BOUNDED_GAUSS_NEWTON"
    assert boundaries["cad"]["assemblyMates"] == "BOUNDED_RIGID_RESOLUTION"
    assert boundaries["cad"]["topologyPersistence"].startswith("HEURISTIC_REMAP")
    assert boundaries["assurance"]["legalDetermination"] == "NOT_PERFORMED"
    assert boundaries["deployment"]["govCloudAuthorization"] == "NOT_CLAIMED"
    assert boundaries["deployment"]["cuiAuthorization"] == "NOT_CLAIMED"
    assert boundaries["continuity"] == {
        "model": "HASH_SEALED_CLIENT_CARRIED_STATE",
        "durableGlobalState": False,
        "authenticatedState": False,
        "globalReplayPrevention": False,
    }


def test_candidate01_snapshot_is_nested_as_non_authoritative_evidence() -> None:
    body = _runtime().candidate()
    legacy = body["legacySnapshotEvidence"]

    assert legacy["role"] == "IMMUTABLE_CANDIDATE_0_1_SOURCE_EVIDENCE_ONLY"
    assert legacy["immutable"] is True
    assert legacy["currentCapabilityAuthority"] is False
    assert legacy["candidateVersion"] == "0.1"
    assert legacy["revisionId"] == "revision:caddydaddy-candidate-0.1"
    assert legacy["publicSnapshot"]["candidate"]["version"] == "0.1"
    assert legacy["publicSnapshot"]["capabilities"]["authoring"] is False
    assert body["document"]["complianceBindings"] == legacy["publicSnapshot"]["document"]["complianceBindings"]
    assert len(CANDIDATE02_POST_ROUTES) == 22
