import { chords, relatives, usableChords } from './chords';
import {
  FRET_MARKS,
  FRET_MAX,
  KEYS,
  MINOR_FAM,
  OPEN_MIDI,
  STRING_A,
  STR_NAMES,
} from './constants';
import { buildRows, pattern, rootFret } from './fretboard';
import { MODE_NAMES, SCALES, formula, modeScale, scaleById, scaleInfo } from './scales';
import { degLabel, spell } from './spelling';
import type { Fret, KeyDef, LabelMode, Panel, Row, Scale, ScaleId } from './types';

export interface ScaleCtx {
  parent: Scale;
  key: KeyDef;
  parentTonic: string;
  hasModes: boolean;
  /** index du mode courant, 0 = gamme mère */
  mi: number;
  /** gamme effective (la gamme mère tournée sur le mode) */
  sc: Scale;
  tonic: string;
  pc: number;
  modeName: string | null;
}

/** Résout gamme + tonalité + mode en une gamme effective et sa tonique orthographiée. */
export function scaleCtx(scaleId: ScaleId, keyPc: number, mode: number): ScaleCtx {
  const parent = scaleById(scaleId);
  const key = KEYS.filter((k) => k.pc === keyPc)[0] ?? KEYS[0];
  const parentTonic = MINOR_FAM[parent.id] ? key.min : key.maj;
  const names = MODE_NAMES[parent.id];
  const hasModes = !!names;
  const mi = names ? Math.min(mode, names.length - 1) : 0;
  const M = modeScale(parent, parentTonic, key.pc, mi);
  return {
    parent,
    key,
    parentTonic,
    hasModes,
    mi,
    sc: M.sc,
    tonic: M.tonic,
    pc: M.pc,
    modeName: names ? names[mi] : null,
  };
}

export interface NeckCell {
  label: string;
  isNote: boolean;
  isRoot: boolean;
  /** case appartenant à une occurrence du motif sur le manche */
  inPos: boolean;
}

export interface NeckRow {
  name: string;
  cells: NeckCell[];
  open: NeckCell;
}

export interface ModeOption {
  tonic: string;
  name: string;
  index: number;
}

export interface KeyOption {
  name: string;
  pc: number;
}

export interface ScaleViewData {
  ctx: ScaleCtx;
  title: string;
  parentLabel: string;
  positionLabel: string;
  keys: KeyOption[];
  modes: ModeOption[];
  rows: Row[];
  frets: Fret[];
  neckRows: NeckRow[];
  neckFrets: Fret[];
  neckHint: string;
  panels: Panel[];
  labelBtn: string;
  /** séquence MIDI du bouton « Écouter la gamme » (montée puis descente) */
  playMidis: number[];
  rootFretNumber: number;
}

export interface ScaleViewInput {
  scaleId: ScaleId;
  keyPc: number;
  mode: number;
  rs: number;
  labels: LabelMode;
  num: boolean;
}

