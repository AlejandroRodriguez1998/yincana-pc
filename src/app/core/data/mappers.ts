import { DocumentSnapshot, Timestamp } from 'firebase/firestore';
import {
  AuditAction,
  AuditEntityType,
  AuditLog,
  AuditValue,
  AuditValues,
  CompetitionSettings,
  Group,
  JudgeRequest,
  Participant,
  PublicStanding,
  PublicStandings,
  Score,
  StandingGroup,
  StandingResult,
  Standings,
  Test,
  UserProfile,
  UserRole,
} from '../models';

/*
 * Conversión defensiva de documentos de Firestore a modelos tipados.
 * Los datos se tratan como `unknown` para no propagar `any` del SDK.
 */

type Data = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function date(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function dataOf(snapshot: DocumentSnapshot): Data {
  // serverTimestamps: 'estimate' evita nulls transitorios en escrituras locales pendientes.
  return snapshot.data({ serverTimestamps: 'estimate' }) ?? {};
}

export function toUserProfile(snapshot: DocumentSnapshot): UserProfile {
  const d = dataOf(snapshot);
  const role: UserRole = d['role'] === 'judge' ? 'judge' : 'group';
  return {
    uid: snapshot.id,
    role,
    groupId: role === 'group' ? strOrNull(d['groupId']) : null,
    displayName: str(d['displayName']),
    username: str(d['username']),
    createdAt: date(d['createdAt']),
  };
}

function toParticipant(value: unknown): Participant | null {
  if (!isRecord(value)) return null;
  const id = str(value['id']);
  const name = str(value['name']);
  return id && name ? { id, name } : null;
}

export function toGroup(snapshot: DocumentSnapshot): Group {
  const d = dataOf(snapshot);
  const raw = Array.isArray(d['participants']) ? (d['participants'] as unknown[]) : [];
  return {
    id: snapshot.id,
    name: str(d['name'], 'Sin nombre'),
    participants: raw.map(toParticipant).filter((p): p is Participant => p !== null),
    active: bool(d['active'], true),
    createdAt: date(d['createdAt']),
    updatedAt: date(d['updatedAt']),
  };
}

export function toTest(snapshot: DocumentSnapshot): Test {
  const d = dataOf(snapshot);
  return {
    id: snapshot.id,
    name: str(d['name'], 'Sin nombre'),
    description: str(d['description']),
    order: num(d['order']),
    active: bool(d['active'], true),
    // Las pruebas antiguas (sin `kind`) son de cronómetro.
    kind: d['kind'] === 'simon' ? 'simon' : 'timer',
    createdAt: date(d['createdAt']),
    updatedAt: date(d['updatedAt']),
  };
}

export function toScore(snapshot: DocumentSnapshot): Score {
  const d = dataOf(snapshot);
  return {
    id: snapshot.id,
    groupId: str(d['groupId']),
    testId: str(d['testId']),
    timeMs: num(d['timeMs']),
    penaltyMs: num(d['penaltyMs']),
    totalMs: num(d['totalMs']),
    judgeId: str(d['judgeId']),
    judgeName: str(d['judgeName']),
    auditId: str(d['auditId']),
    createdAt: date(d['createdAt']),
    updatedAt: date(d['updatedAt']),
  };
}

const AUDIT_ENTITIES: readonly AuditEntityType[] = ['score', 'group', 'test'];
const AUDIT_ACTIONS: readonly AuditAction[] = ['create', 'update', 'delete'];

function toAuditValues(value: unknown): AuditValues | null {
  if (!isRecord(value)) return null;
  const result: Record<string, AuditValue> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      result[key] = v;
    }
  }
  return result;
}

export function toAuditLog(snapshot: DocumentSnapshot): AuditLog {
  const d = dataOf(snapshot);
  const entityType = AUDIT_ENTITIES.find((e) => e === d['entityType']) ?? 'score';
  const action = AUDIT_ACTIONS.find((a) => a === d['action']) ?? 'update';
  return {
    id: snapshot.id,
    entityType,
    entityId: str(d['entityId']),
    action,
    groupId: strOrNull(d['groupId']),
    groupName: strOrNull(d['groupName']),
    testId: strOrNull(d['testId']),
    testName: strOrNull(d['testName']),
    before: toAuditValues(d['before']),
    after: toAuditValues(d['after']),
    note: strOrNull(d['note']),
    actorId: str(d['actorId']),
    actorName: str(d['actorName']),
    at: date(d['at']),
  };
}

function toStandingResult(value: unknown): StandingResult | null {
  if (!isRecord(value)) return null;
  // Los resultados sin totalMs (formato antiguo) se ignoran.
  const totalMs = numOrNull(value['totalMs']);
  return totalMs === null ? null : { totalMs, penaltyMs: num(value['penaltyMs']) };
}

function toStandingGroup(value: unknown): StandingGroup | null {
  if (!isRecord(value)) return null;
  const results: Record<string, StandingResult> = {};
  if (isRecord(value['results'])) {
    for (const [testId, raw] of Object.entries(value['results'])) {
      const result = toStandingResult(raw);
      if (result) results[testId] = result;
    }
  }
  return { name: str(value['name'], 'Sin nombre'), active: bool(value['active'], true), results };
}

export function toStandings(snapshot: DocumentSnapshot): Standings {
  const d = dataOf(snapshot);
  const groups: Record<string, StandingGroup> = {};
  if (isRecord(d['groups'])) {
    for (const [groupId, raw] of Object.entries(d['groups'])) {
      const group = toStandingGroup(raw);
      if (group) groups[groupId] = group;
    }
  }
  return { groups };
}

function toPublicStanding(value: unknown): PublicStanding | null {
  if (!isRecord(value)) return null;
  return {
    name: str(value['name'], 'Sin nombre'),
    active: bool(value['active'], true),
    totalMs: num(value['totalMs']),
    completed: num(value['completed']),
  };
}

export function toPublicStandings(snapshot: DocumentSnapshot): PublicStandings {
  const d = dataOf(snapshot);
  const groups: Record<string, PublicStanding> = {};
  if (isRecord(d['groups'])) {
    for (const [groupId, raw] of Object.entries(d['groups'])) {
      const group = toPublicStanding(raw);
      if (group) groups[groupId] = group;
    }
  }
  return { groups };
}

export function toSettings(snapshot: DocumentSnapshot): CompetitionSettings {
  const d = dataOf(snapshot);
  return { rankingRevealed: d['rankingRevealed'] === true, revealedAt: date(d['revealedAt']) };
}

export function toJudgeRequest(snapshot: DocumentSnapshot): JudgeRequest {
  const d = dataOf(snapshot);
  return {
    uid: snapshot.id,
    displayName: str(d['displayName'], 'Sin nombre'),
    email: str(d['email']),
    status: d['status'] === 'rejected' ? 'rejected' : 'pending',
    createdAt: date(d['createdAt']),
  };
}
