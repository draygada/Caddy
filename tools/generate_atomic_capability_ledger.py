#!/usr/bin/env python3
"""Generate the immutable parent/atomic capability manifests.

The 69 researched rows are source lineage only.  Atomic leaves are candidate verdict units.
This generator is deterministic and intentionally initializes every leaf to HOLD.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DENOMINATOR = ROOT / "docs/research/capability-denominator.v1.json"
DECOMPOSITION = ROOT / "docs/research/atomic-capability-decomposition.v1.json"
LEDGER = ROOT / "docs/research/atomic-capability-ledger.v1.json"
AGGREGATE = ROOT / "docs/research/capability-aggregate-manifest.v1.json"
VECTORS = ROOT / "docs/research/atomic-capability-integrity.v1.json"

VERDICTS = {
    "NATIVE_IMPLEMENTED",
    "ADOPTED_IMPLEMENTED",
    "ADAPTER_IMPLEMENTED",
    "BOUNDARY_IMPLEMENTED",
    "HOLD",
    "FAILED",
}
POSITIVE = VERDICTS - {"HOLD", "FAILED"}


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def split_words(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").replace(".", " ").strip()).lower()


# Values are atomic behavior slugs.  Critical compound rows are deliberately explicit.
# Rows absent here use a deterministic comma/slash/conjunction split of the source title.
CUSTOM: dict[int, list[str]] = {
    1: [
        "INTAKE.RFQ", "INTAKE.DRAWING", "INTAKE.DOCUMENT", "INTAKE.MODEL",
        "INTAKE.SOURCE_HASH_PRESERVE", "INTAKE.HUMAN_CORRECTION",
    ],
    2: [
        "MR.SCENARIO_NEED", "MR.EFFECT_MOE", "MR.REQUIREMENT_REVISION", "MR.CONSTRAINT",
        "MR.ACCEPTANCE", "MR.VERIFICATION_METHOD", "MR.TRADE_RANKING",
        "MR.ASSUMPTION_UNKNOWN", "MR.DECISION", "SUP.SURGE", "SUP.REALLOCATE",
    ],
    3: [
        "MR.CAD_TRACE", "MR.ANALYSIS_TRACE", "MR.PRODUCT_TRACE", "MR.CHANGE_IMPACT",
        "SIM.MISSION_REQUIREMENT_STUDY_TRACE", "SIM.RESULT_SELECTION_TRACE",
        "SIM.DOWNSTREAM_VERIFICATION_TRACE", "COMPOSE.MISSION_TRADE_SELECTION_VERIFICATION",
    ],
    4: [
        "SUP.ITEM_ID", "SUP.ITEM_REVISION", "SUP.BOM_REVISION", "SUP.BOM_EXPLODE",
        "SUP.WHERE_USED", "SUP.BOM_EXPORT", "ASM.PRODUCT_STRUCTURE",
        "ASM.CONFIGURATION_IDENTITY", "ASM.PHYSICAL_BOM", "ASM.ITEM_REVISION_IDENTITY",
    ],
    5: [
        "SUP.MAKE_BUY", "SUP.APPROVED_ALTERNATIVE", "SUP.SYNTHETIC_SUPPLIER",
        "SUP.QUOTE_COST", "SUP.QUOTE_LEAD", "SUP.SOURCE_CONFIDENCE",
    ],
    6: [
        "MFG.PLAN_REVISION", "MFG.ROUTING_DAG", "MFG.RESOURCE_REQUIREMENT",
        "MFG.WORK_INSTRUCTION_INTENT", "MFG.INSPECTION_EXPECTATION", "MFG.CLOSED_LOOP_LINKS",
        "SUP.MATERIAL_DEMAND", "SUP.ROUTING_DEMAND", "SUP.RESOURCE_MASTER",
        "SUP.RESOURCE_CALENDAR", "SUP.CAPACITY_BUCKET", "SUP.ALLOCATION",
        "SUP.SHORTAGE_RISK", "MES.ORDER_BIND",
        "MES.TRAVELER_ISSUE", "MES.TRAVELER_IMMUTABLE", "MES.STATION_OPERATION_SNAPSHOT",
        "MES.WORK_INSTRUCTION_ISSUE", "MES.WORK_INSTRUCTION_ACK",
        "MES.RESOURCE_OBSERVE", "MES.TOOL_OBSERVE",
    ],
    7: [
        "MES.PRODUCTION_ORDER_EXECUTION_BIND", "MES.OPERATOR_AUTH", "MES.OP_READY",
        "MES.OP_START", "MES.OP_PASS", "MES.OP_FAIL", "MES.SERIAL_UNIT", "MES.MATERIAL_LOT",
        "MES.CONSUME", "MES.GENEALOGY_TRACE", "MES.WIP_DERIVE", "MES.FINAL_ASSEMBLY",
        "MES.NO_MACHINE_EXTERNAL",
    ],
    8: [
        "QUALITY.CHARACTERISTIC_BIND", "QUALITY.INSPECT", "QUALITY.TEST", "QUALITY.NC_OPEN",
        "QUALITY.FAILURE_PRESERVE", "QUALITY.DEVIATION_SCOPE", "QUALITY.REWORK_EXECUTE",
        "QUALITY.REINSPECT", "QUALITY.NC_CLOSE", "QUALITY.ACCEPT",
        "QUALITY.RELEASE_BLOCK", "QUALITY.RELEASE_ELIGIBLE", "QUALITY.REF_FAIL_CLOSED",
    ],
    9: [
        "MES.RELEASE_GATE_DECISION", "RELEASE.AUTHORIZATION", "RELEASE.PACKET",
        "RELEASE.IMMUTABLE", "RELEASE.GRAPH_BINDING", "DELIVERY.SYNTHETIC_RECEIPT",
    ],
    10: [
        "OPS.UNIT_IDENTITY", "OPS.CONFIG_BASELINE", "OPS.SYNTHETIC_OBSERVATION",
        "OPS.MAINTENANCE_EVENT", "OPS.FAILURE_FINDING", "OPS.CONFIDENCE_SOURCE",
        "OPS.AFFECTED_TRACE_LINKS", "OPS.TRIAGE", "OPS.CORRECTIVE_PROPOSAL",
        "OPS.IMPACT_ANALYSIS", "OPS.AUTHORIZED_CHANGE_PATH", "OPS.PRIOR_RELEASE_IMMUTABILITY",
        "OPS.AUDIT_REPLAY", "OPS.NO_ACTION_CLOSURE", "OPS.PRODUCT_BOUNDARY_GUARD",
        "MR.FEEDBACK_PROPOSAL",
    ],
    11: [
        "SKETCH.LINE", "SKETCH.ARC", "SKETCH.CIRCLE", "SKETCH.SPLINE", "SKETCH.TRIM",
        "SKETCH.EXTEND", "SKETCH.PROJECTION", "SKETCH.CONSTRUCTION_GEOMETRY",
    ],
    12: [
        "SOLVER.COINCIDENT", "SOLVER.HORIZONTAL", "SOLVER.VERTICAL", "SOLVER.PARALLEL",
        "SOLVER.PERPENDICULAR", "SOLVER.TANGENT", "SOLVER.EQUAL", "SOLVER.MIDPOINT",
        "SOLVER.SYMMETRIC", "SOLVER.FIX", "SOLVER.DISTANCE", "SOLVER.RADIUS",
        "SOLVER.DIAMETER",
        "SOLVER.ANGLE", "SOLVER.UNDER_CONSTRAINED_DOF", "SOLVER.FULLY_SOLVED",
        "SOLVER.REDUNDANT_SET", "SOLVER.CONTRADICTORY_SET", "SOLVER.DEGENERATE_GEOMETRY",
        "SOLVER.SOLVER_FAILURE", "SOLVER.INPUT_REORDER_DETERMINISM", "SOLVER.SCALE_EXTREMES",
        "SOLVER.CONFLICT_ID_ATTRIBUTION",
    ],
    13: [
        "SKETCH.LINEAR_PATTERN", "SKETCH.CIRCULAR_PATTERN", "SKETCH.ASSOCIATIVE_BLOCK",
        "SKETCH.EDITABLE_SPLINE", "SKETCH.THREE_D_SKETCH",
    ],
    15: [
        "PARAM.TYPED_VARIABLE", "PARAM.EXPRESSION_DEPENDENCY", "PARAM.DIMENSIONAL_VALIDATION",
        "PARAM.CYCLE_REJECTION", "PARAM.NONFINITE_REJECTION", "HISTORY.FEATURE_HISTORY",
        "HISTORY.SUPPRESS", "HISTORY.DEPENDENCY_SAFE_REORDER", "HISTORY.ROLLBACK",
        "HISTORY.CLEAN_REPLAY", "HISTORY.FAILED_RECOMPUTE_LAST_VALID",
    ],
    16: [
        "DIRECT.PLANAR_FACE_OFFSET", "DIRECT.FACE_TRANSLATE_ROTATE", "DIRECT.FACE_REPLACE",
        "DIRECT.FACE_DELETE_HEAL", "DIRECT.HISTORYLESS_BREP_EDIT",
    ],
    17: [
        "SURFACE.NURBS_SURFACE_CREATE", "SURFACE.TRIM", "SURFACE.EXTEND", "SURFACE.KNIT_SEW",
        "SURFACE.FILL", "SURFACE.THICKEN", "SURFACE.WATERTIGHT_GAP_CHECK",
        "SURFACE.CONTINUITY_G0", "SURFACE.CONTINUITY_G1", "SURFACE.CONTINUITY_G2",
    ],
    18: [
        "FREEFORM.SUBDIVISION_EDIT", "FREEFORM.TSPLINE_EDIT", "FREEFORM.CAGE_EDIT",
        "FREEFORM.BREP_CONVERSION", "FREEFORM.DOWNSTREAM_RECOMPUTE", "FREEFORM.FAILURE",
    ],
    19: [
        "MESH.INSPECT_STRUCTURAL_VALIDITY", "MESH.INSPECT_TOPOLOGY",
        "MESH.REPAIR_DEGENERATE_DUPLICATE", "MESH.REPAIR_ORIENTATION_HOLES",
        "MESH.REFERENCE_ATTACH", "MESH.MESH_TO_BREP_CONVERT",
        "MESH.POINT_CLOUD_REFERENCE_BOUNDARY", "MESH.REVERSE_ENGINEERING_ADAPTER_BOUNDARY",
    ],
    20: [
        "CONFIG.NAMED_IDENTITY", "CONFIG.PARAMETER_OVERRIDES", "CONFIG.FEATURE_SUPPRESSION",
        "CONFIG.COMPONENT_SUPPRESSION", "CONFIG.COMPONENT_STATE_OVERRIDES",
        "CONFIG.MODEL_STATE_IDENTITY", "CONFIG.VARIANT_RESOLUTION", "CONFIG.VARIANT_BOM",
        "CONFIG.RELEASE_IDENTITY",
    ],
    21: [
        "ASSEMBLY.DEFINITION_INSTANCE_SEPARATION", "ASSEMBLY.FIXED_RIGID_TRANSFORM",
        "ASSEMBLY.SUBASSEMBLY_DEFINITION_REUSE", "ASSEMBLY.HIERARCHY_RECONSTRUCTION",
        "ASSEMBLY.REVISION_PROVENANCE", "ASSEMBLY.BOTTOM_UP", "ASSEMBLY.TOP_DOWN_CONTEXT",
        "ASSEMBLY.SKELETAL_LAYOUT", "ASSEMBLY.IMPORTED_HIERARCHY",
        "ASSEMBLY.INSTANCE_SELECTION", "ASSEMBLY.DEFINITION_CYCLE_REJECTION",
        "ASSEMBLY.CORE_COMPOSITION_RECEIPT",
    ],
    22: [
        "RELATION.BOUNDARY", "RELATION.FIXED_GROUND_SOLVE", "RELATION.PLANE_COINCIDENT_SOLVE",
        "RELATION.AXIS_CONCENTRIC_SOLVE", "RELATION.DISTANCE_SOLVE", "RELATION.ANGLE_SOLVE",
        "RELATION.PARALLEL_SOLVE", "RELATION.PERPENDICULAR_SOLVE",
        "RELATION.UNDERCONSTRAINED_DIAGNOSTICS", "RELATION.CONFLICT_DIAGNOSTICS",
        "RELATION.LIMITS_JOINTS", "RELATION.SOLVER_PROVENANCE",
    ],
    23: [
        "MECHANISM.KINEMATIC_SWEEP", "MECHANISM.DRIVE", "MECHANISM.ANIMATE",
        "MECHANISM.SPRING", "MECHANISM.DAMPER", "MECHANISM.LOAD",
        "MECHANISM.SINGULARITY_DETECT", "MECHANISM.DYNAMICS_SEPARATION",
    ],
    24: [
        "ASSEMBLY.INTERFERENCE", "ASSEMBLY.CONTACT_CLEARANCE_CLASSIFICATION",
        "ASSEMBLY.MASS_PROPERTIES", "ASSEMBLY.EXPLODED_STATE", "ASSEMBLY.RECURSIVE_BOM",
        "ASSEMBLY.FLEXIBLE_SUBASSEMBLY", "ASSEMBLY.CONFIGURATION_CORRECTNESS",
        "ASSEMBLY.LAST_VALID_ANALYSIS", "ASSEMBLY.OCCURRENCE_VISIBILITY",
        "ASSEMBLY.BOM_EXCLUSION",
    ],
    25: [
        "LARGE_ASSEMBLY.LOAD", "LARGE_ASSEMBLY.SIMPLIFICATION", "LARGE_ASSEMBLY.ROTATE",
        "LARGE_ASSEMBLY.SELECT", "LARGE_ASSEMBLY.UPDATE", "LARGE_ASSEMBLY.MEMORY_ENVELOPE",
        "LARGE_ASSEMBLY.DEFERRED_STRUCTURE_COMPLETENESS",
    ],
    26: [
        "DRAWING.DOCUMENT_BOUNDARY", "DRAWING.MODEL_LINK", "DRAWING.BASE_VIEW",
        "DRAWING.PROJECTED_VIEW", "DRAWING.SECTION_VIEW", "DRAWING.DETAIL_VIEW",
        "DRAWING.HLR_ADAPTER", "DRAWING.DIMENSIONS", "DRAWING.ANNOTATIONS",
        "DRAWING.PARTS_LIST", "DRAWING.BALLOONS", "DRAWING.TITLE_BLOCK",
        "DRAWING.REVISION_BLOCK", "DRAWING.ASSOCIATIVE_REBUILD", "DRAWING.PDF_EXPORT",
        "DRAWING.DXF_SHEET_EXPORT", "DRAWING.DWG_EXPORT",
    ],
    27: [
        "PMI.DATUMS", "PMI.FEATURE_CONTROL_FRAME", "PMI.SURFACE_FINISH", "PMI.WELD_SYMBOL",
        "PMI.STANDARDS_VALIDATION", "PMI.GRAPHICAL_DISPLAY",
    ],
    28: [
        "MBD.AUTHORED_SEMANTIC_PMI", "MBD.PRESERVED_SEMANTIC_PMI_IMPORT",
        "MBD.PRESERVED_GRAPHIC_PMI_IMPORT", "MBD.AP242_PMI_EXPORT",
        "MBD.INSPECTION_CHARACTERISTICS", "MBD.TOLERANCE_ANALYSIS",
    ],
    29: [
        "SHEET_METAL.SINGLE_BEND_DEVELOP", "SHEET_METAL.FLAT_POLYGON",
        "SHEET_METAL.MULTIBEND_REFOLD", "SHEET_METAL.BEND_RULE", "SHEET_METAL.BEND_TABLE",
        "SHEET_METAL.CORNER_RELIEF", "SHEET_METAL.GRAIN_DIRECTION",
        "SHEET_METAL.DXF_EXPORT", "SHEET_METAL.DXF_ROUND_TRIP",
    ],
    30: [
        "FRAME.MEMBER_LENGTH", "FRAME.CUT_LIST", "FRAME.WELD_JOINT_INTENT", "FRAME.MITER",
        "FRAME.TRIM", "FRAME.COPE", "FRAME.END_PREP", "FRAME.SKELETON_RECOMPUTE",
        "FRAME.STRUCTURAL_QUALIFICATION",
    ],
    31: [
        "MOLD.DRAFT_ANALYSIS", "MOLD.UNDERCUT_ANALYSIS", "MOLD.PARTING", "MOLD.CORE",
        "MOLD.CAVITY", "MOLD.RUNNER", "MOLD.COOLING", "MOLD.PLASTICS_ANALYSIS",
    ],
    32: [
        "ROUTE.TUBE", "ROUTE.PIPE", "ROUTE.HOSE", "ROUTE.DUCT", "ROUTE.FITTING",
        "ROUTE.MIN_RADIUS_VALIDATE", "ROUTE.CUT_LENGTH", "ROUTE.ROUTE_BOM",
        "MFG.ROUTE_REQUIREMENT_LINK", "ROUTE.PATH_CHANGE_CONFLICT",
        "ROUTE.NATIVE_AUTO_ROUTING",
    ],
    33: [
        "HARNESS.CABLE", "HARNESS.HARNESS", "HARNESS.ELECTRICAL_ROUTE", "HARNESS.CONNECTOR",
        "HARNESS.PIN_CONNECTIVITY", "HARNESS.WIRE_LENGTH", "HARNESS.BUNDLE",
        "HARNESS.SHIELDING", "HARNESS.ROUTE_BOM", "HARNESS.NAILBOARD",
    ],
    35: [
        "NATIVE_REFERENCE.RESOLVE", "NATIVE_REFERENCE.UPDATE",
    ],
    36: [
        "DXF.IMPORT", "DXF.EXPORT", "DWG.IMPORT", "DWG.EXPORT",
        "DXF.PROFILE_VALIDATE", "DXF.ROUND_TRIP",
    ],
    37: [
        "STL.ASCII_IMPORT", "STL.ASCII_EXPORT", "STL.BINARY_IMPORT", "STL.BINARY_EXPORT",
        "OBJ.IMPORT_GEOMETRY", "OBJ.EXPORT_GEOMETRY",
        "OBJ.IMPORT_GROUP_OBJECT_NAMES", "OBJ.EXPORT_GROUP_OBJECT_NAMES",
        "OBJ.IMPORT_MTL_REFERENCES", "OBJ.EXPORT_MTL_REFERENCES",
        "BREP.TESSELLATION", "MESH.ROUND_TRIP",
    ],
    39: [
        "GLTF.EXPORT", "GLTF.BROWSER_VIEW", "GLB.EXPORT", "GLB.BROWSER_VIEW",
        "USDZ.EXPORT", "USDZ.BROWSER_VIEW", "AR.DEVICE_VIEW", "VR.DEVICE_VIEW",
    ],
    40: [
        "RENDER.SCENE", "RENDER.PBR", "RENDER.RAY_TRACE", "RENDER.ANIMATION",
        "RENDER.TECHNICAL_COMMUNICATION", "RENDER.SOURCE_REVISION_LINK",
        "RENDER.CONTEXT_LOSS_RECOVERY",
    ],
    41: [
        "MFG.SETUP_STOCK", "MFG.WORKHOLDING_ENVELOPE", "MFG.TOOL_REQUIREMENT",
        "MFG.FEEDS", "MFG.SPEEDS", "MFG.REST_MATERIAL", "MFG.GOUGE_CHECK", "MFG.TWO_D_MILLING",
        "MFG.TWO_POINT_FIVE_D_MILLING", "MFG.THREE_AXIS_MILLING", "MFG.DRILLING",
        "MFG.TOOLPATH_SIMULATION", "MFG.POST_IDENTITY", "MFG.NC_EXPORT",
        "MFG.PHYSICAL_QUALIFIED_VALIDATION",
    ],
    42: [
        "MFG.THREE_PLUS_TWO_MACHINING", "MFG.FOUR_AXIS_MACHINING", "MFG.FIVE_AXIS_MACHINING",
        "MFG.SINGULARITY_LIMITS", "MFG.RETRACT_REWIND", "MFG.FIXTURE_COLLISION",
        "MFG.POST_QUALIFICATION", "MFG.NC_EXPORT", "MFG.PHYSICAL_QUALIFIED_VALIDATION",
    ],
    43: [
        "MFG.TURNING", "MFG.MILL_TURN", "MFG.SWISS", "MFG.SPINDLE_CHANNEL_SYNC",
        "MFG.STOCK_TRANSFER", "MFG.HOLDER_COLLISION", "MFG.POST_QUALIFICATION",
        "MFG.NC_EXPORT", "MFG.PHYSICAL_QUALIFIED_VALIDATION",
    ],
    44: [
        "MFG.ORIENTATION", "MFG.SUPPORT_CANDIDATES", "MFG.SLICING", "MFG.INFILL",
        "MFG.ADDITIVE_TOOLPATH", "MFG.NESTING", "MFG.PROCESS_SIMULATION", "MFG.BUILD_FILE",
        "MFG.MACHINE_LIBRARY", "MFG.MACHINE_OUTPUT",
    ],
    45: [
        "MFG.TWO_D_NESTING", "MFG.THREE_D_NESTING", "MFG.ORIENTATION_GRAIN",
        "MFG.SPACING", "MFG.UTILIZATION", "MFG.REMNANT", "MFG.DXF_HANDOFF", "MFG.NC_HANDOFF",
    ],
    46: [
        "MFG.PROBE_QUALIFICATION", "MFG.PART_ALIGNMENT", "MFG.WORK_OFFSET",
        "MFG.CHARACTERISTIC_LINK", "MFG.UNCERTAINTY", "MFG.ACTUAL_CAPTURE",
        "MFG.MANUAL_INSPECTION", "MFG.CMM_INSPECTION", "MFG.ON_MACHINE_INSPECTION",
    ],
    47: [
        "MFG.TOOLPATH_PREVIEW", "MFG.MATERIAL_REMOVAL_SIMULATION", "MFG.MACHINE_KINEMATICS",
        "MFG.TOOL_COLLISION", "MFG.HOLDER_COLLISION", "MFG.FIXTURE_COLLISION",
        "MFG.POST_QUALIFICATION", "MFG.NC_EMISSION", "MFG.PHYSICAL_QUALIFIED_VALIDATION",
        "MFG.MACHINE_CONTROL_PROHIBITION",
    ],
    56: [
        "ECAD.DOCUMENT_NORMALIZE", "ECAD.KICAD_BOARD_OUTLINE_IMPORT",
        "ECAD.KICAD_KEEPOUT_IMPORT", "ECAD.KICAD_PLACEMENT_IMPORT",
        "ECAD.KICAD_CONNECTOR_PIN_IMPORT", "ECAD.KICAD_NATIVE_AUTHORING",
        "ECAD.SCHEMATIC_AUTHOR", "ECAD.PCB_AUTHOR", "ECAD.PCB_ROUTE", "ECAD.LIBRARY_RESOLVE",
        "ECAD.DRC", "ECAD.GERBER_EXPORT", "ECAD.DRILL_EXPORT", "ECAD.BOM_EXPORT",
        "ECAD.ASSEMBLY_OUTPUT_EXPORT",
    ],
    57: [
        "ECAD.SPICE.SETUP", "ECAD.SPICE.SOLVE", "ECAD.SPICE.POSTPROCESS", "ECAD.SPICE.BENCHMARK",
        "ECAD.SIGNAL_INTEGRITY.SETUP", "ECAD.SIGNAL_INTEGRITY.SOLVE",
        "ECAD.SIGNAL_INTEGRITY.POSTPROCESS", "ECAD.SIGNAL_INTEGRITY.BENCHMARK",
    ],
    58: [
        "ECAD.STEP_MECHANICAL_LINK", "ECAD.CHANGE_PROPOSE", "ECAD.CHANGE_APPLY",
        "ECAD.CHANGE_CONFLICT", "ECAD.MCAD_TO_ECAD", "ECAD.ECAD_TO_MCAD",
        "ECAD.ENCLOSURE_HANDOFF", "ECAD.COOLING_HANDOFF", "ECAD.CLEARANCE_LINK",
        "ECAD.CLEARANCE_EVALUATE",
    ],
    59: [
        "HISTORY.AUTOMATIC_VERSION", "HISTORY.APPEND", "HISTORY.COMPARE", "HISTORY.RESTORE",
        "HISTORY.PARENT_PROVENANCE", "HISTORY.ARTIFACT_HASH_BINDING",
    ],
    60: [
        "COLLAB.BRANCH", "COLLAB.PROPOSE", "COLLAB.SEMANTIC_DIFF", "COLLAB.REVIEW",
        "COLLAB.MERGE", "COLLAB.DETERMINISTIC_REPLAY", "COLLAB.NONCOMMUTATIVE_CONFLICT",
        "COLLAB.STALE_BASE",
    ],
    61: [
        "PDM.IDENTITY", "PDM.PERMISSIONS", "PDM.SEARCH", "PDM.PART_NUMBERING",
        "PDM.WHERE_USED", "PDM.BOM_CONTROL", "PDM.TENANT_ISOLATION",
    ],
    62: [
        "LIFECYCLE.ECR", "LIFECYCLE.ECO", "LIFECYCLE.STATE", "LIFECYCLE.APPROVAL",
        "LIFECYCLE.RELEASE", "LIFECYCLE.PLM_API", "LIFECYCLE.ERP_API", "LIFECYCLE.MES_API",
        "LIFECYCLE.AUTHORIZATION", "LIFECYCLE.IDEMPOTENCY", "LIFECYCLE.PROVENANCE",
        "SUP.INVENTORY", "SUP.PURCHASE_ORDER", "SUP.WORK_ORDER_PLANNING",
        "SUP.AUTHORIZATION", "SUP.IDEMPOTENCY", "SUP.PROVENANCE",
        "SUP.INVENTORY_LIVE_BOUNDARY",
    ],
    63: [
        "COLLAB.PRESENCE", "COLLAB.COMMENTS", "COLLAB.MARKUP", "COLLAB.SHARE",
        "COLLAB.REVIEW", "COLLAB.TASKS", "COLLAB.CONCURRENT_GEOMETRY_EDIT",
        "COLLAB.OFFLINE_STALE_CLIENT", "COLLAB.CONFLICT_RECOVERY",
    ],
    64: [
        "API.PUBLIC", "API.WEBHOOK", "API.BATCH_CONVERSION", "API.HEADLESS_EXECUTION",
        "API.AUTH_SCOPE", "API.IDEMPOTENCY", "API.RATE_ERROR_SEMANTICS", "API.RUNTIME_PIN",
    ],
    65: [
        "EXTENSION.SCRIPT", "EXTENSION.MACRO", "EXTENSION.CUSTOM_FEATURE", "EXTENSION.RULE",
        "EXTENSION.PLUGIN", "EXTENSION.EXTENSION", "EXTENSION.SANDBOX",
        "EXTENSION.PERMISSION_MANIFEST", "EXTENSION.MIGRATION", "EXTENSION.FAILURE_ISOLATION",
    ],
    66: [
        "CLIENT.BROWSER_AUTHOR", "CLIENT.BROWSER_REVIEW", "CLIENT.MOBILE_REVIEW",
        "CLIENT.MOBILE_AUTHOR", "CLIENT.DESKTOP_AUTHOR",
    ],
    67: [
        "RELIABILITY.OFFLINE_WORK", "RELIABILITY.AUTOSAVE", "RELIABILITY.CRASH_RECOVERY",
        "RELIABILITY.DISCONNECT_RECOVERY", "RELIABILITY.BACKUP_RESTORE",
        "RELIABILITY.WORKER_INTERRUPTION", "RELIABILITY.LAST_VALID",
        "RELIABILITY.UNSYNCED_CHANGE",
    ],
    68: [
        "SECURITY.ROLE", "SECURITY.SSO", "SECURITY.ENCRYPTION", "SECURITY.TENANT_CONTROL",
        "SECURITY.REGION_CONTROL", "SECURITY.AUDIT_EXPORT", "SECURITY.CLASSIFICATION_ASSIGN",
        "SECURITY.CLASSIFICATION_PROPAGATE", "SECURITY.POLICY_DECIDE",
        "SECURITY.AUTH_ENVELOPE", "SECURITY.EGRESS_CONTROL",
        "SECURITY.EXTERNAL_SYNTHETIC_GUARD", "SECURITY.AUDIT_APPEND",
        "SECURITY.ARTIFACT_HASH", "SECURITY.RETENTION", "SECURITY.EXPORT_MANIFEST",
    ],
    69: [
        "AUTH.HUMAN_EXECUTION", "AUTH.AGENT_PROPOSAL", "AUTH.REQUESTED_TRANSITION",
        "AUTH.AUTHORIZED_TRANSITION", "AUTH.APPLIED_TRANSITION", "AUTH.VERIFIED_TRANSITION",
        "AUTH.DENIED_NO_MUTATION", "AUTH.ROLLBACK", "AUTH.LOCAL_CREDENTIAL_SCOPE",
        "AUTH.CLOUD_CREDENTIAL_SCOPE", "AUTH.RECEIPT_CHAIN", "AUTH.SEPARATION_OF_DUTIES",
        "AUTH.PROJECTION_READ_ONLY",
    ],
}

FEATURES = [
    "EXTRUDE", "REVOLVE", "SWEEP", "LOFT", "HOLE", "SHELL", "DRAFT", "RIB",
    "LINEAR_PATTERN", "CIRCULAR_PATTERN", "MIRROR", "BOOLEAN", "FILLET", "CHAMFER",
]
STUDIES: dict[int, list[str]] = {
    48: [],
    49: ["MODAL", "FREQUENCY", "BUCKLING", "FATIGUE", "DROP"],
    50: ["THERMAL_STEADY", "THERMAL_TRANSIENT", "THERMAL_STRESS"],
    51: ["NONLINEAR_STATIC", "LINEAR_DYNAMICS", "NONLINEAR_DYNAMICS", "IMPACT"],
    52: ["DYNAMIC_MOTION", "MULTIBODY"],
    53: ["GENERAL_CFD", "ELECTRONICS_COOLING"],
    54: ["PLASTICS_FILL", "PLASTICS_PACK", "PLASTICS_WARP", "COMPOSITES_LAMINATE"],
    55: ["PARAMETER_VARIANT_EXPLORATION", "TOPOLOGY_OPTIMIZATION", "SHAPE_OPTIMIZATION", "GENERATIVE_OUTCOME"],
}

STUDY_EXTRAS: dict[int, list[str]] = {
    48: [
        "ANALYSIS.LINEAR_STATIC.STUDY", "ANALYSIS.LINEAR_STATIC.MATERIAL",
        "ANALYSIS.LINEAR_STATIC.MESH", "ANALYSIS.LINEAR_STATIC.LOAD",
        "ANALYSIS.LINEAR_STATIC.CONSTRAINT", "ANALYSIS.LINEAR_STATIC.SOLVER_ADAPTER",
        "ANALYSIS.LINEAR_STATIC.CONVERGENCE", "ANALYSIS.LINEAR_STATIC.BENCHMARK",
        "ANALYSIS.LINEAR_STATIC.RESULT", "ANALYSIS.LINEAR_STATIC.VISUALIZATION",
    ],
    49: ["ANALYSIS.MODAL.MODE_SHAPE_NORMALIZATION"],
    50: [
        "ANALYSIS.THERMAL.CONTACT_BOUNDARY_MODE",
        "ANALYSIS.THERMAL.CONVECTION_BOUNDARY_MODE",
        "ANALYSIS.THERMAL.RADIATION_BOUNDARY_MODE",
    ],
    55: [
        "ANALYSIS.GENERATIVE.PROBLEM_PERSIST",
        "ANALYSIS.GENERATIVE.CANDIDATE_PERSIST",
        "ANALYSIS.GENERATIVE.OUTCOME_COMPARE",
        "ANALYSIS.GENERATIVE.EDITABILITY_QUALIFY",
        "ANALYSIS.GENERATIVE.PROMOTION",
    ],
}

DEFAULT_OWNER: dict[int, str] = {
    **{n: "mission-requirements" for n in (1, 2, 3)}, 4: "assemblies-configurations",
    5: "supply-erp", 6: "manufacturing", 7: "mes-quality", 8: "mes-quality",
    9: "platform-security", 10: "operations-feedback",
    11: "core-kernel", 12: "solver-advanced-modeling", 13: "solver-advanced-modeling",
    16: "core-kernel", 17: "core-kernel", 18: "core-kernel",
    14: "core-kernel", 15: "history-collaboration", 19: "interop-mesh",
    **{n: "assemblies-configurations" for n in range(20, 26)},
    **{n: "drawings-mbd" for n in range(26, 29)},
    **{n: "manufacturing" for n in (29, 30, 31, 41, 42, 43, 44, 45, 46, 47)},
    32: "ecad-routing", 33: "ecad-routing",
    **{n: "interop-mesh" for n in range(34, 40)}, 40: "browser-workbench",
    **{n: "simulation-generative" for n in range(48, 56)},
    **{n: "ecad-routing" for n in range(56, 59)},
    **{n: "history-collaboration" for n in (59, 60, 63)},
    61: "platform-security", 62: "platform-security",
    64: "platform-security", 65: "platform-security", 66: "browser-workbench",
    67: "platform-security", 68: "platform-security", 69: "platform-security",
}

OWNER_PREFIX = {
    "MR": "mission-requirements", "SIM": "simulation-generative", "SUP": "supply-erp",
    "MFG": "manufacturing", "MES": "mes-quality", "QUALITY": "mes-quality",
    "OPS": "operations-feedback", "DRAWING": "drawings-mbd", "PMI": "drawings-mbd",
    "MBD": "drawings-mbd", "ECAD": "ecad-routing", "HARNESS": "ecad-routing",
    "ROUTE": "ecad-routing", "HISTORY": "history-collaboration", "COLLAB": "history-collaboration",
    "RENDER": "browser-workbench", "CLIENT": "browser-workbench", "SECURITY": "platform-security",
    "AUTH": "platform-security", "LIFECYCLE": "platform-security", "API": "platform-security",
    "EXTENSION": "platform-security", "RELIABILITY": "platform-security",
    "DIRECT": "core-kernel", "SURFACE": "core-kernel", "FREEFORM": "core-kernel",
}


LEAF_META: dict[str, dict[str, Any]] = {
    "OPS.UNIT_IDENTITY": {
        "dependencies": ["CAD-059.HISTORY.AUTOMATIC_VERSION", "CAD-009.RELEASE.IMMUTABLE"],
        "impact_edges": ["delivered unit -> exact immutable release"],
        "required_behavior": "Bind one stable delivered asset/unit identity to one exact immutable release revision without copying release content.",
        "positive_fixture": "Create one synthetic unit/release binding, restart, and resolve the same exact release hash.",
        "negative_fixture": "Submit the same unit identity with a divergent release and assert duplicate-identity conflict with zero mutation.",
        "failure_condition": "A duplicate unit identity resolves to a different immutable release.",
    },
    "OPS.CONFIG_BASELINE": {
        "dependencies": ["CAD-010.OPS.UNIT_IDENTITY", "CAD-061.PDM.BOM_CONTROL"],
        "impact_edges": ["exact release/design/BOM/process revisions -> unit configuration baseline"],
        "required_behavior": "Persist one content-addressed release/design/BOM/process baseline and explicit supersession for an exact unit.",
        "positive_fixture": "Resolve every exact baseline revision/hash before and after restart and append a separately hashed successor.",
        "negative_fixture": "Attempt an in-place baseline overwrite or inconsistent cross-revision set and assert zero mutation.",
        "failure_condition": "The baseline overwrites prior content or contains mutually inconsistent revisions.",
    },
    "OPS.SYNTHETIC_OBSERVATION": {
        "interaction": "PERSIST", "data_authority": "SYNTHETIC_NOTIONAL",
        "dependencies": ["CAD-010.OPS.CONFIG_BASELINE"],
        "impact_edges": ["synthetic source + unit + exact baseline -> immutable observation"],
        "required_behavior": "Append one explicitly synthetic observation with source, unit, time and exact configuration-baseline reference.",
        "positive_fixture": "Append and replay a SYNTHETIC observation whose source, unit and baseline hashes all resolve.",
        "negative_fixture": "Submit LIVE, REAL, control, secret or private content and assert PRODUCT_BOUNDARY_VIOLATION with zero mutation.",
        "failure_condition": "The observation is not explicitly synthetic/public or its unit/baseline reference is invalid.",
    },
    "OPS.MAINTENANCE_EVENT": {
        "interaction": "PERSIST",
        "dependencies": ["CAD-010.OPS.SYNTHETIC_OBSERVATION", "CAD-010.OPS.CONFIG_BASELINE"],
        "impact_edges": ["unit baseline + observation -> maintenance history event"],
        "required_behavior": "Append one maintenance history record against the exact unit baseline without dispatch or control intent.",
        "positive_fixture": "Append a synthetic maintenance record and resolve its exact unit, baseline and source observation.",
        "negative_fixture": "Include dispatch, command or machine-control intent and assert a stable forbidden-effect diagnostic with zero mutation.",
        "failure_condition": "A maintenance record contains dispatch, command or machine-control intent.",
    },
    "OPS.CONFIDENCE_SOURCE": {
        "interaction": "VALIDATE",
        "dependencies": ["CAD-010.OPS.SYNTHETIC_OBSERVATION"],
        "impact_edges": ["exact observation IDs + method/source basis -> confidence classification"],
        "required_behavior": "Validate confidence classification, method, basis and source for exact observation IDs.",
        "positive_fixture": "Validate declared MEASURED, INFERRED and UNKNOWN synthetic vectors with exact bases.",
        "negative_fixture": "Use out-of-range, unsupported or unsourced confidence and assert rejection without promoting UNKNOWN.",
        "failure_condition": "Confidence is out of range, unsupported or lacks an exact source/method basis.",
    },
    "OPS.FAILURE_FINDING": {
        "interaction": "COMPUTE",
        "dependencies": ["CAD-010.OPS.SYNTHETIC_OBSERVATION", "CAD-010.OPS.CONFIDENCE_SOURCE"],
        "impact_edges": ["exact observations + confidence -> immutable failure finding"],
        "required_behavior": "Derive one failure finding from exact source observations and their confidence records.",
        "positive_fixture": "Recompute a finding from pinned observations/confidence and compare its canonical digest after reorder/restart.",
        "negative_fixture": "Omit or tamper a source/confidence reference and assert unsourced-finding rejection with zero finding.",
        "failure_condition": "A finding is unsourced or not bound to the exact confidence/source revisions.",
    },
    "OPS.AFFECTED_TRACE_LINKS": {
        "interaction": "VALIDATE", "fidelity": "SEMANTIC", "proof_tier": "BEHAVIOR",
        "dependencies": [
            "CAD-010.OPS.FAILURE_FINDING", "CAD-003.MR.CAD_TRACE",
            "CAD-004.SUP.BOM_REVISION", "CAD-006.MFG.PLAN_REVISION",
        ],
        "impact_edges": ["finding -> exact requirement/design/BOM/process revisions"],
        "required_behavior": "Resolve exact versioned requirement, design, BOM and process trace links plus link rationale for one finding.",
        "positive_fixture": "Resolve a nontrivial cross-domain trace graph and independently match every exact revision/hash.",
        "negative_fixture": "Use transient, unversioned or unknown links and assert explicit unresolved diagnostics, never resolved state.",
        "failure_condition": "Any affected link is transient, unversioned, stale, ambiguous or falsely marked resolved.",
    },
    "OPS.TRIAGE": {
        "interaction": "COLLABORATE",
        "dependencies": ["CAD-010.OPS.FAILURE_FINDING", "CAD-010.OPS.AFFECTED_TRACE_LINKS"],
        "impact_edges": ["finding + affected links -> human-reviewable triage disposition"],
        "required_behavior": "Append one human-reviewable triage disposition without inferring authorization.",
        "positive_fixture": "Append a named-reviewer synthetic triage receipt bound to exact finding and trace hashes.",
        "negative_fixture": "Omit a named human decision or let the service self-authorize and assert triage remains pending.",
        "failure_condition": "Triage is presented as authorized without a distinct named-human decision receipt.",
    },
    "OPS.CORRECTIVE_PROPOSAL": {
        "dependencies": ["CAD-010.OPS.TRIAGE"],
        "impact_edges": ["triage -> typed corrective proposal against exact released base"],
        "required_behavior": "Create one typed, non-executable corrective proposal against an exact released base revision.",
        "positive_fixture": "Create and replay a proposal whose base, rationale and intended typed changes remain identical.",
        "negative_fixture": "Attempt a direct base edit, stale-base proposal or executable payload and assert rejection with release unchanged.",
        "failure_condition": "The proposal mutates its base, targets a stale base or carries executable content.",
    },
    "OPS.IMPACT_ANALYSIS": {
        "interaction": "COMPUTE",
        "dependencies": ["CAD-010.OPS.CORRECTIVE_PROPOSAL", "CAD-010.OPS.AFFECTED_TRACE_LINKS"],
        "impact_edges": ["corrective proposal + trace graph -> conservative direct/transitive affected set"],
        "required_behavior": "Deterministically compute direct/transitive affected nodes, unknowns, reviews and tests for one proposal.",
        "positive_fixture": "Shuffle one cyclic-edge-free fixture and reproduce the same stable affected/unknown/review/test sets.",
        "negative_fixture": "Inject an unknown or cycle and assert it is surfaced rather than silently treated as unaffected.",
        "failure_condition": "Unknowns/cycles are omitted, treated as unaffected or make the result order-dependent.",
    },
    "OPS.AUTHORIZED_CHANGE_PATH": {
        "interaction": "AUTHOR",
        "dependencies": [
            "CAD-010.OPS.CORRECTIVE_PROPOSAL", "CAD-010.OPS.IMPACT_ANALYSIS",
            "CAD-060.COLLAB.PROPOSE", "CAD-062.LIFECYCLE.AUTHORIZATION",
        ],
        "impact_edges": ["external human authorization + exact proposal/impact hash -> new parented change path"],
        "required_behavior": "Bind a matching external named-human authorization and create a new parented change path without editing the release.",
        "positive_fixture": "Apply one matching unexpired human authorization to unchanged proposal/evidence and inspect the new parented branch receipt.",
        "negative_fixture": "Use agent-issued, missing, expired, mismatched or stale authorization and assert no branch/revision is created.",
        "failure_condition": "Authorization is absent, non-human, expired, mismatched or bound to stale proposal/evidence.",
    },
    "OPS.PRIOR_RELEASE_IMMUTABILITY": {
        "interaction": "VALIDATE",
        "dependencies": ["CAD-009.RELEASE.IMMUTABLE", "CAD-010.OPS.AUTHORIZED_CHANGE_PATH"],
        "impact_edges": ["new change path -> unchanged prior release bytes/hash/revision"],
        "required_behavior": "Verify the original released bytes, hash and revision remain unchanged after a successor path is created.",
        "positive_fixture": "Compare pre/post release bytes and hashes after a valid successor path and require exact equality.",
        "negative_fixture": "Tamper or overwrite any prior-release byte/ref and assert immutable-release violation.",
        "failure_condition": "Any prior released byte, hash, revision or parent relation changes in place.",
    },
    "OPS.AUDIT_REPLAY": {
        "interaction": "VALIDATE",
        "dependencies": ["CAD-010.OPS.PRIOR_RELEASE_IMMUTABILITY", "CAD-059.HISTORY.APPEND"],
        "impact_edges": ["operations event chain -> deterministic reconstructed state and provenance"],
        "required_behavior": "Replay the complete operations-feedback event chain and validate ordering, provenance and hashes.",
        "positive_fixture": "Rebuild the same final state and graph digest in a clean process from the ordered immutable chain.",
        "negative_fixture": "Delete, reorder or tamper one event and assert replay failure at the exact stable event ID.",
        "failure_condition": "The event chain has a gap, reorder, cycle, provenance omission or hash mismatch.",
    },
    "OPS.NO_ACTION_CLOSURE": {
        "interaction": "PERSIST",
        "dependencies": ["CAD-010.OPS.TRIAGE"],
        "impact_edges": ["triage -> no-action closure preserving finding and release"],
        "required_behavior": "Append a no-action closure that preserves the finding and release and creates no change path.",
        "positive_fixture": "Close one synthetic finding as no-action and prove the finding/release remain resolvable and no proposal is applied.",
        "negative_fixture": "Attempt to hide/delete the finding or create a change through no-action closure and assert rejection.",
        "failure_condition": "No-action closure alters the finding/release or creates an implicit change path.",
    },
    "OPS.PRODUCT_BOUNDARY_GUARD": {
        "interaction": "VALIDATE",
        "dependencies": [],
        "impact_edges": ["forbidden data/action kind -> stable rejection with zero external effect"],
        "required_behavior": "Reject live/private/controlled data and dispatch, machine, supplier, production or external-effect actions.",
        "positive_fixture": "Run the complete forbidden-domain/action corpus and obtain stable ordered rejection codes with zero effects.",
        "negative_fixture": "Any accepted forbidden kind, external call, credential use or product-authority claim fails this leaf.",
        "failure_condition": "A forbidden data class, authority domain or external-effect action is admitted.",
    },
    "MR.FEEDBACK_PROPOSAL": {
        "dependencies": ["CAD-010.OPS.CORRECTIVE_PROPOSAL"],
        "impact_edges": ["operations corrective proposal -> mission-requirements proposal boundary"],
        "required_behavior": "Project an accepted operations corrective proposal into a distinct mission-requirements proposal boundary.",
        "positive_fixture": "Resolve an exact operations proposal ref without copying its mutable payload into mission authority.",
        "negative_fixture": "Let either lane overwrite or absorb the other lane's proposal and assert authority-domain rejection.",
        "failure_condition": "The mission edge duplicates, absorbs or mutates the operations-owned corrective proposal.",
    },
}

LEAF_META.update({
    "ANALYSIS.LINEAR_STATIC.STUDY": {"interaction": "AUTHOR"},
    "ANALYSIS.LINEAR_STATIC.MATERIAL": {"interaction": "AUTHOR"},
    "ANALYSIS.LINEAR_STATIC.MESH": {"interaction": "COMPUTE"},
    "ANALYSIS.LINEAR_STATIC.LOAD": {"interaction": "AUTHOR"},
    "ANALYSIS.LINEAR_STATIC.CONSTRAINT": {"interaction": "AUTHOR"},
    "ANALYSIS.LINEAR_STATIC.SOLVER_ADAPTER": {"interaction": "COMPUTE"},
    "ANALYSIS.LINEAR_STATIC.CONVERGENCE": {"interaction": "VALIDATE"},
    "ANALYSIS.LINEAR_STATIC.BENCHMARK": {"interaction": "VALIDATE"},
    "ANALYSIS.LINEAR_STATIC.RESULT": {"interaction": "PERSIST"},
    "ANALYSIS.LINEAR_STATIC.VISUALIZATION": {"interaction": "VIEW"},
    "ANALYSIS.MODAL.MODE_SHAPE_NORMALIZATION": {"interaction": "PERSIST"},
    "ANALYSIS.GENERATIVE.OUTCOME_COMPARE": {"interaction": "COMPUTE"},
    "ANALYSIS.GENERATIVE.EDITABILITY_QUALIFY": {"interaction": "VALIDATE"},
    "ANALYSIS.GENERATIVE.PROMOTION": {"interaction": "PERSIST"},
})


def generic_slugs(title: str) -> list[str]:
    protected = {
        "2D/2.5D": "2D§2.5D", "AP203/AP214/AP242": "AP203§AP214§AP242",
        "ACIS/SAT": "ACIS§SAT", "AR/VR": "AR§VR",
    }
    text = title
    for source, replacement in protected.items():
        text = text.replace(source, replacement)
    if ":" in text:
        text = text.split(":", 1)[1]
    text = re.sub(r"\s+(?:and|&)\s+", ",", text, flags=re.I).replace("/", ",").replace("§", "/")
    values: list[str] = []
    for index, fragment in enumerate(text.split(","), 1):
        fragment = re.sub(r"\s+", " ", fragment.strip())
        if not fragment:
            continue
        slug = re.sub(r"[^A-Z0-9]+", "_", fragment.upper()).strip("_")
        values.append(f"LEAF.{slug}.{index:02d}")
    return values


def row_slugs(row: int, title: str) -> list[str]:
    if row == 14:
        return [f"FEATURE.{feature}.{phase}" for feature in FEATURES for phase in ("CREATE", "EDIT", "RECOMPUTE", "FAILURE")]
    if row == 34:
        return [
            f"STEP.{profile}.{direction}.{scope}.{facet}"
            for profile in ("AP203", "AP214", "AP242")
            for direction in ("IMPORT", "EXPORT")
            for scope in ("PART", "ASSEMBLY")
            for facet in ("SHAPE", "UNITS", "NAMES_COLORS", "PMI", "VALIDATION_PROPERTIES")
        ]
    if row == 35:
        values = list(CUSTOM[35])
        for format_name in ("IGES", "PARASOLID", "ACIS_SAT", "JT", "THREEDXML"):
            values.extend((f"{format_name}.IMPORT", f"{format_name}.EXPORT", f"{format_name}.REPLACEMENT_BOUNDARY"))
        return values
    if row == 38:
        values = [
            "THREEMF.CORE_IMPORT", "THREEMF.CORE_EXPORT",
            "THREEMF.UNITS_IMPORT", "THREEMF.UNITS_EXPORT",
            "THREEMF.OBJECT_BUILD_GRAPH_IMPORT", "THREEMF.OBJECT_BUILD_GRAPH_EXPORT",
            "THREEMF.OBJECT_NAMES_IMPORT", "THREEMF.OBJECT_NAMES_EXPORT",
            "THREEMF.BASE_MATERIAL_IMPORT", "THREEMF.BASE_MATERIAL_EXPORT",
            "THREEMF.ZIP_XML_SAFETY",
        ]
        for extension in ("PRODUCTION", "BEAM_LATTICE", "SLICE", "SECURE_CONTENT", "VOLUMETRIC"):
            values.extend((f"THREEMF.{extension}.IMPORT", f"THREEMF.{extension}.EXPORT"))
        return values
    if row in STUDIES:
        values = [
            f"ANALYSIS.{study}.{phase}"
            for study in STUDIES[row]
            for phase in ("SETUP", "SOLVE", "POSTPROCESS", "BENCHMARK")
        ]
        values.extend(STUDY_EXTRAS.get(row, []))
        return values
    return list(CUSTOM.get(row, generic_slugs(title)))


def interaction(slug: str) -> str:
    upper = slug.upper()
    if "IMPORT" in upper or "INGEST" in upper:
        return "IMPORT"
    if "EXPORT" in upper or "OUTPUT" in upper or "EMISSION" in upper:
        return "EXPORT"
    if any(word in upper for word in ("EDIT", "REPAIR", "OVERRIDE", "SUPPRESS", "REVISE")):
        return "EDIT"
    if any(word in upper for word in ("VIEW", "RENDER", "POSTPROCESS", "ANIMATE")):
        return "VIEW"
    if any(word in upper for word in ("RESTORE", "ROLLBACK", "RECOVERY")):
        return "RESTORE"
    if any(word in upper for word in ("COLLAB", "PRESENCE", "COMMENT", "SHARE", "MERGE")):
        return "COLLABORATE"
    if any(word in upper for word in ("API", "WEBHOOK", "AUTOMATION", "HEADLESS", "PLUGIN", "SCRIPT", "MACRO")):
        return "AUTOMATE"
    if any(word in upper for word in (
        "VALID", "CHECK", "BENCHMARK", "FAIL", "GUARD", "IMMUTABLE", "CONFLICT", "DIAGNOSTIC",
        "AUTH", "ELIGIBLE", "TRACE", "LINK", "SCOPE", "PRESERVE", "ROUND_TRIP", "PROHIBITION",
    )):
        return "VALIDATE"
    if any(word in upper for word in (
        "COMPUTE", "SOLVE", "ANALYSIS", "RANK", "ALLOC", "SIMULATION", "DEVELOP", "LENGTH",
        "BOM", "RECOMPUTE", "EXPLODE", "CLEARANCE", "INTERFERENCE", "CAPACITY", "RISK",
        "INSPECT", "TEST", "DRC", "SLICING", "TOOLPATH", "NESTING", "MILLING", "TURNING",
    )):
        return "COMPUTE"
    if any(word in upper for word in ("PERSIST", "HISTORY", "APPEND", "REPLAY", "HASH", "OBSERVE")):
        return "PERSIST"
    return "AUTHOR"


def owner(row: int, slug: str) -> str | None:
    if slug.startswith("COMPOSE."):
        return None
    prefix = slug.split(".", 1)[0]
    if slug == "ECAD.CLEARANCE_EVALUATE":
        return "assemblies-configurations"
    if slug == "DRAWING.DWG_EXPORT":
        return "interop-mesh"
    if slug == "MBD.TOLERANCE_ANALYSIS":
        return "solver-advanced-modeling"
    if slug == "BREP.TESSELLATION":
        return "core-kernel"
    if slug == "ASSEMBLY.CORE_COMPOSITION_RECEIPT":
        return "core-kernel"
    if slug.startswith("FEATURE.") and slug.rsplit(".", 1)[-1] in {"CREATE", "EDIT"}:
        return "history-collaboration"
    if prefix in OWNER_PREFIX:
        return OWNER_PREFIX[prefix]
    return DEFAULT_OWNER[row]


def executor(row: int, slug: str, owner_value: str | None) -> str | None:
    if slug.startswith("COMPOSE."):
        return None
    if slug in {
        "CONFIG.PARAMETER_OVERRIDES", "CONFIG.FEATURE_SUPPRESSION",
        "ASSEMBLY.INTERFERENCE", "ASSEMBLY.CONTACT_CLEARANCE_CLASSIFICATION",
        "ECAD.CLEARANCE_EVALUATE",
    }:
        return "core-kernel"
    return owner_value


def is_idempotent(slug: str) -> bool:
    return slug in {
        "MES.OP_START", "SUP.IDEMPOTENCY", "LIFECYCLE.IDEMPOTENCY",
        "API.IDEMPOTENCY", "OPS.AUDIT_REPLAY", "HISTORY.CLEAN_REPLAY",
        "COLLAB.DETERMINISTIC_REPLAY",
    }


def fidelity(slug: str, row: int) -> str:
    upper = slug.upper()
    if slug.startswith("FEATURE.") and slug.rsplit(".", 1)[-1] in {"CREATE", "EDIT"}:
        return "SEMANTIC"
    if row == 21 and slug != "ASSEMBLY.CORE_COMPOSITION_RECEIPT":
        return "SEMANTIC"
    if row == 24 and not any(word in upper for word in ("INTERFERENCE", "CONTACT_CLEARANCE", "MASS_PROPERTIES")):
        return "SEMANTIC"
    if any(word in upper for word in ("BOUNDARY", "REF_", "_LINK", "TRACE", "ENVELOPE", "API", "MANIFEST")):
        return "BOUNDARY_ONLY"
    if any(word in upper for word in ("PMI", "DATUM", "FEATURE_CONTROL", "SURFACE_FINISH", "WELD_SYMBOL")):
        return "PMI"
    if row in {14, 16, 17, 18, 21, 24} or any(word in upper for word in ("BREP", "INTERFERENCE", "CLEARANCE_EVALUATE")):
        return "EXACT_BREP"
    if row in {19, 37, 38, 39, 40, 66} or any(word in upper for word in ("MESH", "TESSELL", "RENDER", "PREVIEW")):
        return "DERIVED_MESH"
    if any(word in upper for word in ("DRAWING", "PDF", "DXF", "DWG", "TRAVELER", "INSTRUCTION", "PACKET", "DOCUMENT")):
        return "DOCUMENT"
    if row in {1, 5, 7, 8, 10, 61, 62, 68}:
        return "METADATA"
    return "SEMANTIC"


def proof_tier(slug: str, fidelity_value: str) -> str:
    upper = slug.upper()
    if fidelity_value == "BOUNDARY_ONLY" or any(word in upper for word in ("BOUNDARY", "REF_FAIL", "PROFILE_VALIDATE")):
        return "BOUNDARY"
    return "BEHAVIOR"


def delivery(slug: str, action: str, fidelity_value: str) -> tuple[str, str]:
    upper = slug.upper()
    if fidelity_value == "EXACT_BREP" and action in {"COMPUTE", "VALIDATE", "EXPORT"}:
        return "ADOPTED", "OPTIONAL_MODULE"
    if any(word in upper for word in ("IMPORT", "EXPORT", "ADAPTER", "SOLVE", "SIMULATION", "HLR", "DWG", "STEP", "IGES", "PARASOLID", "ACIS", "JT", "THREEDXML")):
        return "ADOPTED", "FILE_ADAPTER" if action in {"IMPORT", "EXPORT"} else "OPTIONAL_MODULE"
    if any(word in upper for word in ("PLUGIN", "EXTENSION")):
        return "PLUGIN", "PLUGIN"
    if any(word in upper for word in ("SSO", "LIVE_BOUNDARY")):
        return "SERVICE", "SERVICE"
    return "NATIVE", "BUILT_IN"


def locus(owner_value: str | None, slug: str, action: str) -> str:
    if any(word in slug for word in ("SSO", "LIVE_BOUNDARY")):
        return "REMOTE_SERVICE"
    if owner_value == "browser-workbench" or action == "VIEW" and slug.startswith(("CLIENT.", "RENDER.", "GL")):
        return "BROWSER"
    if any(word in slug for word in ("PLUGIN", "DESKTOP")):
        return "DESKTOP_PLUGIN"
    if owner_value in {"core-kernel", "solver-advanced-modeling", "interop-mesh", "manufacturing", "simulation-generative", "ecad-routing"}:
        return "LOCAL_SERVICE"
    if slug.startswith("API.HEADLESS") or slug.startswith("COMPOSE."):
        return "HEADLESS"
    return "SERVER"


def entitlement_and_platforms(
    delivery_kind: str, delivery_class: str, execution_locus: str,
) -> tuple[str, list[str]]:
    entitlement = {
        ("NATIVE", "BUILT_IN"): "BASE",
        ("ADOPTED", "OPTIONAL_MODULE"): "DEPENDENCY_ADOPTION_REQUIRED",
        ("ADOPTED", "FILE_ADAPTER"): "FORMAT_ADAPTER_REQUIRED",
        ("PLUGIN", "PLUGIN"): "OPTIONAL_PLUGIN",
        ("SERVICE", "SERVICE"): "EXTERNAL_ACCOUNT_REQUIRED",
        ("SIMULATED", "SIMULATED"): "DEVELOPMENT_ONLY",
    }.get((delivery_kind, delivery_class), "EXPLICIT_ENTITLEMENT_REQUIRED")
    platforms = {
        "BROWSER": ["WEB_DESKTOP", "WEB_MOBILE_REVIEW"],
        "SERVER": ["SERVER"],
        "HEADLESS": ["LOCAL", "CI"],
        "DESKTOP_PLUGIN": ["DESKTOP"],
        "LOCAL_SERVICE": ["SERVER_NATIVE"],
        "REMOTE_SERVICE": ["CLOUD_SERVICE", "SERVER_ADAPTER"],
    }[execution_locus]
    return entitlement, platforms


def dependency_license(slug: str, owner_value: str | None, delivery_kind: str) -> str:
    upper = slug.upper()
    if delivery_kind == "NATIVE":
        return "FORGE_NO_PUBLIC_LICENSE_SELECTED"
    if slug.startswith("SOLVER."):
        return "PLANEGCS_LGPL-2.1-OR-LATER_SCREENED_UNADMITTED"
    if slug.startswith(("FEATURE.", "DIRECT.", "SURFACE.", "FREEFORM.", "BREP.")) or any(
        word in upper for word in ("STEP", "HLR", "INTERFERENCE", "CONTACT_CLEARANCE")
    ):
        return "OCP_APACHE-2.0_PLUS_OCCT_LGPL-2.1_EXCEPTION_UNADMITTED"
    if slug.startswith(("RENDER.", "GLTF.", "GLB.")):
        return "THREE.JS_MIT_SCREENED_UNADMITTED"
    if slug.startswith("COLLAB."):
        return "YJS_MIT_SCREENED_PROVIDER_UNSELECTED"
    if slug.startswith("MFG."):
        return "OPENCAMLIB_LGPL-2.1_OR_COMPONENT_UNSELECTED_UNADMITTED"
    if slug.startswith("ANALYSIS."):
        return "MESH_SOLVER_COMPONENT_UNSELECTED_UNADMITTED"
    if owner_value == "ecad-routing":
        return "KICAD_OR_ECAD_COMPONENT_UNSCREENED_HOLD"
    if delivery_kind == "SERVICE":
        return "COMMERCIAL_OR_PROVIDER_UNSELECTED_HOLD"
    return "COMPONENT_SPECIFIC_UNSELECTED_HOLD"


def entities(owner_value: str | None) -> list[str]:
    mapping = {
        "mission-requirements": ["RecordEnvelope", "RecordRef", "ProductThread"],
        "supply-erp": ["RecordEnvelope", "RecordRef", "ProductThread"],
        "manufacturing": ["ManufacturingPlan", "RecordRef", "ArtifactRef"],
        "mes-quality": ["RecordEnvelope", "RecordRef", "ProductThread"],
        "operations-feedback": ["RecordEnvelope", "RecordRef", "ProductThread"],
        "core-kernel": ["PartDocument", "OperationEnvelope", "GeometryArtifact"],
        "solver-advanced-modeling": ["PartDocument", "AnalysisStudy", "GeometryArtifact"],
        "assemblies-configurations": ["AssemblyDocument", "DefinitionRevision", "ComponentOccurrence"],
        "drawings-mbd": ["DrawingDocument", "RecordRef", "ArtifactRef"],
        "interop-mesh": ["ExchangeRequest", "GeometryArtifact", "ExchangeResult"],
        "simulation-generative": ["AnalysisStudy", "RecordRef", "ArtifactRef"],
        "ecad-routing": ["ElectronicsDocument", "RecordRef", "ArtifactRef"],
        "history-collaboration": ["CommandEnvelope", "EventEnvelope", "RevisionRef"],
        "browser-workbench": ["ViewportPacket", "RecordRef", "SelectionRef"],
        "platform-security": ["ProductThread", "CommandEnvelope", "EventEnvelope"],
        None: ["ProductThread", "RecordRef", "EventEnvelope"],
    }
    return mapping[owner_value]


def seam(slug: str, owner_value: str | None) -> str:
    if slug.startswith(("STEP.", "IGES.", "PARASOLID.", "ACIS", "JT.", "THREEDXML.", "STL.", "OBJ.", "DXF.", "DWG.", "THREEMF.")):
        return "ExchangeAdapter/1"
    if slug.startswith(("SOLVER.",)):
        return "ConstraintSolverAdapter/1"
    if slug.startswith(("FEATURE.", "DIRECT.", "SURFACE.", "FREEFORM.", "BREP.")):
        return "KernelAdapter/1"
    if slug.startswith(("ASSEMBLY.", "RELATION.", "MECHANISM.")):
        return "AssemblySolverAdapter/1"
    if slug.startswith(("DRAWING.", "PMI.", "MBD.")):
        return "DrawingProjectionAdapter/1"
    if slug.startswith("MFG."):
        return "ManufacturingAdapter/1"
    if slug.startswith("ANALYSIS."):
        return "AnalysisSolverAdapter/1"
    if slug.startswith(("ECAD.", "HARNESS.", "ROUTE.")):
        return "ECADAdapter/1"
    if owner_value == "browser-workbench":
        return "RendererAdapter/1"
    return "RecordRegistry/1"


def equivalence_flags(row: int, slug: str, action: str, fidelity_value: str, delivery_kind: str) -> list[str]:
    upper = slug.upper()
    flags: set[str] = set()
    if delivery_kind in {"ADOPTED", "PLUGIN", "SERVICE"}:
        flags.add("NATIVE_ADDON")
    if fidelity_value in {"EXACT_BREP", "DERIVED_MESH", "TESSELLATED"} or row in {19, 37, 39, 40}:
        flags.add("BREP_MESH")
    if row in {27, 28, 34} and "PMI" in upper:
        flags.add("PMI_GRAPHICS")
    if any(word in upper for word in ("SOLVE", "SIMULATION", "HLR", "KICAD", "SSO")):
        flags.add("BUILTIN_PARTNER")
    if delivery_kind == "SERVICE" or "CLOUD" in upper:
        flags.add("LOCAL_CLOUD")
    if action == "VIEW" or row == 66:
        flags.add("AUTHOR_VIEW")
    if 29 <= row <= 47:
        flags.add("PROD_PLAN")
    if row in {5, 6, 7, 8, 10, 62}:
        flags.add("LIVE_SYNTH")
    if action == "IMPORT":
        flags.add("IMPORT_EDITABLE")
    if row in {23, 52}:
        flags.add("ANIMATION_DYNAMICS")
    if action in {"IMPORT", "EXPORT"}:
        flags.add("FORMAT_FIDELITY")
    if row in {9, 62, 69}:
        flags.add("APPLIED_VERIFIED")
    if row in {60, 63}:
        flags.add("CRDT_GEOMETRY")
    return sorted(flags)


def build_decomposition(source: dict[str, Any]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for parent in source["parents"]:
        row = parent["source_row"]
        atoms: list[dict[str, Any]] = []
        slugs = row_slugs(row, parent["source_title"])
        if len(slugs) != len(set(slugs)):
            raise ValueError(f"duplicate atomic slug under {parent['parent_id']}")
        for slug in slugs:
            meta = LEAF_META.get(slug, {})
            action = meta.get("interaction", interaction(slug))
            owner_value = owner(row, slug)
            executor_value = executor(row, slug, owner_value)
            fidelity_value = meta.get("fidelity", fidelity(slug, row))
            delivery_kind, delivery_class = delivery(slug, action, fidelity_value)
            atoms.append({
                "slug": slug,
                "capability_leaf": split_words(slug),
                "interaction": action,
                "authority_owner": owner_value,
                "executor_owner": executor_value,
                "fidelity": fidelity_value,
                "execution_locus": locus(executor_value, slug, action),
                "delivery_kind": delivery_kind,
                "delivery_class": delivery_class,
                "data_authority": meta.get(
                    "data_authority",
                    "DERIVED_PREVIEW" if owner_value == "browser-workbench" else (
                        "IMPORTED_REFERENCE" if action == "IMPORT" else "CANONICAL_FORGE"
                    ),
                ),
                "direction_profile": slug.replace(".", "/") if action in {"IMPORT", "EXPORT"} else None,
                "required_proof_tier": meta.get("proof_tier", proof_tier(slug, fidelity_value)),
                "mandatory": True,
                "dependencies": meta.get("dependencies", []),
                "impact_edges": meta.get("impact_edges", []),
                "replacement_seam": seam(slug, owner_value),
                "metadata_overrides": {
                    key: meta[key]
                    for key in (
                        "required_behavior", "positive_fixture", "negative_fixture",
                        "failure_condition",
                    )
                    if key in meta
                },
            })
        rows.append({"parent_id": parent["parent_id"], "atoms": atoms})
    return {
        "schema_version": "forge.atomic-capability-decomposition/1",
        "source_authority": source["source_authority"],
        "rows": rows,
    }


def actor_for(owner_value: str | None) -> str:
    return {
        "mission-requirements": "program and operations lead",
        "supply-erp": "supply planner",
        "manufacturing": "manufacturing engineer",
        "mes-quality": "authorized operator or quality reviewer",
        "operations-feedback": "service and operations analyst",
        "core-kernel": "CAD author",
        "solver-advanced-modeling": "CAD author or analyst",
        "assemblies-configurations": "assembly author",
        "drawings-mbd": "drawing or MBD author",
        "interop-mesh": "exchange operator",
        "simulation-generative": "analysis engineer",
        "ecad-routing": "electrical or routing author",
        "history-collaboration": "reviewer or collaborator",
        "browser-workbench": "browser reviewer",
        "platform-security": "authorized administrator",
        None: "integration verifier",
    }[owner_value]


def build_ledger(source: dict[str, Any], decomposition: dict[str, Any]) -> dict[str, Any]:
    parent_map = {item["parent_id"]: item for item in source["parents"]}
    records: list[dict[str, Any]] = []
    for row in decomposition["rows"]:
        parent = parent_map[row["parent_id"]]
        for atom in row["atoms"]:
            atomic_id = f"{row['parent_id']}.{atom['slug']}"
            failure_code = re.sub(r"[^A-Z0-9]+", "_", atomic_id.upper()) + "_UNAVAILABLE"
            source_pointer = (
                f"annex:sha256:{source['source_authority']['research_annex_sha256']}"
                f"#row:{parent['source_row']}/leaf:{atom['slug']}"
            )
            owner_value = atom["authority_owner"]
            metadata_overrides = atom.get("metadata_overrides", {})
            idempotent_value = is_idempotent(atom["slug"])
            entitlement, platforms = entitlement_and_platforms(
                atom["delivery_kind"], atom["delivery_class"], atom["execution_locus"]
            )
            record = {
                "atomic_id": atomic_id,
                "parent_id": row["parent_id"],
                "mandatory": atom["mandatory"],
                "source_family": parent["source_family"],
                "source_row": parent["source_row"],
                "source_title": parent["source_title"],
                "source_fragment": atom["capability_leaf"],
                "capability_leaf": atom["capability_leaf"],
                "interaction": atom["interaction"],
                "direction_profile": atom["direction_profile"],
                "actor": actor_for(owner_value),
                "outcome": f"Invoke {atom['capability_leaf']} and receive one typed, revision-bound outcome.",
                "prerequisites": [
                    "exact frozen input revisions and hashes",
                    "supported schema and operation/profile",
                    "valid scoped authorization for mutation",
                ],
                "inputs": ["synthetic/public fixture", "exact immutable references", "canonical options"],
                "outputs": ["typed result or stable failure", "append-only provenance", "content digest"],
                "canonical_entities": entities(owner_value),
                "required_proof_tier": atom["required_proof_tier"],
                "implementation": {
                    "class": "UNASSIGNED", "project": None, "version": None, "package_name": None,
                    "resolved_path": None, "license_spdx": None, "license_file_sha256": None,
                    "notice": None,
                },
                "execution_locus": atom["execution_locus"],
                "delivery": {
                    "kind": atom["delivery_kind"], "class": atom["delivery_class"],
                    "entitlement": entitlement, "platforms": platforms,
                },
                "dependency_license": dependency_license(atom["slug"], owner_value, atom["delivery_kind"]),
                "authority_owner": owner_value,
                "executor_owner": atom["executor_owner"],
                "fidelity": atom["fidelity"],
                "data_authority": atom["data_authority"],
                "persistence_semantics": "Append-only immutable revisions/events; corrections supersede.",
                "round_trip_semantics": "RFC8785 JSON preserves exact stable IDs, references and hashes or fails closed.",
                "online_behavior": "No network or external effect is admitted in the candidate.",
                "offline_behavior": "Disposable local synthetic execution is the only admitted path.",
                "degraded_behavior": "Return explicit unavailable/stale/unsupported state; never fabricate or promote output.",
                "security": {"zone": "LOCAL_SYNTHETIC", "data_classes": ["PUBLIC", "SYNTHETIC"], "egress": "DENY"},
                "performance_envelope": {"status": "UNPROVEN", "latency_p95_ms": None, "model_size_limit": None, "memory_limit_mb": None},
                "determinism": {
                    "deterministic": True,
                    "idempotent": idempotent_value,
                    "ordering": "Declared semantic arrays retain order; set-like inputs sort by stable identity.",
                },
                "failure_contract": {
                    "code": failure_code,
                    "condition": metadata_overrides.get(
                        "failure_condition",
                        "The declared atomic outcome is not provable for the exact input revision and delivery profile.",
                    ),
                    "state_preservation": "No canonical mutation or duplicate external/local effect; prior immutable and last-valid state remains labeled by producing revision.",
                    "recovery": (
                        "Correct the input/dependency/authorization and retry through the same seam; the same command key returns the original effect."
                        if idempotent_value
                        else "Correct the input/dependency/authorization and submit a new explicitly identified attempt through the same seam."
                    ),
                },
                "replacement_seam": atom["replacement_seam"],
                "ui_surfaces": [],
                "api_surfaces": [],
                "dependencies": atom["dependencies"],
                "impact_edges": atom["impact_edges"],
                "required_behavior": metadata_overrides.get(
                    "required_behavior",
                    f"Invoke only {atom['capability_leaf']} through the declared execution/delivery path; "
                    "preserve its exact authority, fidelity, references and provenance, and fail closed.",
                ),
                "positive_fixture": metadata_overrides.get(
                    "positive_fixture",
                    f"Invoke {atomic_id} on a nontrivial synthetic/public fixture through its declared surface and independently inspect the typed outcome.",
                ),
                "negative_fixture": metadata_overrides.get(
                    "negative_fixture",
                    f"Use malformed, stale, unauthorized or unsupported input and assert {failure_code}, zero mutation and preserved prior state.",
                ),
                "degraded_offline_fixture": "Remove/unresolve the declared delivery and assert explicit unavailable behavior with no fallback claim.",
                "round_trip_fixture": "Canonical serialize, fresh-process deserialize, replay and compare IDs, refs, ordered diagnostics and semantic digest.",
                "evidence": {
                    "source_pointer": source_pointer,
                    "source_digest": source["source_authority"]["research_annex_sha256"],
                    "evidence_refs": parent["source_evidence_refs"],
                    "evidence_digests": [],
                },
                "candidate_evidence": {
                    "candidate_hash": None, "candidate_clean": None, "command": None,
                    "exit_status": None, "artifact_hashes": [], "provenance": None,
                    "real_dependency_executed": False, "independent_domain_verification": False,
                },
                "lifecycle_status": "TARGET",
                "proof_status": "TARGET",
                "evidence_class": "PARENT_LINEAGE_RESEARCH_ONLY",
                "deceptive_equivalence_flags": equivalence_flags(
                    parent["source_row"], atom["slug"], atom["interaction"],
                    atom["fidelity"], atom["delivery_kind"]
                ),
                "claim_ceiling": "TARGET_ONLY; SYNTHETIC_LOCAL; NO_EXTERNAL_EFFECT; NO_SAFETY_OR_PRODUCTION_CLAIM",
                "verdict": "HOLD",
            }
            records.append(record)
    records.sort(key=lambda item: item["atomic_id"])
    result = {
        "schema_version": "forge.atomic-capability-ledger/1",
        "source_authority": {
            "canonical_atlas_sha256": source["source_authority"]["canonical_atlas_sha256"],
            "research_annex_sha256": source["source_authority"]["research_annex_sha256"],
            "parent_manifest": "docs/research/capability-denominator.v1.json",
        },
        "aggregation_rules": {
            "mandatory_failed": "FAILED", "mandatory_hold": "HOLD",
            "pass": "PASS_ONLY_WHEN_EVERY_MANDATORY_CHILD_MEETS_REQUIRED_TIER",
            "boundary_ceiling": "BOUNDARY_IMPLEMENTED_NEVER_SATISFIES_BEHAVIOR_TIER",
            "adapter_gate": "REAL_PINNED_DEPENDENCY_EXECUTION_AND_INDEPENDENT_DOMAIN_VERIFICATION_REQUIRED",
            "percentages_forbidden": True,
        },
        "records": records,
        "ledger_digest": digest(records),
    }
    return result


def effective_child(record: dict[str, Any]) -> str:
    verdict = record["verdict"]
    if verdict == "FAILED":
        return "FAILED"
    if verdict == "HOLD":
        return "HOLD"
    evidence = record["candidate_evidence"]
    expected_mode = {
        "NATIVE_IMPLEMENTED": "NATIVE",
        "ADOPTED_IMPLEMENTED": "ADOPTED",
        "ADAPTER_IMPLEMENTED": "ADAPTER",
        "BOUNDARY_IMPLEMENTED": "BOUNDARY",
    }[verdict]
    if record["implementation"]["class"] != expected_mode:
        return "HOLD"
    if not (
        evidence["candidate_hash"]
        and evidence["candidate_clean"] is True
        and evidence["command"]
        and evidence["exit_status"] == 0
        and evidence["artifact_hashes"]
        and evidence["provenance"]
        and record["lifecycle_status"] in {"IMPLEMENTED", "DEMONSTRATED"}
        and record["proof_status"] == "DEMONSTRATED"
        and record["evidence_class"] in {"IMMUTABLE_CANDIDATE", "INDEPENDENT_VERIFICATION"}
    ):
        return "HOLD"
    if record["required_proof_tier"] == "BEHAVIOR" and verdict == "BOUNDARY_IMPLEMENTED":
        return "HOLD"
    if verdict in {"ADOPTED_IMPLEMENTED", "ADAPTER_IMPLEMENTED"} and not (
        evidence["real_dependency_executed"] and evidence["independent_domain_verification"]
    ):
        return "HOLD"
    return "PASS"


def aggregate_status(records: list[dict[str, Any]]) -> str:
    states = [effective_child(item) for item in records if item["mandatory"]]
    if not states:
        return "HOLD"
    if "FAILED" in states:
        return "FAILED"
    if "HOLD" in states:
        return "HOLD"
    return "PASS"


def build_aggregate(source: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    by_parent: dict[str, list[dict[str, Any]]] = {}
    for record in ledger["records"]:
        by_parent.setdefault(record["parent_id"], []).append(record)
    parents = []
    for parent in source["parents"]:
        children = sorted(by_parent[parent["parent_id"]], key=lambda item: item["atomic_id"])
        child_ids = [item["atomic_id"] for item in children]
        status = aggregate_status(children)
        implemented_modes = sorted({
            item["verdict"].removesuffix("_IMPLEMENTED")
            for item in children
            if effective_child(item) == "PASS"
        })
        if status == "FAILED":
            reason = "At least one mandatory atomic child is FAILED; percentage aggregation is forbidden."
        elif status == "HOLD":
            reason = "At least one mandatory atomic child is HOLD; percentage aggregation is forbidden."
        else:
            reason = "Every mandatory atomic child independently satisfies its required evidence tier."
        parents.append({
            **parent,
            "child_ids": child_ids,
            "child_manifest_digest": digest(child_ids),
            "child_count": len(children),
            "mandatory_child_count": sum(1 for item in children if item["mandatory"]),
            "verdict_counts": dict(sorted(Counter(item["verdict"] for item in children).items())),
            "aggregate_status": status,
            "implemented_modes": implemented_modes,
            "implementation_mode_display": (
                "NONE" if not implemented_modes else implemented_modes[0] if len(implemented_modes) == 1 else "MIXED"
            ),
            "aggregate_reason": reason,
        })
    result = {
        "schema_version": "forge.capability-aggregate-manifest/1",
        "source_authority": source["source_authority"],
        "aggregation_order": ["FAILED", "HOLD", "PASS"],
        "percentages_forbidden": True,
        "parents": parents,
    }
    result["manifest_digest"] = digest(result)
    return result


def build_vectors(decomposition: dict[str, Any], ledger: dict[str, Any], aggregate: dict[str, Any]) -> dict[str, Any]:
    records = ledger["records"]
    ids = [item["atomic_id"] for item in records]
    return {
        "schema_version": "forge.atomic-capability-integrity/1",
        "parent_count": len(aggregate["parents"]),
        "atomic_count": len(records),
        "mandatory_atomic_count": sum(1 for item in records if item["mandatory"]),
        "verdict_counts": dict(sorted(Counter(item["verdict"] for item in records).items())),
        "aggregate_status_counts": dict(sorted(Counter(item["aggregate_status"] for item in aggregate["parents"]).items())),
        "atomic_ids_digest": digest(ids),
        "decomposition_digest": digest(decomposition),
        "ledger_records_digest": ledger["ledger_digest"],
        "aggregate_manifest_digest": aggregate["manifest_digest"],
        "source_hashes": {
            "canonical_atlas_sha256": ledger["source_authority"]["canonical_atlas_sha256"],
            "research_annex_sha256": ledger["source_authority"]["research_annex_sha256"],
        },
        "aggregation_test_vectors": [
            {"mandatory_states": ["PASS", "FAILED", "PASS"], "expected_parent": "FAILED"},
            {"mandatory_states": ["PASS", "HOLD", "PASS"], "expected_parent": "HOLD"},
            {"mandatory_states": ["PASS", "PASS"], "expected_parent": "PASS"},
            {"mandatory_states": [], "expected_parent": "HOLD"},
        ],
    }


def serialized(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source = json.loads(DENOMINATOR.read_text(encoding="utf-8"))
    decomposition = build_decomposition(source)
    ledger = build_ledger(source, decomposition)
    aggregate = build_aggregate(source, ledger)
    vectors = build_vectors(decomposition, ledger, aggregate)
    outputs = {
        DECOMPOSITION: decomposition,
        LEDGER: ledger,
        AGGREGATE: aggregate,
        VECTORS: vectors,
    }
    if args.write:
        for path, value in outputs.items():
            path.write_text(serialized(value), encoding="utf-8")
    if args.check:
        failed = False
        for path, value in outputs.items():
            expected = serialized(value)
            actual = path.read_text(encoding="utf-8") if path.is_file() else ""
            if actual != expected:
                print(f"GENERATED_MISMATCH {path.relative_to(ROOT)}", file=sys.stderr)
                failed = True
        if failed:
            return 1
    print(f"parents={len(aggregate['parents'])}")
    print(f"atomic_records={len(ledger['records'])}")
    print(f"ledger_digest={ledger['ledger_digest']}")
    print(f"aggregate_digest={aggregate['manifest_digest']}")
    print("ATOMIC_LEDGER_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
