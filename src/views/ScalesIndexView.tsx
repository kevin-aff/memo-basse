import { useMemo } from 'react';
import { Fretboard, fretboardLabel } from '../components/Fretboard';
import { RootToggle } from '../components/RootToggle';
import { BackButton, gridStyle } from '../components/ui';
import { DEGREE_NUM } from '../config';
import { STRING_A } from '../music/constants';
import { buildScaleCards } from '../music/scaleView';
import type { ScaleId } from '../music/types';

export function ScalesIndexView({
  rs,
  onRs,
  onOpen,
  onBack,
}: {
  rs: number;
  onRs: (rs: number) => void;
  onOpen: (id: ScaleId) => void;
  onBack: () => void;
}) {
  const cards = useMemo(() => buildScaleCards(rs, DEGREE_NUM), [rs]);

  const ghostNote =
    rs === STRING_A
      ? 'Les pastilles translucides sur la corde de Mi sont les notes de la gamme situées sous la fondamentale.'
      : 'Les pastilles translucides sur la corde de Sol prolongent la gamme au-dessus de l’octave.';

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Menu" onClick={onBack} />
      </div>

      <div className="index-intro">
        <p className="index-intro__text">
          Chaque motif couvre une octave à partir de la fondamentale. Les pastilles indiquent les
          degrés — le doigté reste le même dans les 12 tonalités. {ghostNote} Touchez une gamme
          pour l’ouvrir dans une tonalité.
        </p>
        <RootToggle rs={rs} onChange={onRs} />
      </div>

      <div className="grid grid--fill" style={gridStyle('320px', '16px')}>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="scale-card"
            onClick={() => onOpen(card.id)}
          >
            <span className="scale-card__head">
              <span className="scale-card__name">{card.name}</span>
              <span className="scale-card__count">{card.count}</span>
            </span>
            <Fretboard
              rows={card.rows}
              size="sm"
              label={fretboardLabel(card.rows, undefined, `Motif de la gamme ${card.name}`)}
            />
            <span className="scale-card__degrees">{card.degrees}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
