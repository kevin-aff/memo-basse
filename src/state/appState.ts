import type { CircleSound } from '../audio/engine';
import { STORAGE_KEY } from '../config';
import type { LabelMode, ScaleId } from '../music/types';
import type { Exercise } from '../music/training';
import {
  BEATS_MAX,
  BEATS_MIN,
  DEFAULT_GAP,
  DEFAULT_METRO,
  DEFAULT_PROGRAM,
  DEFAULT_RAMP,
  fitAccents,
} from '../rhythm/metronome';
import type {
  Accent,
  GapSettings,
  MetroPreset,
  Program,
  RampSettings,
} from '../rhythm/metronome';

export type View = 'menu' | 'home' | 'scale' | 'cercle' | 'train' | 'rythme';
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
  /** rendu sonore au clic sur un secteur */
  cSound: CircleSound;
  /** accords diatoniques en tétrades (4 notes) plutôt qu'en triades */
  cSev: boolean;
  /** tonalité figée : le clic joue l'accord mais ne resélectionne plus */
  cLock: boolean;

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

  // Section Précision rythmique
  /** entrée audio choisie ; vide = entrée par défaut du système */
  rDevice: string;
  rTempo: number;
  rOffBeat: boolean;
  /** latence d'entrée à retrancher aux attaques détectées, en millisecondes */
  rLatencyMs: number;

  // Métronome — `rTempo` lui sert de tempo, partagé avec l'exercice
  /** temps par mesure */
  rBeats: number;
  /** dénominateur de la métrique : l'unité à laquelle le BPM se rapporte */
  rNote: number;
  /** index dans SUBDIVISIONS */
  rSubdiv: number;
  /** niveau d'accent de chaque temps, 0 à 3 */
  rAccents: Accent[];
  /** 0 à 100 */
  rVolume: number;
  rTimbre: number;
  rRamp: RampSettings;
  rGap: GapSettings;
  /** enchaînement composé : sert au métronome comme à l'exercice mesuré */
  rProg: Program;
  /** réglages nommés */
  rPresets: MetroPreset[];
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
  cSound: 'note',
  cSev: true,
  cLock: false,
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
  rDevice: '',
  rTempo: 80,
  rOffBeat: false,
  rLatencyMs: 0,
  rBeats: DEFAULT_METRO.beats,
  rNote: DEFAULT_METRO.note,
  rSubdiv: DEFAULT_METRO.subdiv,
  rAccents: DEFAULT_METRO.accents,
  rVolume: DEFAULT_METRO.volume,
  rTimbre: DEFAULT_METRO.timbre,
  rRamp: DEFAULT_RAMP,
  rGap: DEFAULT_GAP,
  rProg: DEFAULT_PROGRAM,
  rPresets: [],
};

/** Réglages conservés d'une session à l'autre — la navigation, elle, repart du menu. */
const PERSISTED = [
  'theme',
  'labels',
  'rs',
  'cSound',
  'cSev',
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
  'rDevice',
  'rTempo',
  'rOffBeat',
  'rLatencyMs',
  'rBeats',
  'rNote',
  'rSubdiv',
  'rAccents',
  'rVolume',
  'rTimbre',
  'rRamp',
  'rGap',
  'rProg',
  'rPresets',
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
    // Un enregistrement plus ancien peut ignorer des champs ajoutés depuis, et rien
    // ne garantit que la liste des accents ait la longueur de la métrique relue.
    out.rRamp = { ...DEFAULT_RAMP, ...out.rRamp };
    out.rGap = { ...DEFAULT_GAP, ...out.rGap };
    out.rProg = { ...DEFAULT_PROGRAM, ...out.rProg };
    if (!Array.isArray(out.rProg.segs) || !out.rProg.segs.length) {
      out.rProg = { ...out.rProg, segs: DEFAULT_PROGRAM.segs };
    }
    out.rBeats = Math.min(BEATS_MAX, Math.max(BEATS_MIN, Math.round(out.rBeats)));
    out.rAccents = fitAccents(
      Array.isArray(out.rAccents) ? out.rAccents : DEFAULT_METRO.accents,
      out.rBeats,
    );
    if (!Array.isArray(out.rPresets)) out.rPresets = [];
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
