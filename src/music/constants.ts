import type { KeyDef } from './types';

export const SHARP = '♯'; // ♯
export const FLAT = '♭'; // ♭
export const TRI = 'ᐃ'; // ᐃ — marque le degré majeur / juste en notation symbolique

/** Les 12 tonalités, avec orthographe majeure et mineure distinctes. */
export const KEYS: KeyDef[] = [
  { pc: 0, maj: 'C', min: 'C' },
  { pc: 1, maj: 'D' + FLAT, min: 'C' + SHARP },
  { pc: 2, maj: 'D', min: 'D' },
  { pc: 3, maj: 'E' + FLAT, min: 'E' + FLAT },
  { pc: 4, maj: 'E', min: 'E' },
  { pc: 5, maj: 'F', min: 'F' },
  { pc: 6, maj: 'F' + SHARP, min: 'F' + SHARP },
  { pc: 7, maj: 'G', min: 'G' },
  { pc: 8, maj: 'A' + FLAT, min: 'G' + SHARP },
  { pc: 9, maj: 'A', min: 'A' },
  { pc: 10, maj: 'B' + FLAT, min: 'B' + FLAT },
  { pc: 11, maj: 'B', min: 'B' },
];

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Hauteur naturelle de chaque lettre, sans altération. */
export const NAT: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Intervalles de la gamme majeure, référence pour le calcul d'altération d'un degré. */
export const MAJREF = [0, 2, 4, 5, 7, 9, 11];

/** Gammes dont la tonalité s'orthographie avec la convention mineure. */
export const MINOR_FAM: Record<string, boolean> = {
  min: true,
  pmin: true,
  bmin: true,
  harm: true,
  mel: true,
};

/** Cordes à vide en MIDI : G2 D2 A1 E1 — index 0 = corde aiguë. */
export const OPEN_MIDI = [43, 38, 33, 28];
export const STR_NAMES = ['G', 'D', 'A', 'E'];

/** Nom français des cordes, pour les libellés lus par les lecteurs d'écran. */
export const STR_NAMES_FR: Record<string, string> = {
  G: 'Sol',
  D: 'Ré',
  A: 'La',
  E: 'Mi',
};

/** Index de corde de la fondamentale. */
export const STRING_A = 2;
export const STRING_E = 3;

/** Qualité d'accord par empreinte d'intervalles (tierce-quinte) — triades. */
export const QUAL3: Record<string, string> = {
  '4-7': '',
  '3-7': 'm',
  '3-6': '°',
  '4-8': '+',
  '3-8': 'm(' + SHARP + '5)',
  '2-7': 'sus2',
  '5-7': 'sus4',
};

/** Qualité d'accord par empreinte d'intervalles (tierce-quinte-septième) — tétrades. */
export const QUAL: Record<string, string> = {
  '4-7-11': 'maj7',
  '4-7-10': '7',
  '3-7-10': 'm7',
  '3-6-10': 'm7' + FLAT + '5',
  '3-6-9': 'dim7',
  '4-8-11': 'maj7' + SHARP + '5',
  '3-7-11': 'm(maj7)',
  '4-8-10': '7' + SHARP + '5',
  '3-7-9': 'm6',
};

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Dernière frette représentée sur le manche complet. */
export const FRET_MAX = 19;
/** Frettes portant un repère. */
export const FRET_MARKS = [3, 5, 7, 9, 12, 15, 17, 19];
