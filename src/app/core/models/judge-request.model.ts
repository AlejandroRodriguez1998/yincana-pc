/**
 * Documento judgeRequests/{uid}: solicitud de alta como juez desde /alta-jueces.
 * Mientras no se apruebe, la cuenta no tiene perfil en users/{uid} y por tanto
 * ningún permiso sobre la competición.
 */
export type JudgeRequestStatus = 'pending' | 'rejected';

export interface JudgeRequest {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly status: JudgeRequestStatus;
  readonly createdAt: Date | null;
}

export const JUDGE_NAME_MAX = 80;
export const JUDGE_PASSWORD_MIN = 8;
