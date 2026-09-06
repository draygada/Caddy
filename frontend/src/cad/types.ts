export type CadTransferFormat = 'STEP' | 'IGES' | 'STL';
export type CadLengthUnit = 'mm' | 'cm' | 'm' | 'in';
export type CadAngleUnit = 'deg' | 'rad';

export interface CadPoint2D {
  x: number;
  y: number;
}

export type SketchPlane =
  | { kind: 'origin'; plane: 'XY' | 'XZ' | 'YZ' }
  | { kind: 'face'; entityId: string };

interface SketchEntityBase {
  id: string;
  construction: boolean;
}

export type SketchEntity =
  | (SketchEntityBase & { kind: 'line'; start: CadPoint2D; end: CadPoint2D })
  | (SketchEntityBase & { kind: 'circle'; center: CadPoint2D; radius: number })
  | (SketchEntityBase & { kind: 'arc'; center: CadPoint2D; radius: number; startAngle: number; endAngle: number })
  | (SketchEntityBase & { kind: 'rectangle'; origin: CadPoint2D; width: number; height: number })
  | (SketchEntityBase & { kind: 'spline'; points: CadPoint2D[]; closed: boolean });

export type SketchDimensionKind = 'distance' | 'horizontal-distance' | 'vertical-distance' | 'radius' | 'diameter' | 'angle';

export interface SketchDimension {
  id: string;
  kind: SketchDimensionKind;
  entityIds: string[];
  value: number;
  expression: string | null;
  unit: CadLengthUnit | CadAngleUnit;
}

export type SketchConstraintKind =
  | 'coincident'
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'tangent'
  | 'equal'
  | 'concentric'
  | 'fixed';

export interface SketchConstraint {
  id: string;
  kind: SketchConstraintKind;
  entityIds: string[];
}

export interface CadSketch {
  id: string;
  name: string;
  plane: SketchPlane;
  entities: SketchEntity[];
  dimensions: SketchDimension[];
  constraints: SketchConstraint[];
  solverState: 'unresolved' | 'under-constrained' | 'fully-constrained' | 'over-constrained';
}

export interface CadParameter {
  id: string;
  name: string;
  expression: string;
  unit: CadLengthUnit | CadAngleUnit | 'unitless';
  resolvedValue: number | null;
}

export type CadFeatureKind =
  | 'feature.extrude'
  | 'feature.revolve'
  | 'feature.boolean.union'
  | 'feature.boolean.subtract'
  | 'feature.boolean.intersect'
  | 'feature.hole'
  | 'feature.fillet'
  | 'feature.chamfer';

interface CadOperationBase {
  id: string;
  name: string;
  dependsOn: string[];
  suppressed: boolean;
}

export interface SketchCreateOperation extends CadOperationBase {
  kind: 'sketch.create';
  sketch: CadSketch;
}

export interface FeatureOperation extends CadOperationBase {
  kind: CadFeatureKind;
  inputIds: string[];
  targetBodyIds: string[];
  outputBodyName: string | null;
  parameters: Record<string, string | number | boolean>;
}

export interface ParameterSetOperation extends CadOperationBase {
  kind: 'parameter.set';
  parameter: CadParameter;
}

export interface CadAssemblyInstance {
  id: string;
  name: string;
  bodyId: string;
  grounded: boolean;
  transform: {
    translation: [number, number, number];
    rotationDegrees: [number, number, number];
  };
}

export type CadMateKind = 'fixed' | 'coincident' | 'concentric' | 'distance' | 'angle';

export interface CadAssemblyMate {
  id: string;
  name: string;
  kind: CadMateKind;
  instanceAId: string;
  instanceBId: string;
  referenceA: string;
  referenceB: string;
  offset: number;
  unit: CadLengthUnit | CadAngleUnit;
}

export interface AssemblyInstanceOperation extends CadOperationBase {
  kind: 'assembly.instance.add';
  instance: CadAssemblyInstance;
}

export interface AssemblyMateOperation extends CadOperationBase {
  kind: 'assembly.mate.add';
  mate: CadAssemblyMate;
}

export type CadOperation =
  | SketchCreateOperation
  | FeatureOperation
  | ParameterSetOperation
  | AssemblyInstanceOperation
  | AssemblyMateOperation;

export interface CadBody {
  id: string;
  name: string;
  featureIds: string[];
  material: string | null;
  visible: boolean;
  state: 'draft' | 'valid' | 'failed';
}

export interface CadDocument {
  schemaVersion: 'caddydaddy.cad-document/1';
  id: string;
  name: string;
  revisionId: string;
  units: { length: CadLengthUnit; angle: CadAngleUnit };
  parameters: CadParameter[];
  sketches: CadSketch[];
  operations: CadOperation[];
  bodies: CadBody[];
  assembly: {
    instances: CadAssemblyInstance[];
    mates: CadAssemblyMate[];
  };
  importedMeshes?: CadImportedMesh[];
}

export interface CadDependencyNode {
  id: string;
  label: string;
  kind: 'sketch' | 'feature' | 'body' | 'instance' | 'mate' | 'parameter';
  state: 'clean' | 'dirty' | 'failed' | 'suppressed';
}

export interface CadDependencyGraph {
  nodes: CadDependencyNode[];
  edges: Array<{ from: string; to: string; relation: string }>;
}

export interface CadMesh {
  revisionId: string;
  vertices: Array<[number, number, number]>;
  triangles: Array<[number, number, number]>;
  groups: Array<{ bodyId: string; startTriangle: number; triangleCount: number; color: string }>;
}

export interface CadImportedMesh {
  bodyId: string;
  fileName: string;
  format: 'STL';
  sourceHash: string;
  vertices: Array<[number, number, number]>;
  triangles: Array<[number, number, number]>;
}

export interface CadBodyGeometrySummary {
  bodyId: string;
  instanceId: string | null;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  volume: number;
  topology: { faces: number; edges: number; vertices: number };
}

export interface CadGeometrySummary {
  bodies: CadBodyGeometrySummary[];
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  totalVolume: number;
}

export interface CadDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  operationId: string | null;
  entityIds: string[];
}

export interface CadKernelReceipt {
  name: string;
  version: string;
  mode: 'live' | 'recovery-fixture';
  engineMode?: 'CONNECTED_OCCT' | 'BROWSER_JSCAD_BOUNDED';
  computedAt: string;
  artifactHash: string;
}

export interface CadRecomputeRequest {
  document: CadDocument;
  operation: CadOperation;
  expectedRevisionId: string;
}

export interface CadRecomputeResponse {
  document: CadDocument;
  revisionId: string;
  documentHash: string;
  dependencyGraph: CadDependencyGraph;
  dependencyGraphHash?: string;
  mesh: CadMesh;
  geometry?: CadGeometrySummary;
  diagnostics: CadDiagnostic[];
  kernel: CadKernelReceipt;
}

export interface CadImportRequest {
  format: CadTransferFormat;
  fileName: string;
  dataBase64: string;
  expectedRevisionId: string;
}

export interface CadExportRequest {
  document: CadDocument;
  format: CadTransferFormat;
  revisionId: string;
}

export interface CadExportResponse {
  fileName: string;
  format: CadTransferFormat;
  mimeType: string;
  dataBase64: string;
  revisionId: string;
  documentHash: string;
}
