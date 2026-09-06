"""Fail-closed provider-neutral order execution boundary."""

from .connectors import (
    APIConnector,
    EDIConnector,
    EmailLikeConnector,
    ConnectorResult,
    DispatchAuthority,
    ExternalConnectorConfiguration,
    OrderConnector,
    RecordingConnector,
)
from .dispatcher import DispatchResult, OrderDispatcher
from .errors import OrderExecutionError
from .manifest import VerifiedManifest, verify_sealed_manifest
from .records import (
    AuditEvent,
    CandidateIdentity,
    ConnectorKind,
    DeliveryOutcome,
    DispatchReceipt,
    DispatchRequest,
    ExecutionMode,
    OrderState,
    RetryDisposition,
    SendEffect,
    verify_audit_chain,
    verify_record_hash,
)

__all__ = [
    "APIConnector", "AuditEvent", "CandidateIdentity", "ConnectorKind",
    "ConnectorResult", "DeliveryOutcome", "DispatchAuthority", "DispatchReceipt",
    "DispatchRequest", "DispatchResult", "EDIConnector", "EmailLikeConnector",
    "ExecutionMode", "ExternalConnectorConfiguration", "OrderConnector",
    "OrderDispatcher", "OrderExecutionError", "OrderState", "RecordingConnector",
    "RetryDisposition", "SendEffect", "VerifiedManifest", "verify_audit_chain",
    "verify_record_hash", "verify_sealed_manifest",
]
