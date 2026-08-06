import { useMemo, useState } from 'react';
import { songsFor, songsForOtherQuality } from '../data/repertoire';
import type { SongMatch } from '../data/repertoire';
import { KEYS } from '../music/constants';
import { cx } from './ui';

/**
 * Libellé d'une tonalité, avec l'orthographe que l'application emploie pour cette
 * couleur : la même hauteur se nomme A♭ en majeur et G♯ en mineur.
 */
function keyLabel(pc: number, minor: boolean): string {
  const k = KEYS.filter((x) => x.pc === ((pc % 12) + 12) % 12)[0];
  return (minor ? k.min : k.maj) + (minor ? ' mineur' : ' majeur');
}

const difficulte = (n: number): string =>
  n > 0 ? '●'.repeat(Math.min(n, 5)) + '○'.repeat(Math.max(0, 5 - n)) : '';

function SongRow({ song, viaPenta }: SongMatch) {
  return (
    <li className="song">
      <div className="song__head">
        <span className="song__title">
          {song.titre}
          {viaPenta ? (
            <span className="song__tag" title={`Penta utile : ${song.penta}`}>
              penta
            </span>
          ) : null}
        </span>
        <span className="song__stats">
          {song.tempo ? <span className="song__tempo">{song.tempo} BPM</span> : null}
          {song.difficulte ? (
            <span
              className="song__diff"
              aria-label={`difficulté ${song.difficulte} sur 5`}
              title={`Difficulté basse : ${song.difficulte}/5`}
            >
              {difficulte(song.difficulte)}
            </span>
          ) : null}
        </span>
      </div>
      <div className="song__meta">
        {[song.artiste, song.annee, song.style].filter(Boolean).join(' · ')}
      </div>
      {song.progression ? <div className="song__prog">{song.progression}</div> : null}
      {song.notes ? <div className="song__notes">{song.notes}</div> : null}
    </li>
  );
}

/** Morceaux du répertoire jouables dans la tonalité affichée. */
export function Repertoire({ pc, minor }: { pc: number; minor: boolean }) {
  const [open, setOpen] = useState(true);
  const songs = useMemo(() => songsFor(pc, minor), [pc, minor]);
  const others = useMemo(
    () => (songs.length ? [] : songsForOtherQuality(pc, minor)),
    [pc, minor, songs.length],
  );

  return (
    <section className="card card--neck repertoire">
      <div className="repertoire__head">
        <h3 className="eyebrow">
          Répertoire · {songs.length} morceau{songs.length > 1 ? 'x' : ''} en{' '}
          {keyLabel(pc, minor)}
        </h3>
        {songs.length ? (
          <button
            type="button"
            className="btn btn--toggle btn--sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Masquer' : `Voir les ${songs.length} morceaux`}
          </button>
        ) : null}
      </div>

      {songs.length ? (
        <ul className={cx('song-list', !open && 'is-hidden')}>
          {songs.map((m) => (
            <SongRow key={m.song.titre + m.song.artiste} song={m.song} viaPenta={m.viaPenta} />
          ))}
        </ul>
      ) : (
        <p className="repertoire__empty">
          Aucun morceau du répertoire dans cette tonalité.
          {others.length ? ` En revanche, ${others.length} en ${keyLabel(pc, !minor)}.` : ''}
        </p>
      )}
    </section>
  );
}
