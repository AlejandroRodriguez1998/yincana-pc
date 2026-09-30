export interface Participant {
  readonly id: string;
  readonly name: string;
}

/** Documento groups/{groupId}. Los participantes van embebidos para evitar lecturas extra. */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly participants: readonly Participant[];
  readonly active: boolean;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface GroupInput {
  readonly name: string;
  readonly participants: readonly Participant[];
  readonly active: boolean;
}

export const GROUP_NAME_MAX = 60;
export const PARTICIPANT_NAME_MAX = 80;
export const PARTICIPANTS_MAX = 30;
