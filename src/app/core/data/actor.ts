import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AppError } from '../firebase/errors';

export interface Actor {
  readonly uid: string;
  readonly name: string;
}

/** Juez que realiza una operación administrativa (para auditoría y judgeId). */
@Injectable({ providedIn: 'root' })
export class ActorService {
  private readonly auth = inject(AuthService);

  requireJudge(): Actor {
    const profile = this.auth.profile();
    if (!profile || profile.role !== 'judge') {
      throw new AppError('Solo los jueces pueden realizar esta operación.');
    }
    return { uid: profile.uid, name: profile.displayName || profile.username };
  }
}
