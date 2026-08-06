import { FLAT, LETTERS, MAJREF, NAT, SHARP, TRI } from './constants';

const acc = (d: number): string =>
  d > 0 ? SHARP.repeat(Math.min(d, 2)) : d < 0 ? FLAT.repeat(Math.min(-d, 2)) : '';

/**
 * Orthographe correcte d'une note : la lettre est imposée par le degré, l'altération
 * est déduite de la hauteur réelle. C'est ce qui donne `E♭` et non `D♯` en do blues mineure.
 *
 * @param tonic tonique orthographiée de la gamme (ex. `C`, `E♭`)
 * @param deg   degré diatonique de la note (1 à 7)
 * @param pc    hauteur de la note en demi-tons (modulo 12 appliqué)
 */
export function spell(tonic: string, deg: number, pc: number): string {
  const L = LETTERS[(LETTERS.indexOf(tonic.charAt(0)) + deg - 1) % 7];
  let d = (((pc - NAT[L]) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return L + acc(d);
}

/**
 * Libellé d'un degré : `R`, `ᐃ2`, `♭3`, `p4`, `p5`, `♭7`… ou `1`/`2`/`♭3`/`4`/`5`
 * quand `num` est vrai (réglage de notation `degreeStyle = "num"`).
 */
export function degLabel(deg: number, semi: number, num: boolean): string {
  let d = (((semi % 12) + 12) % 12) - MAJREF[deg - 1];
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  if (deg === 1 && d === 0) return num ? '1' : 'R';
  const a =
    d === 0 ? (num ? '' : deg === 4 || deg === 5 ? 'p' : TRI) : acc(d);
  return a + deg;
}
