import { Injectable, inject } from '@angular/core';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { ActorService } from './actor';
import { COLLECTIONS, SETTINGS_DOC_ID } from './paths';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(FIRESTORE);
  private readonly actor = inject(ActorService);

  /**
   * Revela u oculta el ranking. Al revelar, las pantallas del juez reproducen
   * la animación del podio y los grupos lo ven cuando termina (GROUP_REVEAL_DELAY_MS).
   */
  async setRankingRevealed(revealed: boolean): Promise<void> {
    const actor = this.actor.requireJudge();
    await setDoc(doc(this.db, COLLECTIONS.settings, SETTINGS_DOC_ID), {
      rankingRevealed: revealed,
      revealedAt: revealed ? serverTimestamp() : null,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
  }
}
