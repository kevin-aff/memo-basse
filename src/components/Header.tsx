import type { Theme } from '../state/appState';
import { cx } from './ui';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'nuit', label: 'Studio' },
  { id: 'carnet', label: 'Carnet' },
];

export function Header({ theme, onTheme }: { theme: Theme; onTheme: (t: Theme) => void }) {
  return (
    <header className="header">
      <div className="header__id">
        <div className="eyebrow">Basse 4 cordes · E A D G</div>
        <h1 className="header__title">Mémo basse</h1>
      </div>
      <div className="segmented" role="group" aria-label="Thème">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cx('seg', theme === t.id && 'is-on')}
            aria-pressed={theme === t.id}
            onClick={() => onTheme(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </header>
  );
}
