/**
 * Notation des degrés dans les diagrammes et les fiches.
 * `sym` → `R  ᐃ2  ♭3  p4  p5  ♭7`, `num` → `1  2  ♭3  4  5  ♭7`.
 * (Prop `degreeStyle` de la référence de design.)
 */
export type DegreeStyle = 'sym' | 'num';

export const DEGREE_STYLE: DegreeStyle = 'sym';

/** Raccourci consommé par les fonctions de libellé. */
export const DEGREE_NUM: boolean = (DEGREE_STYLE as string) === 'num';

/** Clé de stockage des réglages persistés. */
export const STORAGE_KEY = 'memo-basse:v1';
