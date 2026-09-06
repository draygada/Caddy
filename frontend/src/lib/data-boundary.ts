export const DATA_CLASS_OPTIONS = [
  { value: 'PUBLIC', label: 'PUBLIC' },
  { value: 'SYNTHETIC', label: 'SYNTHETIC' },
  { value: 'CUI', label: 'CUI' },
  { value: 'ITAR_CONTROLLED_TECHNICAL_DATA', label: 'ITAR-controlled technical data' },
  { value: 'EXPORT_CONTROLLED_CUSTOMER_DESIGN', label: 'Export-controlled customer design' },
  { value: 'SECRET', label: 'Secret' },
  { value: 'CREDENTIAL', label: 'Credential' },
] as const;

export type DeploymentDataClass = (typeof DATA_CLASS_OPTIONS)[number]['value'];
export type AllowedDataClass = Extract<DeploymentDataClass, 'PUBLIC' | 'SYNTHETIC'>;
export type BlockedDataClass = Exclude<DeploymentDataClass, AllowedDataClass>;

export const DATA_BOUNDARY_POLICY = {
  deployment: 'HACKATHON',
  allowedDataClasses: ['PUBLIC', 'SYNTHETIC'] as const,
  authentication: 'NONE',
  govCloudAssurance: 'NONE',
  contentScanning: 'NONE',
} as const;

const BLOCK_REASONS: Record<BlockedDataClass, string> = {
  CUI: 'Blocked: CUI is not permitted in this hackathon deployment.',
  ITAR_CONTROLLED_TECHNICAL_DATA: 'Blocked: ITAR-controlled technical data is not permitted in this hackathon deployment.',
  EXPORT_CONTROLLED_CUSTOMER_DESIGN: 'Blocked: export-controlled customer designs are not permitted in this hackathon deployment.',
  SECRET: 'Blocked: secrets are not permitted. Remove the secret and use only PUBLIC or SYNTHETIC data.',
  CREDENTIAL: 'Blocked: credentials are not permitted. Do not enter tokens, passwords, keys, or certificates.',
};

export type DataBoundaryDecision =
  | { allowed: true; classification: AllowedDataClass; reason: string }
  | { allowed: false; classification: string | null; reason: string };

export function assessDataBoundary(selection: string | null | undefined): DataBoundaryDecision {
  if (selection === 'PUBLIC' || selection === 'SYNTHETIC') {
    return {
      allowed: true,
      classification: selection,
      reason: `${selection} data is permitted for this hackathon deployment.`,
    };
  }

  if (selection && Object.prototype.hasOwnProperty.call(BLOCK_REASONS, selection)) {
    return {
      allowed: false,
      classification: selection,
      reason: BLOCK_REASONS[selection as BlockedDataClass],
    };
  }

  return {
    allowed: false,
    classification: selection || null,
    reason: selection
      ? 'Blocked: the selected data class is not recognized. This deployment fails closed.'
      : 'Select PUBLIC or SYNTHETIC before opening the application. All other data classes are blocked.',
  };
}
