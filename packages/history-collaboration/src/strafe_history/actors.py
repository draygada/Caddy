"""Actor identity and provenance validation.

These are history-lane records, not authentication.  A caller must bind an
actor to an authenticated principal outside this package before relying on a
human authorization.
"""

from __future__ import annotations

import copy
import re
from typing import Any, Dict, Optional

from .errors import DiagnosticError, require


ACTOR_KINDS = {"HUMAN", "AGENT", "SERVICE", "ADAPTER"}
SOURCE_KINDS = {
    "HUMAN_INPUT",
    "AGENT_EXECUTION",
    "SYSTEM_PROCESS",
    "SYNTHETIC_FIXTURE",
    "PUBLIC_SOURCE",
    "AUTHORIZED_ADAPTER",
}
_UTC_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$")


def validate_actor(actor: Any) -> Dict[str, Any]:
    require(isinstance(actor, dict), "ACTOR_INVALID", "actor must be an object")
    required = {"actor_id", "actor_kind", "display_name"}
    missing = sorted(required - set(actor.keys()))
    require(not missing, "ACTOR_FIELD_MISSING", "actor is missing required fields", missing=missing)
    require(isinstance(actor["actor_id"], str) and bool(actor["actor_id"]), "ACTOR_INVALID", "actor_id must be non-empty")
    require(actor["actor_kind"] in ACTOR_KINDS, "ACTOR_KIND_INVALID", "actor kind is unsupported")
    require(isinstance(actor["display_name"], str) and bool(actor["display_name"]), "ACTOR_INVALID", "display_name must be non-empty")
    if actor["actor_kind"] == "AGENT":
        require(
            isinstance(actor.get("execution_identity"), str) and bool(actor["execution_identity"]),
            "AGENT_EXECUTION_IDENTITY_MISSING",
            "agent actor requires an exact execution identity",
        )
    return copy.deepcopy(actor)


def provenance(
    actor: Dict[str, Any],
    source_kind: str,
    source_ref: str,
    observed_at: str,
    on_behalf_of: Optional[str] = None,
    authorization_ref: Optional[str] = None,
) -> Dict[str, Any]:
    checked = validate_actor(actor)
    require(source_kind in SOURCE_KINDS, "PROVENANCE_SOURCE_INVALID", "unsupported provenance source kind")
    require(isinstance(source_ref, str) and bool(source_ref), "PROVENANCE_INVALID", "source_ref must be non-empty")
    require(_UTC_TIMESTAMP.match(observed_at) is not None, "TIMESTAMP_INVALID", "observed_at must be UTC")
    value: Dict[str, Any] = {
        "actor_id": checked["actor_id"],
        "actor_kind": checked["actor_kind"],
        "source_kind": source_kind,
        "source_ref": source_ref,
        "observed_at": observed_at,
        "on_behalf_of": on_behalf_of,
        "authorization_ref": authorization_ref,
    }
    if checked["actor_kind"] == "AGENT":
        value["agent_execution_identity"] = checked["execution_identity"]
        value["model_identity"] = checked.get("model_identity")
    return value


def require_human(actor: Dict[str, Any], action: str) -> Dict[str, Any]:
    checked = validate_actor(actor)
    if checked["actor_kind"] != "HUMAN":
        raise DiagnosticError(
            "HUMAN_AUTHORIZATION_REQUIRED",
            "{0} requires a human actor; an agent proposal is not authorization".format(action),
            details={"actor_id": checked["actor_id"], "actor_kind": checked["actor_kind"]},
        )
    return checked

