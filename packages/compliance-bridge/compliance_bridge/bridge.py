"""Minimal deterministic compliance bridge for Forge and imported Tripwire."""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, InvalidOperation
from functools import lru_cache
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from types import SimpleNamespace
from typing import Any, Callable, Mapping, Sequence

from jsonschema import Draft202012Validator, FormatChecker


_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_DIR = _REPO_ROOT / "packages" / "caddydaddy-contracts" / "schemas"
_TRIPWIRE_EVALUATOR = (
    _REPO_ROOT / "features" / "tripwire" / "backend" / "engine" / "evaluate.py"
)
_STABLE_ID = re.compile(r"^[A-Za-z][A-Za-z0-9._:/-]{0,255}$")
_SOURCE_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_SUPPORTED_LENGTH_CONVERSIONS = {("mm", "m"): Decimal("0.001")}


class ComplianceBridgeError(RuntimeError):
    """A fail-closed bridge rejection with a stable diagnostic code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        binding_receipt: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.binding_receipt = binding_receipt


def _canonical_json(value: Any) -> bytes:
    try:
        encoded = json.dumps(
            value,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    except (TypeError, ValueError) as exc:
        raise ComplianceBridgeError(
            "NON_CANONICAL_JSON", "value cannot be canonically encoded"
        ) from exc
    return encoded.encode("utf-8")


def canonical_sha256(value: Any) -> str:
    """Return a deterministic SHA-256 digest of canonical JSON data."""

    return hashlib.sha256(_canonical_json(value)).hexdigest()


def compute_node_id(
    product_thread_id: str,
    forge_record_id: str,
    occurrence_path: Sequence[str],
) -> str:
    """Hash only the three contract identity fields into a Tripwire node ID."""

    if not _STABLE_ID.fullmatch(product_thread_id):
        raise ComplianceBridgeError("INVALID_NODE_IDENTITY", "invalid product_thread_id")
    if not _STABLE_ID.fullmatch(forge_record_id):
        raise ComplianceBridgeError("INVALID_NODE_IDENTITY", "invalid forge_record_id")
    if isinstance(occurrence_path, (str, bytes)) or not occurrence_path:
        raise ComplianceBridgeError("INVALID_NODE_IDENTITY", "occurrence_path is required")
    path = list(occurrence_path)
    if any(not isinstance(part, str) or not _STABLE_ID.fullmatch(part) for part in path):
        raise ComplianceBridgeError("INVALID_NODE_IDENTITY", "invalid occurrence_path")
    preimage = {
        "product_thread_id": product_thread_id,
        "forge_record_id": forge_record_id,
        "occurrence_path": path,
    }
    return f"tripwire-node:{canonical_sha256(preimage)}"


def _hash_without(document: Mapping[str, Any], *field_names: str) -> str:
    unsigned = {key: deepcopy(value) for key, value in document.items() if key not in field_names}
    return canonical_sha256(unsigned)


def compute_projection_hash(compliance_input: Mapping[str, Any]) -> str:
    """Compute the input content hash, excluding its derived ID and hash fields."""

    return _hash_without(compliance_input, "projection_id", "projection_hash")


@lru_cache(maxsize=None)
def _schema_validator(filename: str) -> Draft202012Validator:
    with (_SCHEMA_DIR / filename).open("r", encoding="utf-8") as schema_file:
        schema = json.load(schema_file)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _validate_schema(document: Any, filename: str, code: str) -> None:
    errors = sorted(
        _schema_validator(filename).iter_errors(document),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if errors:
        error = errors[0]
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        raise ComplianceBridgeError(code, f"{location}: {error.message}")


def _verify_derived_identity(
    document: Mapping[str, Any],
    *,
    id_field: str,
    hash_field: str,
    id_prefix: str,
    code: str,
) -> None:
    expected_hash = _hash_without(document, id_field, hash_field)
    if document.get(hash_field) != expected_hash:
        raise ComplianceBridgeError(code, f"{hash_field} does not match content")
    if document.get(id_field) != f"{id_prefix}{expected_hash}":
        raise ComplianceBridgeError(code, f"{id_field} does not match content")


def _validate_units(compliance_input: Mapping[str, Any]) -> None:
    conversion = compliance_input["unit_conversion"]
    conversion_key = (
        conversion["source_length_unit"],
        conversion["target_length_unit"],
    )
    factor = _SUPPORTED_LENGTH_CONVERSIONS.get(conversion_key)
    if factor is None:
        raise ComplianceBridgeError(
            "UNSUPPORTED_UNIT_CONVERSION",
            f"unsupported conversion {conversion_key[0]}->{conversion_key[1]}",
        )
    if conversion["exact_factor"] != format(factor, "f"):
        raise ComplianceBridgeError("UNIT_FACTOR_MISMATCH", "top-level exact_factor is wrong")

    for node in compliance_input["nodes"]:
        for measurement in node["measurements"]:
            if measurement["exact_factor"] != conversion["exact_factor"]:
                raise ComplianceBridgeError(
                    "UNIT_FACTOR_MISMATCH",
                    f"measurement {measurement['name']} uses a different exact_factor",
                )
            try:
                source = Decimal(measurement["source_mm"])
                projected = Decimal(measurement["projected_m"])
            except InvalidOperation as exc:
                raise ComplianceBridgeError(
                    "UNIT_VALUE_INVALID", f"measurement {measurement['name']} is not decimal"
                ) from exc
            if source * factor != projected:
                raise ComplianceBridgeError(
                    "UNIT_VALUE_MISMATCH",
                    f"measurement {measurement['name']} is not an exact mm->m conversion",
                )


def _validate_nodes(
    compliance_input: Mapping[str, Any],
    current_records: Mapping[str, Mapping[str, Any]],
) -> None:
    product_thread_id = compliance_input["product_thread_id"]
    seen_records: set[str] = set()
    seen_nodes: set[str] = set()

    for node in compliance_input["nodes"]:
        identity = node["identity_preimage"]
        record_id = identity["forge_record_id"]
        if identity["product_thread_id"] != product_thread_id:
            raise ComplianceBridgeError(
                "WRONG_PRODUCT_THREAD", f"node {node['node_id']} crosses product threads"
            )
        expected_node_id = compute_node_id(
            product_thread_id, record_id, identity["occurrence_path"]
        )
        if node["node_id"] != expected_node_id:
            raise ComplianceBridgeError(
                "WRONG_NODE_ID", f"node ID does not match identity for {record_id}"
            )
        if record_id in seen_records or node["node_id"] in seen_nodes:
            raise ComplianceBridgeError("DUPLICATE_NODE", f"duplicate record or node {record_id}")
        seen_records.add(record_id)
        seen_nodes.add(node["node_id"])

        current_record = current_records.get(record_id)
        if current_record is None:
            raise ComplianceBridgeError("WRONG_RECORD", f"record {record_id} is not current")
        if list(current_record.get("occurrence_path", [])) != identity["occurrence_path"]:
            raise ComplianceBridgeError(
                "WRONG_OCCURRENCE", f"occurrence_path is not current for {record_id}"
            )
        if current_record.get("forge_record_revision_id") != node["forge_record_revision_id"]:
            raise ComplianceBridgeError(
                "STALE_RECORD_REVISION", f"record revision is stale for {record_id}"
            )

    if seen_records != set(current_records):
        raise ComplianceBridgeError(
            "RECORD_SET_MISMATCH", "input records do not exactly match current records"
        )
    for node in compliance_input["nodes"]:
        parent = node["parent_node_id"]
        if parent is not None and parent not in seen_nodes:
            raise ComplianceBridgeError(
                "WRONG_PARENT_NODE", f"parent {parent} is not in the bound input"
            )


def validate_compliance_input(compliance_input: Mapping[str, Any]) -> None:
    """Validate the input schema, content identity, node identities, and units."""

    _validate_schema(
        compliance_input,
        "compliance-input.v1.schema.json",
        "INPUT_SCHEMA_INVALID",
    )
    _verify_derived_identity(
        compliance_input,
        id_field="projection_id",
        hash_field="projection_hash",
        id_prefix="compliance-input:",
        code="INPUT_TAMPERED",
    )
    _validate_units(compliance_input)
    seen_nodes: set[str] = set()
    for node in compliance_input["nodes"]:
        identity = node["identity_preimage"]
        expected = compute_node_id(
            identity["product_thread_id"],
            identity["forge_record_id"],
            identity["occurrence_path"],
        )
        if node["node_id"] != expected:
            raise ComplianceBridgeError("WRONG_NODE_ID", "node ID does not match identity")
        if node["node_id"] in seen_nodes:
            raise ComplianceBridgeError("DUPLICATE_NODE", "node IDs must be unique")
        seen_nodes.add(node["node_id"])


def validate_observation(observation: Mapping[str, Any]) -> None:
    """Validate an observation schema and its derived content identity."""

    _validate_schema(
        observation,
        "compliance-observation.v1.schema.json",
        "OBSERVATION_SCHEMA_INVALID",
    )
    _verify_derived_identity(
        observation,
        id_field="observation_id",
        hash_field="observation_hash",
        id_prefix="compliance-observation:",
        code="OBSERVATION_TAMPERED",
    )


def validate_binding_receipt(receipt: Mapping[str, Any]) -> None:
    """Validate a binding receipt schema and its derived content identity."""

    _validate_schema(
        receipt,
        "compliance-binding-receipt.v1.schema.json",
        "RECEIPT_SCHEMA_INVALID",
    )
    _verify_derived_identity(
        receipt,
        id_field="receipt_id",
        hash_field="receipt_hash",
        id_prefix="compliance-binding-receipt:",
        code="RECEIPT_TAMPERED",
    )


@lru_cache(maxsize=1)
def _load_tripwire_evaluator() -> Callable[[Any, list[dict], dict], dict[str, dict]]:
    spec = importlib.util.spec_from_file_location(
        "caddydaddy_imported_tripwire_evaluate", _TRIPWIRE_EVALUATOR
    )
    if spec is None or spec.loader is None:
        raise ComplianceBridgeError(
            "TRIPWIRE_IMPORT_ERROR", "cannot load imported Tripwire evaluator"
        )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    evaluator = getattr(module, "evaluate", None)
    if not callable(evaluator):
        raise ComplianceBridgeError(
            "TRIPWIRE_IMPORT_ERROR", "imported Tripwire evaluate() is unavailable"
        )
    return evaluator


def _stamp_document(
    document: dict[str, Any], id_field: str, hash_field: str, prefix: str
) -> dict[str, Any]:
    digest = _hash_without(document, id_field, hash_field)
    document[hash_field] = digest
    document[id_field] = f"{prefix}{digest}"
    return document


def _input_ref(compliance_input: Mapping[str, Any]) -> dict[str, str]:
    return {
        "projection_id": compliance_input["projection_id"],
        "projection_hash": compliance_input["projection_hash"],
    }


def _observation_ref(observation: Mapping[str, Any]) -> dict[str, str]:
    return {
        "observation_id": observation["observation_id"],
        "observation_hash": observation["observation_hash"],
    }


def _build_receipt(
    compliance_input: Mapping[str, Any],
    *,
    recorded_at: str,
    observation: Mapping[str, Any] | None,
    diagnostic_code: str | None,
) -> dict[str, Any]:
    bound = observation is not None
    observation_ref = _observation_ref(observation) if observation is not None else None
    receipt: dict[str, Any] = {
        "schema_version": "caddydaddy.compliance-binding-receipt/1",
        "receipt_id": "",
        "receipt_hash": "",
        "recorded_at": recorded_at,
        "product_thread_id": compliance_input["product_thread_id"],
        "forge_revision_id": compliance_input["forge_revision"]["revision_id"],
        "binding_status": "BOUND" if bound else "BLOCKED_TRIPWIRE_FAILURE",
        "forge_recompute": {
            "state": "SUCCEEDED",
            "geometry_artifact_hash": compliance_input["forge_revision"][
                "geometry_artifact_hash"
            ],
            "diagnostic_code": None,
        },
        "tripwire": {
            "state": "SUCCEEDED" if bound else "FAILED",
            "input_ref": _input_ref(compliance_input),
            "observation_ref": observation_ref,
            "diagnostic_code": None if bound else diagnostic_code,
        },
        "current_observation_ref": observation_ref,
        "last_valid_observation_ref": observation_ref,
        "cad_mutation_effect": "NONE",
        "compliance_claim_gate": "HUMAN_REVIEW_REQUIRED" if bound else "BLOCKED",
        "rule_pack_state": "DRAFT_REVIEW_ONLY",
        "browser_role": "DISPLAY_ONLY",
    }
    _stamp_document(
        receipt,
        "receipt_id",
        "receipt_hash",
        "compliance-binding-receipt:",
    )
    validate_binding_receipt(receipt)
    return receipt


def _reject_tripwire(
    compliance_input: Mapping[str, Any],
    recorded_at: str,
    code: str,
    message: str,
) -> ComplianceBridgeError:
    receipt = _build_receipt(
        compliance_input,
        recorded_at=recorded_at,
        observation=None,
        diagnostic_code=code,
    )
    return ComplianceBridgeError(code, message, binding_receipt=receipt)


def _check_evaluator_output(
    evaluator_output: Any, expected_node_ids: set[str]
) -> dict[str, dict[str, Any]]:
    if not isinstance(evaluator_output, dict):
        raise ComplianceBridgeError(
            "TRIPWIRE_OUTPUT_INVALID", "evaluator output must be an object"
        )
    top_state = str(
        evaluator_output.get("evaluation_state", evaluator_output.get("status", ""))
    ).upper()
    if top_state in {"BLOCKED", "POLICY_BLOCKED"}:
        raise ComplianceBridgeError("TRIPWIRE_POLICY_BLOCKED", "evaluator policy blocked")
    if top_state in {"ERROR", "FAILED"} or evaluator_output.get("error"):
        raise ComplianceBridgeError("TRIPWIRE_EVALUATOR_ERROR", "evaluator reported failure")
    if set(evaluator_output) != expected_node_ids:
        raise ComplianceBridgeError(
            "TRIPWIRE_NODE_SET_MISMATCH",
            "evaluator output nodes do not exactly match the bound input",
        )
    for node_id, determination in evaluator_output.items():
        if not isinstance(determination, dict):
            raise ComplianceBridgeError(
                "TRIPWIRE_OUTPUT_INVALID", f"determination for {node_id} is not an object"
            )
        state = str(
            determination.get("evaluation_state", determination.get("status", ""))
        ).upper()
        if determination.get("policy_blocked") or state in {"BLOCKED", "POLICY_BLOCKED"}:
            raise ComplianceBridgeError(
                "TRIPWIRE_POLICY_BLOCKED", f"evaluator policy blocked {node_id}"
            )
        if determination.get("error") or state in {"ERROR", "FAILED"}:
            raise ComplianceBridgeError(
                "TRIPWIRE_EVALUATOR_ERROR", f"evaluator failed for {node_id}"
            )
    return evaluator_output


def _rule_ids(determination: Mapping[str, Any]) -> list[str]:
    identifiers: list[str] = []
    fired = determination.get("fired") or []
    if not isinstance(fired, list):
        return identifiers
    for item in fired:
        candidate: Any = item
        if isinstance(item, dict):
            candidate = item.get("rule_id", item.get("id"))
        if isinstance(candidate, str) and _STABLE_ID.fullmatch(candidate):
            identifiers.append(candidate)
    return sorted(set(identifiers))


def _finding(
    projection_hash: str,
    node_id: str,
    determination: Mapping[str, Any],
) -> dict[str, Any]:
    fired = _rule_ids(determination)
    has_trigger = bool(
        fired
        or determination.get("entries")
        or determination.get("contains_defense_article")
    )
    has_evidence = bool(
        determination.get("evidence_level") or determination.get("jurisdiction")
    )
    if has_trigger:
        outcome = "FLAGGED"
        reason_codes = ["TRIPWIRE_RULE_TRIGGERED", "DRAFT_REVIEW_ONLY"]
    elif not has_evidence:
        outcome = "INSUFFICIENT_EVIDENCE"
        reason_codes = ["TRIPWIRE_INSUFFICIENT_EVIDENCE", "DRAFT_REVIEW_ONLY"]
    else:
        outcome = "REVIEW_REQUIRED"
        reason_codes = ["TRIPWIRE_REVIEW_REQUIRED", "DRAFT_REVIEW_ONLY"]
    finding_digest = canonical_sha256(
        {
            "projection_hash": projection_hash,
            "node_id": node_id,
            "determination": determination,
        }
    )
    return {
        "finding_id": f"finding:{finding_digest}",
        "node_id": node_id,
        "outcome": outcome,
        "rule_ids": fired,
        "reason_codes": reason_codes,
    }


def _build_observation(
    compliance_input: Mapping[str, Any],
    evaluator_output: Mapping[str, Mapping[str, Any]],
    *,
    observed_at: str,
    source_commit: str,
) -> dict[str, Any]:
    findings = [
        _finding(compliance_input["projection_hash"], node["node_id"], evaluator_output[node["node_id"]])
        for node in compliance_input["nodes"]
    ]
    observation: dict[str, Any] = {
        "schema_version": "caddydaddy.compliance-observation/1",
        "observation_id": "",
        "observation_hash": "",
        "observed_at": observed_at,
        "producer": {
            "system": "TRIPWIRE",
            "runtime": "SERVER",
            "source_commit": source_commit,
        },
        "evaluation_state": "SUCCEEDED",
        "input_ref": _input_ref(compliance_input),
        "forge_revision_ref": {
            "revision_id": compliance_input["forge_revision"]["revision_id"],
            "content_hash": compliance_input["forge_revision"]["content_hash"],
        },
        "rule_pack": {
            "state": "DRAFT_REVIEW_ONLY",
            "content_hash": compliance_input["rule_pack"]["content_hash"],
        },
        "findings": findings,
        "review_requirement": "HUMAN_REVIEW_REQUIRED",
        "claim_ceiling": "REVIEW_SUPPORT_ONLY_NO_LEGAL_CONCLUSION",
        "legal_effect": "NONE",
    }
    _stamp_document(
        observation,
        "observation_id",
        "observation_hash",
        "compliance-observation:",
    )
    validate_observation(observation)
    if {finding["node_id"] for finding in observation["findings"]} != set(evaluator_output):
        raise ComplianceBridgeError(
            "OBSERVATION_NODE_SET_MISMATCH",
            "observation findings do not exactly bind evaluator nodes",
        )
    return observation


def evaluate_compliance(
    compliance_input: Mapping[str, Any],
    *,
    current_forge_revision: Mapping[str, Any],
    current_records: Mapping[str, Mapping[str, Any]],
    rules: list[dict],
    chart: dict,
    observed_at: str,
    source_commit: str,
    recorded_at: str | None = None,
) -> dict[str, Any]:
    """Validate, evaluate with Tripwire, and return a bound observation and receipt.

    Timestamps and source commit are explicit inputs so replay is deterministic. Evaluator
    failures and policy blocks raise ``ComplianceBridgeError`` carrying a validated blocked
    binding receipt.
    """

    validate_compliance_input(compliance_input)
    if not _SOURCE_COMMIT.fullmatch(source_commit):
        raise ComplianceBridgeError("SOURCE_COMMIT_INVALID", "source_commit must be 40 hex chars")
    if not isinstance(rules, list) or not all(isinstance(rule, dict) for rule in rules):
        raise ComplianceBridgeError("RULE_PACK_INVALID", "rules must be a list of objects")
    if not isinstance(chart, dict):
        raise ComplianceBridgeError("COUNTRY_CHART_INVALID", "chart must be an object")
    if canonical_sha256(rules) != compliance_input["rule_pack"]["content_hash"]:
        raise ComplianceBridgeError("RULE_PACK_TAMPERED", "rules do not match rule_pack hash")

    revision = compliance_input["forge_revision"]
    for field in (
        "revision_id",
        "content_hash",
        "recompute_state",
        "geometry_artifact_hash",
    ):
        if current_forge_revision.get(field) != revision[field]:
            raise ComplianceBridgeError(
                "STALE_FORGE_REVISION", f"forge_revision.{field} is not current"
            )
    _validate_nodes(compliance_input, current_records)

    receipt_time = recorded_at if recorded_at is not None else observed_at
    design = SimpleNamespace(
        nodes={
            node["node_id"]: deepcopy(node["tripwire_payload"])
            for node in compliance_input["nodes"]
        }
    )
    try:
        evaluator = _load_tripwire_evaluator()
        raw_output = evaluator(design, deepcopy(rules), deepcopy(chart))
        evaluator_output = _check_evaluator_output(
            raw_output, {node["node_id"] for node in compliance_input["nodes"]}
        )
        observation = _build_observation(
            compliance_input,
            evaluator_output,
            observed_at=observed_at,
            source_commit=source_commit,
        )
    except ComplianceBridgeError as exc:
        if exc.code.startswith("TRIPWIRE_") or exc.code.startswith("OBSERVATION_"):
            raise _reject_tripwire(
                compliance_input, receipt_time, exc.code, str(exc)
            ) from exc
        raise
    except Exception as exc:
        raise _reject_tripwire(
            compliance_input,
            receipt_time,
            "TRIPWIRE_EVALUATOR_ERROR",
            f"imported evaluator raised {type(exc).__name__}",
        ) from exc

    receipt = _build_receipt(
        compliance_input,
        recorded_at=receipt_time,
        observation=observation,
        diagnostic_code=None,
    )
    if receipt["tripwire"]["input_ref"] != observation["input_ref"]:
        raise ComplianceBridgeError("BINDING_MISMATCH", "receipt input_ref is not exact")
    if receipt["current_observation_ref"] != _observation_ref(observation):
        raise ComplianceBridgeError("BINDING_MISMATCH", "receipt observation_ref is not exact")
    if receipt["forge_revision_id"] != observation["forge_revision_ref"]["revision_id"]:
        raise ComplianceBridgeError("BINDING_MISMATCH", "receipt revision is not exact")

    return {
        "evaluator_output": deepcopy(evaluator_output),
        "observation": observation,
        "binding_receipt": receipt,
    }
