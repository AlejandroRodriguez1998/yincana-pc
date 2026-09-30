import { Injectable, inject } from '@angular/core';
import {
  FieldValue,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
} from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { AuditAction, AuditEntityType, AuditLog, AuditValues, ScoreValues } from '../models';
import { Actor } from './actor';
import { toAuditLog } from './mappers';
import { COLLECTIONS } from './paths';

export interface AuditDraft {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly groupId?: string | null;
  readonly groupName?: string | null;
  readonly testId?: string | null;
  readonly testName?: string | null;
  readonly before?: AuditValues | null;
  readonly after?: AuditValues | null;
  readonly note?: string | null;
}

/** Forma exacta en la que se escribe una entrada (validada en firestore.rules). */
export interface AuditWrite {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly groupId: string | null;
  readonly groupName: string | null;
  readonly testId: string | null;
  readonly testName: string | null;
  readonly before: AuditValues | null;
  readonly after: AuditValues | null;
  readonly note: string | null;
  readonly actorId: string;
  readonly actorName: string;
  readonly at: FieldValue;
}

/**
 * Construye una entrada de auditoría. Se escribe siempre en la misma
 * transacción/lote que la operación auditada, para que no pueda haber
 * cambios sin registro ni registros de cambios que no llegaron a aplicarse.
 */
export function buildAuditEntry(actor: Actor, draft: AuditDraft): AuditWrite {
  return {
    entityType: draft.entityType,
    entityId: draft.entityId,
    action: draft.action,
    groupId: draft.groupId ?? null,
    groupName: draft.groupName ?? null,
    testId: draft.testId ?? null,
    testName: draft.testName ?? null,
    before: draft.before ?? null,
    after: draft.after ?? null,
    note: draft.note ?? null,
    actorId: actor.uid,
    actorName: actor.name,
    at: serverTimestamp(),
  };
}

export function scoreAuditValues(values: ScoreValues): AuditValues {
  return {
    timeMs: values.timeMs,
    penaltyMs: values.penaltyMs,
    totalMs: values.totalMs,
  };
}

export interface AuditPage {
  readonly items: readonly AuditLog[];
  readonly cursor: QueryDocumentSnapshot | null;
  readonly hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly db = inject(FIRESTORE);

  /**
   * Página del historial (lectura puntual, sin listener: el historial no
   * necesita tiempo real y así solo se paga lo que se consulta).
   */
  async page(options: {
    groupId: string | null;
    cursor: QueryDocumentSnapshot | null;
    size: number;
  }): Promise<AuditPage> {
    const constraints: QueryConstraint[] = [];
    if (options.groupId) constraints.push(where('groupId', '==', options.groupId));
    constraints.push(orderBy('at', 'desc'));
    if (options.cursor) constraints.push(startAfter(options.cursor));
    constraints.push(limit(options.size + 1));

    const snapshot = await getDocs(query(collection(this.db, COLLECTIONS.auditLogs), ...constraints));
    const docs = snapshot.docs.slice(0, options.size);
    return {
      items: docs.map(toAuditLog),
      cursor: docs.at(-1) ?? null,
      hasMore: snapshot.docs.length > options.size,
    };
  }
}
