/**
 * Réglages du métronome — logique pure, sans React ni DOM.
 *
 * Le clic n'est pas binaire accentué/non accentué : chaque temps porte un **niveau**,
 * de 0 (muet) à 3 (fort). C'est ce qui permet de travailler une mesure dont certains
 * temps se taisent — un 4/4 réduit aux temps 2 et 4, par exemple — sans changer la
 * métrique.
 */

/** Niveau d'un clic : 0 muet, 1 faible, 2 normal, 3 fort. */
export type Accent = 0 | 1 | 2 | 3;

export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;

export const BEATS_MIN = 1;
export const BEATS_MAX = 12;

/** Dénominateurs proposés : l'unité de temps à laquelle le BPM se rapporte. */
export const NOTE_VALUES = [2, 4, 8] as const;

/** Nom français de l'unité de temps, pour dire à quoi le BPM se rapporte. */
export const NOTE_NAME: Record<number, string> = {
  2: 'la blanche',
  4: 'la noire',
  8: 'la croche',
};

export const clampTempo = (bpm: number): number =>
  Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(bpm)));

/**
 * Indication de mouvement correspondant au tempo. Les bornes sont celles retenues
 * par Groove Trainer, qui valent ce que valent toutes les tables de ce genre : les
 * traités ne s'accordent pas au BPM près.
 */