export function buildScaleView(input: ScaleViewInput): ScaleViewData {
  const { rs, num } = input;
  const c = scaleCtx(input.scaleId, input.keyPc, input.mode);
  const { sc, tonic, pc } = c;
  const inf = scaleInfo(sc);
  const f = rootFret(sc, pc, rs);
  const noteMode = input.labels === 'note';

  const r = buildRows(sc, {
    mode: noteMode ? 'note' : 'deg',
    num,
    pc,
    tonic,
    rootFret: f,
    rs,
  });

  // Cases surlignées sur le manche : le motif à chacune de ses occurrences,
  // fondamentale sur la corde de La comme sur celle de Mi.
  const zone: Record<string, boolean> = {};
  const pcMod = ((pc % 12) + 12) % 12;
  [2, 3].forEach((st) => {
    const pp = pattern(sc, st);
    for (let fr = 0; fr <= FRET_MAX; fr++) {
      if ((OPEN_MIDI[st] + fr) % 12 !== pcMod) continue;
      pp.notes.forEach((nn) => {
        const fret = fr + nn.off;
        if (nn.str >= 0 && nn.str <= 3 && fret >= 0 && fret <= FRET_MAX) {
          zone[nn.str + ':' + fret] = true;
        }
      });
    }
  });

  const cellOf = (s: number, fr: number): NeckCell => {
    const iv = ((((OPEN_MIDI[s] + fr) - (OPEN_MIDI[rs] + f)) % 12) + 12) % 12;
    const g = inf[iv];
    const isRoot = !!g && iv === 0;
    return {
      label: g ? (noteMode ? spell(tonic, g.d, pc + g.v) : degLabel(g.d, g.v, num)) : '',
      isNote: !!g && !isRoot,
      isRoot,
      inPos: !!zone[s + ':' + fr],
    };
  };

  const neckRows: NeckRow[] = [];
  for (let s = 0; s < 4; s++) {
    const cells: NeckCell[] = [];
    for (let fr = 1; fr <= FRET_MAX; fr++) cells.push(cellOf(s, fr));
    neckRows.push({ name: STR_NAMES[s], cells, open: cellOf(s, 0) });
  }
  const neckFrets: Fret[] = [];
  for (let fr = 1; fr <= FRET_MAX; fr++) {
    neckFrets.push({ n: FRET_MARKS.indexOf(fr) >= 0 ? String(fr) : '' });
  }

  const dia = chords(sc, pc, tonic);
  const panels: Panel[] = [
    {
      title: 'Formule (tons)',
      big: formula(sc),
      lines: [
        {
          l: 'Intervalles',
          v: sc.semis
            .slice(0, -1)
            .map((v, i) => degLabel(sc.degs[i], v, num))
            .join('  '),
        },
        {
          l: 'Fondamentale',
          v: tonic + ' · fr. ' + f + (rs === STRING_A ? ' (corde La)' : ' (corde Mi)'),
        },
      ],
    },
    {
      title: 'Notes de la gamme',
      big: sc.semis.map((v, i) => spell(tonic, sc.degs[i], pc + v)).join('  '),
      lines: [
        { l: 'Nombre de notes', v: String(sc.semis.length - 1) },
        { l: 'Tessiture du motif', v: '1 octave' },
      ],
    },
    {
      title: dia ? 'Accords diatoniques' : 'Accords associés',
      lines: dia ?? usableChords(sc, tonic, c.mi),
    },
    {
      title: 'Gammes liées',
      lines: relatives(sc, pc, tonic, c.parent, c.parentTonic, c.mi),
    },
  ];

  const names = MODE_NAMES[c.parent.id];
  const modes: ModeOption[] = names
    ? names.map((nom, i) => {
        const mpc = (c.key.pc + c.parent.semis[i]) % 12;
        return {
          tonic: spell(c.parentTonic, c.parent.degs[i], mpc),
          name: nom,
          index: i,
        };
      })
    : [];

  const pp = pattern(sc, rs);
  const up = pp.notes.map((n) => OPEN_MIDI[n.str] + f + n.off);

  return {
    ctx: c,
    title: tonic + (c.modeName ? ' ' + c.modeName.toLowerCase() : ' — ' + sc.nom),
    parentLabel:
      c.mi > 0 ? 'dans ' + c.parentTonic + ' ' + c.parent.nom.toLowerCase() : c.parent.nom,
    positionLabel:
      'Position 1 · fondamentale corde de ' + (rs === STRING_A ? 'La' : 'Mi') + ', frette ' + f,
    keys: KEYS.map((k) => ({
      name: MINOR_FAM[c.parent.id] ? k.min : k.maj,
      pc: k.pc,
    })),
    modes,
    rows: r.rows,
    frets: r.frets,
    neckRows,
    neckFrets,
    neckHint:
      'Cases colorées : les notes du motif, à chacune de ses occurrences (fondamentale sur Mi ou sur La)',
    panels,
    labelBtn: noteMode ? 'Afficher les degrés' : 'Afficher les notes',
    playMidis: up.concat(up.slice(0, -1).reverse()),
    rootFretNumber: f,
  };
}

export interface ScaleCard {
  id: ScaleId;
  name: string;
  count: string;
  degrees: string;
  rows: Row[];
}

/** Cartes de l'index des gammes : motif d'une octave, degrés affichés. */
export function buildScaleCards(rs: number, num: boolean): ScaleCard[] {
  return SCALES.map((sc) => ({
    id: sc.id,
    name: sc.nom,
    count: sc.semis.length - 1 + ' notes',
    degrees: sc.semis
      .slice(0, -1)
      .map((v, i) => degLabel(sc.degs[i], v, num))
      .join('   '),
    rows: buildRows(sc, { mode: 'deg', num, rs }).rows,
  }));
}
