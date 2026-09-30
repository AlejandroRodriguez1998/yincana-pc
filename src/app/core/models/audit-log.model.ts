/**
 * Documento auditLogs/{id}. Inmutable: las reglas prohíben modificarlo o borrarlo.
 * `entityType` permite ampliar la auditoría a otras operaciones sin cambiar el esquema.
 */
export type AuditEntityType = 'score' | 'group' | 'test';
export type AuditAction = 'create' | 'update' | 'delete';

export type AuditValue = string | number | boolean | null;
export type AuditValues = Readonly<Record<string, AuditValue>>;

export interface AuditLog {
  readonly id: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly groupId: string | null;
  /** Nombres copiados en el momento del cambio: el historial debe sobrevivir a borrados. */
  readonly groupName: string | null;
  readonly testId: string | null;
  readonly testName: string | null;
  readonly before: AuditValues | null;
  readonly after: AuditValues | null;
  readonly note: string | null;
  readonly actorId: string;
  readonly actorName: string;
  readonly at: Date | null;
}
