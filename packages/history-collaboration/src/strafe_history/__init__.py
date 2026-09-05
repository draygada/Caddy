"""History and collaboration primitives for Strafe Forge.

The public cross-lane adapters are intentionally kept in their own modules.  The
canonical JSON, immutable object store, and append-only event log exposed here do
not assign geometry authority.
"""

from .canonical import canonical_bytes, canonical_text, digest_json, parse_json
from .errors import DiagnosticError
from .events import AppendOnlyEventLog, HistoryEvent
from .storage import ImmutableObjectStore
from .authorization import AuthorizationLedger
from .branches import BranchProjection, EventSourcedBranches
from .metadata import MetadataStream
from .merge_policy import ChangeFootprint, MergeAssessment, MergeConflict, assess_merge
from .safety import validate_persistence_safety
from .reviews import ReviewLedger
from .dispatch import DispatchOutcome, SimulatedDispatchInterruption, SyntheticDispatchJournal
from .revisions import RevisionPointer, RevisionSnapshotStore

__all__ = [
    "AppendOnlyEventLog",
    "AuthorizationLedger",
    "BranchProjection",
    "ChangeFootprint",
    "DiagnosticError",
    "DispatchOutcome",
    "EventSourcedBranches",
    "HistoryEvent",
    "ImmutableObjectStore",
    "MetadataStream",
    "MergeAssessment",
    "MergeConflict",
    "ReviewLedger",
    "RevisionPointer",
    "RevisionSnapshotStore",
    "SimulatedDispatchInterruption",
    "SyntheticDispatchJournal",
    "canonical_bytes",
    "canonical_text",
    "digest_json",
    "assess_merge",
    "parse_json",
    "validate_persistence_safety",
]
