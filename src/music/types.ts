export type ScaleId =
  | 'maj'
  | 'min'
  | 'pmaj'
  | 'pmin'
  | 'bmin'
  | 'bmaj'
  | 'harm'
  | 'mel';

/**
 * `semis` : intervalles en demi-tons depuis la fondamentale, octave incluse.
 * `degs`  : degré diatonique de chaque note — c'est lui qui impose la lettre
 *           lors de l'orthographe (blues mineure = 1 ♭3 4 ♭5 5 ♭7).
 */
export interface Scale {
  id: ScaleId;
  nom: string;
  semis: number[];
  degs: number[];
}

export interface KeyDef {
  pc: number;
  maj: string;
  min: string;
}

/** Une note de la gamme placée sur le manche, en coordonnées relatives. */
export interface PatternNote {
  /** index de corde, 0 = Sol (aiguë) … 3 = Mi (grave) */
  str: number;
  /** frette relative à la frette de fondamentale */
  off: number;
  /** demi-tons depuis la fondamentale */
  v: number;
  /** degré diatonique */
  d: number;
}

export interface Pattern {
  notes: PatternNote[];
  /** première et dernière frette relative de la fenêtre affichée */
  start: number;
  end: number;
  nmin: number;
  nmax: number;
}

export interface Cell {
  label: string;
  isNote: boolean;
  isRoot: boolean;
  isGhost: boolean;
  isGhostRoot: boolean;
  /** note en cours de lecture (section Entraînement) */
  isPlay?: boolean;
}

export interface Row {
  name: string;
  cells: Cell[];
}

export interface Fret {
  n: string;
}

export interface InfoLine {
  l: string;
  v: string;
}

export interface Panel {
  title: string;
  big?: string;
  lines: InfoLine[];
}

/** Gamme d'un mode : la gamme tournée, sa tonique orthographiée et son nom. */
export interface ModeScale {
  sc: Scale;
  pc: number;
  tonic: string;
  name: string;
}

export type LabelMode = 'note' | 'deg';