export function tempoName(bpm: number): string {
  if (bpm < 48) return 'Largo';
  if (bpm < 54) return 'Lento';
  if (bpm < 60) return 'Adagio';
  if (bpm < 72) return 'Andante';
  if (bpm < 96) return 'Moderato';
  if (bpm < 116) return 'Allegretto';
  if (bpm < 144) return 'Allegro';
  if (bpm < 176) return 'Vivace';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

export interface Subdivision {
  id: string;
  nom: string;
  /** aide brève, affichée sous le nom */
  sous: string;
  /**
   * Niveaux des clics intercalés **entre** deux temps ; le temps lui-même n'y figure
   * pas. Un 0 laisse la place vide : c'est ainsi qu'on obtient un triolet dont une
   * partie manque, figure de base du travail de la croche swing.
   */
  ticks: Accent[];
}

export const SUBDIVISIONS: Subdivision[] = [
  { id: 'temps', nom: 'Temps seul', sous: 'aucune subdivision', ticks: [] },
  { id: 'binaire', nom: 'Croches', sous: 'deux par temps', ticks: [1] },
  { id: 'triolet', nom: 'Triolets', sous: 'trois par temps', ticks: [1, 1] },
  { id: 'tri13', nom: 'Triolet 1 · 3', sous: 'sans la deuxième', ticks: [0, 1] },
  { id: 'tri12', nom: 'Triolet 1 · 2', sous: 'sans la troisième', ticks: [1, 0] },
  { id: 'doubles', nom: 'Doubles croches', sous: 'quatre par temps', ticks: [1, 1, 1] },
];

/** Motif complet d'un temps, subdivision comprise : sert à le dessiner. */
export const subdivPattern = (i: number): Accent[] => [3, ...(SUBDIVISIONS[i] ?? SUBDIVISIONS[0]).ticks];

export const subdivCount = (i: number): number => (SUBDIVISIONS[i] ?? SUBDIVISIONS[0]).ticks.length + 1;

/** Timbres du clic. */
export const TIMBRES = ['Bois', 'Cloche', 'Bip'] as const;

/** Montée en tempo : le clic accélère seul, par paliers de plusieurs mesures. */
export interface RampSettings {
  on: boolean;
  from: number;
  to: number;
  /** incrément en BPM à chaque palier ; le sens vient de la comparaison from/to */
  step: number;
  /** durée d'un palier, en mesures */
  bars: number;
}

/**
 * Temps intérieur : le clic disparaît quelques mesures et revient. On ne vérifie
 * pas qu'on tient le tempo tant qu'on l'entend — c'est au retour du clic que la
 * dérive s'entend.
 */
export interface GapSettings {
  on: boolean;
  /** mesures avec clic */
  bars: number;
  /** mesures sans clic ; 0 = jamais de silence */
  silent: number;
  /** une chance sur deux par mesure, au lieu de l'alternance régulière */
  random: boolean;
}

/** Une tranche de l'enchaînement : tant de mesures dans telle subdivision. */
export interface Segment {
  bars: number;
  /** index dans {@link SUBDIVISIONS} */
  subdiv: number;
}

/**
 * Enchaînement composé : la subdivision change de mesure en mesure au lieu de rester
 * la même du début à la fin. Une mesure de noires, deux de croches, quatre de doubles —
 * c'est la forme sous laquelle on travaille réellement, et non un clic uniforme.
 *
 * Le même objet sert au métronome et à l'exercice mesuré : c'est ce qui garantit
 * qu'on mesure exactement ce qu'on vient de répéter.
 */
export interface Program {
  on: boolean;
  loop: boolean;
  segs: Segment[];
}

export const SEG_BARS_MAX = 32;

/** Nombre de mesures d'un passage complet. */
export const programBars = (p: Program): number =>
  p.segs.reduce((a, s) => a + Math.max(1, s.bars), 0);

/**
 * Subdivision de la mesure numéro `bar`, ou `null` quand l'enchaînement est terminé
 * — ce qui n'arrive qu'en dehors de la boucle.
 */
export function programSubdivAt(p: Program, bar: number): number | null {
  const total = programBars(p);
  if (total <= 0 || bar < 0) return null;
  const i = p.loop ? bar % total : bar;
  if (i >= total) return null;
  let acc = 0;
  for (const s of p.segs) {
    acc += Math.max(1, s.bars);
    if (i < acc) return s.subdiv;
  }
  return null;
}

/** Un passage déplié en mesures : sert à dessiner l'enchaînement et à bâtir la grille. */
export const programToBars = (p: Program): number[] =>
  p.segs.flatMap((s) => Array<number>(Math.max(1, s.bars)).fill(s.subdiv));

export const DEFAULT_PROGRAM: Program = {
  on: false,
  loop: true,
  segs: [
    { bars: 1, subdiv: 0 },
    { bars: 2, subdiv: 1 },
    { bars: 2, subdiv: 0 },
    { bars: 4, subdiv: 5 },
  ],
};

export interface MetroSettings {
  bpm: number;
  beats: number;
  note: number;
  subdiv: number;
  accents: Accent[];
  /** 0 à 100 */
  volume: number;
  timbre: number;
  ramp: RampSettings;
  gap: GapSettings;
  prog: Program;
}

/** Réglage nommé, conservé d'une séance à l'autre. */
export interface MetroPreset {
  name: string;
  fav: boolean;
  s: MetroSettings;
}

export const cycleAccent = (a: number): Accent => (((a + 1) % 4) as Accent);

/**
 * Ajuste la liste des accents à un nouveau nombre de temps : on garde ceux qui
 * existent, on complète à « normal », et le premier temps reste fort tant qu'on
 * n'y a pas touché.
 */
export function fitAccents(accents: Accent[], beats: number): Accent[] {
  const out = accents.slice(0, beats);
  while (out.length < beats) out.push(out.length === 0 ? 3 : 2);
  return out;
}

export const DEFAULT_RAMP: RampSettings = { on: false, from: 60, to: 120, step: 5, bars: 2 };
export const DEFAULT_GAP: GapSettings = { on: false, bars: 2, silent: 2, random: false };

export const DEFAULT_METRO: MetroSettings = {
  bpm: 80,
  beats: 4,
  note: 4,
  subdiv: 0,
  accents: [3, 2, 2, 2],
  volume: 45,
  timbre: 0,
  ramp: DEFAULT_RAMP,
  gap: DEFAULT_GAP,
  prog: DEFAULT_PROGRAM,
};
