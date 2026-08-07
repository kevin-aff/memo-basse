import type { View } from '../state/appState';
import { gridStyle } from '../components/ui';

const ENTRIES: { num: string; title: string; desc: string; view: View }[] = [
  {
    num: '01',
    title: 'Gammes',
    desc: "Motifs d'une octave, modes, 12 tonalités et manche complet.",
    view: 'home',
  },
  {
    num: '02',
    title: 'Cercle des quintes',
    desc: 'Armures, tonalités voisines et relatives mineures.',
    view: 'cercle',
  },
  {
    num: '03',
    title: 'Entraînement',
    desc: 'Répétition des gammes au tempo, mode par mode.',
    view: 'train',
  },
  {
    num: '04',
    title: 'Précision rythmique',
    desc: 'Jouez dans la carte son, mesurez votre placement note à note.',
    view: 'rythme',
  },
];

export function MenuView({ onOpen }: { onOpen: (v: View) => void }) {
  return (
    <nav className="grid menu-grid" style={gridStyle('300px', '16px')} aria-label="Sections">
      {ENTRIES.map((e) => (
        <button key={e.num} type="button" className="menu-card" onClick={() => onOpen(e.view)}>
          <span className="eyebrow">{e.num}</span>
          <span className="menu-card__title">{e.title}</span>
          <span className="menu-card__desc">{e.desc}</span>
        </button>
      ))}
    </nav>
  );
}
