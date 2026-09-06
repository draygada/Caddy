"""Strict public request and response models for CAD authoring candidate v1."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point2(StrictModel):
    x: float
    y: float


class Vector3(StrictModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class LineEntity(StrictModel):
    kind: Literal["LINE"] = "LINE"
    entity_id: str = Field(min_length=1)
    start: Point2
    end: Point2


class ArcEntity(StrictModel):
    kind: Literal["ARC"] = "ARC"
    entity_id: str = Field(min_length=1)
    start: Point2
    mid: Point2
    end: Point2


class CircleEntity(StrictModel):
    kind: Literal["CIRCLE"] = "CIRCLE"
    entity_id: str = Field(min_length=1)
    center: Point2
    radius: float = Field(gt=0)


SketchEntity = LineEntity | ArcEntity | CircleEntity


class SketchLoop(StrictModel):
    loop_id: str = Field(min_length=1)
    entities: list[SketchEntity] = Field(min_length=1)


class SketchConstraint(StrictModel):
    constraint_id: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    entity_ids: list[str] = Field(default_factory=list)
    point_refs: list[str] = Field(default_factory=list)
    value: float | None = None


class Sketch(StrictModel):
    sketch_id: str = Field(min_length=1)
    plane: Literal["XY", "XZ", "YZ"]
    origin: Vector3 = Field(default_factory=Vector3)
    loops: list[SketchLoop] = Field(min_length=1)
    constraints: list[SketchConstraint] = Field(default_factory=list)


class Feature(StrictModel):
    feature_id: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    depends_on: list[str] = Field(default_factory=list)
    output_body_id: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class CadDocument(StrictModel):
    schema_version: Literal["caddydaddy.cad-document/1"] = "caddydaddy.cad-document/1"
    document_id: str = Field(min_length=1)
    parent_revision_id: str | None = None
    units: Literal["mm"] = "mm"
    sketches: list[Sketch] = Field(default_factory=list)
    features: list[Feature] = Field(min_length=1)
    metadata: dict[str, str] = Field(default_factory=dict)


class RecomputeRequest(StrictModel):
    schema_version: Literal["caddydaddy.recompute-request/1"] = "caddydaddy.recompute-request/1"
    expected_base_revision_id: str | None = None
    base_document: CadDocument | None = None
    candidate_document: CadDocument
    linear_deflection_mm: float = Field(default=0.25, gt=0)
    angular_deflection_deg: float = Field(default=15.0, gt=0, le=90)

    @model_validator(mode="after")
    def paired_base(self) -> "RecomputeRequest":
        if (self.base_document is None) != (self.expected_base_revision_id is None):
            raise ValueError("base_document and expected_base_revision_id must be supplied together")
        return self


class TransformSpec(StrictModel):
    translation: Vector3 = Field(default_factory=Vector3)
    rotation_axis: Vector3 = Field(default_factory=lambda: Vector3(z=1.0))
    rotation_degrees: float = 0.0


class AssemblyInstance(StrictModel):
    instance_id: str = Field(min_length=1)
    body_id: str = Field(min_length=1)
    source_revision_id: str = Field(min_length=1)
    brep_base64: str = Field(min_length=1)
    transform: TransformSpec = Field(default_factory=TransformSpec)


class AssemblyMate(StrictModel):
    mate_id: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    moving_instance_id: str
    target_instance_id: str | None = None
    moving_point: Vector3 = Field(default_factory=Vector3)
    target_point: Vector3 = Field(default_factory=Vector3)
    moving_axis: Vector3 = Field(default_factory=lambda: Vector3(z=1.0))
    target_axis: Vector3 = Field(default_factory=lambda: Vector3(z=1.0))
    distance_mm: float = 0.0


class AssemblyRequest(StrictModel):
    schema_version: Literal["caddydaddy.assembly-request/1"] = "caddydaddy.assembly-request/1"
    assembly_id: str = Field(min_length=1)
    instances: list[AssemblyInstance] = Field(min_length=1)
    mates: list[AssemblyMate] = Field(default_factory=list)
    linear_deflection_mm: float = Field(default=0.25, gt=0)
    angular_deflection_deg: float = Field(default=15.0, gt=0, le=90)


class ExchangeRequest(StrictModel):
    schema_version: Literal["caddydaddy.exchange-request/1"] = "caddydaddy.exchange-request/1"
    request_id: str = Field(min_length=1)
    direction: Literal["IMPORT", "EXPORT"]
    format: str = Field(min_length=1)
    content_base64: str = Field(min_length=1)
    source_revision_id: str | None = None
    step_schema: Literal["AP242"] = "AP242"
    binary_stl: bool = True
    linear_deflection_mm: float = Field(default=0.25, gt=0)
    angular_deflection_deg: float = Field(default=15.0, gt=0, le=90)


class Diagnostic(StrictModel):
    code: str
    severity: Literal["INFO", "WARNING", "ERROR"]
    message: str
    feature_id: str | None = None


class Mesh(StrictModel):
    positions: list[float]
    normals: list[float]
    indices: list[int]
    triangle_count: int


class BodyResult(StrictModel):
    body_id: str
    producing_feature_id: str
    brep_base64: str
    brep_sha256: str
    valid: bool
    bounds_mm: list[float]
    topology: dict[str, int]
    area_mm2: float
    volume_mm3: float
    mesh: Mesh


class RecomputeResponse(StrictModel):
    schema_version: Literal["caddydaddy.recompute-result/1"] = "caddydaddy.recompute-result/1"
    status: Literal["SUCCEEDED"] = "SUCCEEDED"
    document_id: str
    revision_id: str
    parent_revision_id: str | None
    document_hash: str
    geometry_hash: str
    kernel: dict[str, str]
    constraint_mode: Literal["VALIDATE_ONLY"] = "VALIDATE_ONLY"
    operation_status: dict[str, Literal["SUCCEEDED", "DISABLED"]]
    bodies: list[BodyResult]
    diagnostics: list[Diagnostic]


class InstanceResult(StrictModel):
    instance_id: str
    body_id: str
    world_matrix4x4_row_major: list[float]
    bounds_mm: list[float]


class AssemblyResponse(StrictModel):
    schema_version: Literal["caddydaddy.assembly-result/1"] = "caddydaddy.assembly-result/1"
    status: Literal["SUCCEEDED"] = "SUCCEEDED"
    assembly_id: str
    assembly_revision_id: str
    geometry_hash: str
    instances: list[InstanceResult]
    assembly_body: BodyResult
    diagnostics: list[Diagnostic]


class ExchangeResponse(StrictModel):
    schema_version: Literal["caddydaddy.exchange-result/1"] = "caddydaddy.exchange-result/1"
    status: Literal["SUCCEEDED"] = "SUCCEEDED"
    request_id: str
    direction: Literal["IMPORT", "EXPORT"]
    format: Literal["STEP", "IGES", "STL"]
    exact_geometry: bool
    editable_brep: bool
    content_base64: str
    content_sha256: str
    brep_base64: str | None
    bounds_mm: list[float]
    topology: dict[str, int]
    verification: list[dict[str, Any]]
    diagnostics: list[Diagnostic]
