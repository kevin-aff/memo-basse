import { STORAGE_KEY } from '../config';
import type { LabelMode, ScaleId } from '../music/types';
import type { Exercise } from '../music/training';

export type View = 'menu' | 'home' | 'scale' | 'cercle' | 'train';
export type Theme = 'nuit' | 'carnet';
export type Sound = 'notes' | 'click';

export interface AppState {
  view: View;
  theme: Theme;

  // Section Gammes
  scaleId: ScaleId;
  keyPc: number;
  mode: number;
  labels: LabelMode;
  /** corde de la fondamentale : 2 = La, 3 = Mi */
  rs: number;

  // Section Cercle des quintes
  cPc: number;
  cMin: boolean;

  // Section Entraînement
  tScale: ScaleId;
  tKey: number;
  tRs: number;
  tEx: Exercise;
  tMode: number;
  tFull: boolean;
  tMotif: string;
  tempo: number;
  tLoop: boolean;
  tSound: Sound;
}

export const INITIAL_STATE: AppState = {
  view: 'menu',
  theme: 'nuit',
  scaleId: 'maj',
  keyPc: 0,
  mode: 0,
  labels: 'note',
  rs: 2,
  cPc: 0,
  cMin: false,
  tScale: 'maj',
  tKey: 0,
  tRs: 2,
  tEx: 'one',
  tMode: 0,
  tFull: false,
  tMotif: 'lin',
  tempo: 70,
  tLoop: false,
  tSound: 'notes',
};

/** Réglages conservés d'une session à l'autre — la navigation, elle, repart du menu. */
const PERSISTED = [
  'theme',
  'labels',
  'rs',
  'tScale',
  'tKey',
  'tRs',
  'tEx',
  'tMode',
  'tFull',
  'tMotif',
  'tempo',
  'tLoop',
  'tSound',
] as const satisfies readonly (keyof AppState)[];

export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const saved = JSON.parse(raw) as Partial<AppState>;
    const out: AppState = { ...INITIAL_STATE };
    PERSISTED.forEach((k) => {
      if (saved[k] !== undefined) {
        // PERSISTED est un sous-ensemble de keyof AppState (garanti par le `satisfies`
        // ci-dessus), mais TypeScript ne sait pas relier out[k] et saved[k] sur une clé
        // d'union — d'où cette écriture non typée, confinée à cette ligne.
        (out as unknown as Record<string, unknown>)[k] = saved[k];
      }
    });
    return out;
  } catch {
    return INITIAL_STATE;
  }
}

export function saveState(s: AppState): void {
  try {
    const out: Record<string, unknown> = {};
    PERSISTED.forEach((k) => {
      out[k] = s[k];
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* stockage indisponible (mode privé, quota) : on continue sans persistance */
  }
}
