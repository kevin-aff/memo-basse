import raw from '../../repertoire_gammes.csv?raw';

export interface SongKey {
  pc: number;
  minor: boolean;
}

export interface Song {
  titre: string;
  artiste: string;
  annee: string;
  style: string;
  /** valeur brute de la colonne Tonalité, annotations comprises */
  tonalite: string;
  tempo: string;
  difficulte: number;
  progression: string;
  penta: string;
  notes: string;
  /** tonalités reconnues — plusieurs quand la fiche en mentionne plusieurs */
  keys: SongKey[];
}

/** CSV minimal mais correct : guillemets, virgules et retours à la ligne échappés. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Hauteur de chaque nom de note français. */
const NOTES_FR: Record<string, number> = {
  do: 0,
  ré: 2,
  re: 2,
  mi: 4,
  fa: 5,
  sol: 7,
  la: 9,
  si: 11,
};

/** Modes cités dans le répertoire, et leur couleur majeure ou mineure. */
const MODES_FR: Record<string, boolean> = {
  ionien: false,
  lydien: false,
  mixolydien: false,
  dorien: true,
  phrygien: true,
  éolien: true,
  eolien: true,
  locrien: true,
};

const KEY_RE = /^(do|ré|re|mi|fa|sol|la|si)\s*(#|b|♯|♭)?\s*(.*)$/i;

/**
 * Lit une valeur de la colonne Tonalité.
 *
 * Le champ est saisi à la main : il peut porter une annotation entre parenthèses
 * (`Sol (doigté)`), citer deux tonalités (`Mi min / Sol`, `Si min (couplet) / Ré (refrain)`)
 * ou nommer un mode (`Ré dorien → Mib`). Renvoie toutes les tonalités reconnues.
 */
export function parseTonalite(value: string): SongKey[] {
  // Les parenthèses d'abord : elles peuvent contenir un « / » qui n'est pas un séparateur.
  const cleaned = value.replace(/\([^)]*\)/g, ' ');
  const out: SongKey[] = [];

  cleaned.split(/[/→]/).forEach((part) => {
    const m = KEY_RE.exec(part.trim());
    if (!m) return;
    const base = NOTES_FR[m[1].toLowerCase()];
    if (base === undefined) return;
    const alt = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
    const pc = (((base + alt) % 12) + 12) % 12;

    const rest = m[3].toLowerCase();
    const mode = Object.keys(MODES_FR).find((k) => rest.includes(k));
    const minor = mode ? MODES_FR[mode] : /\bmin/.test(rest) || /\bmineur/.test(rest);

    if (!out.some((k) => k.pc === pc && k.minor === minor)) out.push({ pc, minor });
  });

  return out;
}

function buildSongs(): { songs: Song[]; unparsed: string[] } {
  const rows = parseCsv(raw.replace(/^﻿/, ''));
  const head = rows[0].map((h) => h.trim());
  const col = (name: string): number => head.indexOf(name);
  const iTitre = col('Titre');
  const iArtiste = col('Artiste');
  const iAnnee = col('Année');
  const iStyle = col('Style');
  const iTon = col('Tonalité');
  const iTempo = col('Tempo_BPM');
  const iDiff = col('Difficulté_basse');
  const iProg = col('Progression');
  const iPenta = col('Penta_utile');
  const iNotes = col('Notes');

  const songs: Song[] = [];
  const unparsed: string[] = [];

  rows.slice(1).forEach((r) => {
    const at = (i: number): string => (i >= 0 ? (r[i] ?? '').trim() : '');
    const tonalite = at(iTon);
    const keys = parseTonalite(tonalite);
    if (!keys.length && tonalite) unparsed.push(tonalite);
    songs.push({
      titre: at(iTitre),
      artiste: at(iArtiste),
      annee: at(iAnnee),
      style: at(iStyle),
      tonalite,
      tempo: at(iTempo),
      difficulte: Number.parseInt(at(iDiff), 10) || 0,
      progression: at(iProg),
      penta: at(iPenta),
      notes: at(iNotes),
      keys,
    });
  });

  return { songs, unparsed };
}

const built = buildSongs();

export const SONGS: Song[] = built.songs;
/** Valeurs de tonalité que le lecteur n'a pas su interpréter — vide si tout passe. */
export const UNPARSED_KEYS: string[] = built.unparsed;

/**
 * Morceaux d'une tonalité donnée, triés par année.
 *
 * @param minor la gamme courante a une tierce mineure
 */
export function songsFor(pc: number, minor: boolean): Song[] {
  return SONGS.filter((s) => s.keys.some((k) => k.pc === pc && k.minor === minor)).sort(
    (a, b) => (Number(a.annee) || 0) - (Number(b.annee) || 0),
  );
}

/** Même tonique, couleur opposée — proposé quand la tonalité exacte ne donne rien. */
export function songsForOtherQuality(pc: number, minor: boolean): Song[] {
  return songsFor(pc, !minor);
}
