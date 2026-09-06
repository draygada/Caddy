from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol

from .errors import OrderExecutionError, require
from .records import ConnectorKind, DeliveryOutcome, DispatchRequest, ExecutionMode


@dataclass(frozen=True)
class DispatchAuthority:
    grant_id: str
    candidate_id: str
    connector_id: str
    external_send: bool


@dataclass(frozen=True)
class ExternalConnectorConfiguration:
    enabled: bool = False
    endpoint_ref: Optional[str] = None


@dataclass(frozen=True)
class ConnectorResult:
    outcome: DeliveryOutcome
    connector_reference: Optional[str]
    detail_code: str


class OrderConnector(Protocol):
    kind: ConnectorKind
    connector_id: str
    execution_mode: ExecutionMode

    def dispatch(self, request: DispatchRequest, authority: Optional[DispatchAuthority]) -> ConnectorResult:
        ...


@dataclass
class RecordingConnector:
    """Deterministic test adapter. It performs no external I/O."""

    outcome: DeliveryOutcome = DeliveryOutcome.ACKNOWLEDGED
    connector_reference: Optional[str] = "recording:receipt:1"
    detail_code: str = "RECORDED_SIMULATION"
    connector_id: str = "recording:v1"
    calls: list[str] = field(default_factory=list)
    kind: ConnectorKind = field(default=ConnectorKind.RECORDING, init=False)
    execution_mode: ExecutionMode = field(default=ExecutionMode.RECORDING_ONLY, init=False)

    def dispatch(self, request: DispatchRequest, authority: Optional[DispatchAuthority]) -> ConnectorResult:
        del authority
        self.calls.append(request.request_id)
        return ConnectorResult(self.outcome, self.connector_reference, self.detail_code)


class _DisabledExternalConnector:
    execution_mode = ExecutionMode.EXTERNAL

    def __init__(self, connector_id: str, configuration: Optional[ExternalConnectorConfiguration] = None) -> None:
        self.connector_id = connector_id
        self.configuration = configuration or ExternalConnectorConfiguration()

    def dispatch(self, request: DispatchRequest, authority: Optional[DispatchAuthority]) -> ConnectorResult:
        require(self.configuration.enabled, "CONNECTOR_DISABLED", "real connector is disabled by configuration", connector_id=self.connector_id)
        require(bool(self.configuration.endpoint_ref), "CONNECTOR_NOT_CONFIGURED", "real connector has no endpoint reference", connector_id=self.connector_id)
        require(authority is not None and authority.external_send, "EXTERNAL_SEND_NOT_AUTHORIZED", "real order send requires explicit authority", connector_id=self.connector_id)
        require(authority.candidate_id == request.candidate.candidate_id, "AUTHORITY_SCOPE_MISMATCH", "send authority does not cover this candidate")
        require(authority.connector_id == self.connector_id, "AUTHORITY_SCOPE_MISMATCH", "send authority does not cover this connector")
        raise OrderExecutionError("CONNECTOR_IMPLEMENTATION_UNAVAILABLE", "live transport is intentionally absent; no external I/O occurred", connector_id=self.connector_id)


class EDIConnector(_DisabledExternalConnector):
    kind = ConnectorKind.EDI


class APIConnector(_DisabledExternalConnector):
    kind = ConnectorKind.API


class EmailLikeConnector(_DisabledExternalConnector):
    kind = ConnectorKind.EMAIL_LIKE
