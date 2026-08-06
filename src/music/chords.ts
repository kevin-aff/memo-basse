import { FLAT, KEYS, QUAL, ROMAN, TRI } from './constants';
import { spell } from './spelling';
import type { InfoLine, Scale } from './types';

/** Accords diatoniques d'une gamme à 7 notes. `null` pour les autres gammes. */
export function chords(sc: Scale, pc: number, tonic: string): InfoLine[] | null {
  if (sc.semis.length !== 8) return null;
  const s = sc.semis.slice(0, 7);
  const s7 = s.concat(s.map((x) => x + 12));
  const out: InfoLine[] = [];
  for (let i = 0; i < 7; i++) {
    const r = s7[i];
    const k = `${s7[i + 2] - r}-${s7[i + 4] - r}-${s7[i + 6] - r}`;
    out.push({ l: ROMAN[i], v: spell(tonic, i + 1, pc + r) + (QUAL[k] ?? '') });
  }
  return out;
}

/** Accords sur lesquels poser une gamme sans harmonisation diatonique (penta, blues, modes). */
export function usableChords(sc: Scale, tonic: string, mi: number): InfoLine[] {
  const T = tonic;
  if (mi > 0) {
    const has: Record<number, boolean> = {};
    sc.semis.forEach((v) => {
      has[v % 12] = true;
    });
    const suffix = has[4]
      ? has[10]
        ? '7'
        : has[11]
          ? 'maj7'
          : '6/9'
      : has[3]
        ? has[10]
          ? 'm7'
          : 'm'
        : 'sus4';
    const couleur = has[4] ? 'majeure' : has[3] ? 'mineure' : 'suspendue';
    return [
      { l: 'Couleur', v: couleur },
      { l: 'Sur', v: T + suffix },
      { l: 'Aussi', v: T + (has[7] ? '5' : 'sus4') },
    ];
  }
  switch (sc.id) {
    case 'pmaj':
      return [
        { l: 'Sur', v: T + 'maj7' },
        { l: 'Sur', v: T + '6/9' },
        { l: 'Sur', v: T + 'add9' },
      ];
    case 'pmin':
      return [
        { l: 'Sur', v: T + 'm7' },
        { l: 'Sur', v: T + 'm' },
        { l: 'Blues', v: T + '7' },
      ];
    case 'bmin':
      return [
        { l: 'Sur', v: T + '7' },
        { l: 'Sur', v: T + 'm7' },
        { l: 'Blues en', v: T },
      ];
    case 'bmaj':
      return [
        { l: 'Sur', v: T + '7' },
        { l: 'Sur', v: T + '6' },
        { l: 'Sur', v: T + '9' },
      ];
    default:
      return [];
  }
}

/** Fiche « Gammes liées » : relatives, gamme mère, variantes. */
export function relatives(
  sc: Scale,
  pc: number,
  tonic: string,
  parent: Scale,
  parentTonic: string,
  mi: number,
): InfoLine[] {
  const K = (v: number, minor: boolean): string => {
    const k = KEYS.filter((x) => x.pc === (((pc + v) % 12) + 12) % 12)[0];
    return minor ? k.min : k.maj;
  };
  const T = tonic;

  if (mi > 0) {
    return [
      { l: 'Gamme mère', v: parentTonic + ' ' + parent.nom.toLowerCase() },
      { l: 'Degré', v: ROMAN[mi] + ' de ' + parentTonic },
      { l: 'Mêmes notes que', v: parentTonic + ' ' + parent.nom.toLowerCase() },
    ];
  }

  switch (sc.id) {
    case 'maj':
      return [
        { l: 'Relative mineure', v: K(9, true) + ' min. nat.' },
        { l: 'Penta extraite', v: T + ' penta maj.' },
        { l: 'Parallèle', v: K(0, true) + ' min. nat.' },
      ];
    case 'min':
      return [
        { l: 'Relative majeure', v: K(3, false) + ' majeure' },
        { l: 'Penta extraite', v: T + ' penta min.' },
        { l: 'Variantes', v: T + ' harm. / mélo.' },
      ];
    case 'pmaj':
      return [
        { l: 'Relative mineure', v: K(9, true) + ' penta min.' },
        { l: 'Gamme mère', v: T + ' majeure' },
        { l: '+ ' + FLAT + '3', v: T + ' blues maj.' },
      ];
    case 'pmin':
      return [
        { l: 'Relative majeure', v: K(3, false) + ' penta maj.' },
        { l: 'Gamme mère', v: T + ' min. nat.' },
        { l: '+ ' + FLAT + '5', v: T + ' blues min.' },
      ];
    case 'bmin':
      return [
        { l: 'Relative majeure', v: K(3, false) + ' blues maj.' },
        { l: 'Base', v: T + ' penta min. + ' + FLAT + '5' },
        { l: 'Gamme mère', v: T + ' min. nat.' },
      ];
    case 'bmaj':
      return [
        { l: 'Relative mineure', v: K(9, true) + ' blues min.' },
        { l: 'Base', v: T + ' penta maj. + ' + FLAT + '3' },
        { l: 'Gamme mère', v: T + ' majeure' },
      ];
    case 'harm':
      return [
        { l: 'Base', v: T + ' min. nat. → ' + TRI + '7' },
        { l: 'Accord clé', v: 'V7 = ' + spell(T, 5, pc + 7) + '7' },
        { l: 'Couleur', v: FLAT + '6 → ' + TRI + '7 (seconde augmentée)' },
      ];
    case 'mel':
      return [
        { l: 'Base', v: T + ' min. nat. → ' + TRI + '6 ' + TRI + '7' },
        { l: 'Aussi appelée', v: 'mineure jazz' },
        { l: 'Accord clé', v: T + 'm(maj7)' },
      ];
    default:
      return [];
  }
}
