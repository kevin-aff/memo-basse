import { useMemo } from 'react';
import { playSequence } from '../audio/engine';
import { Fretboard, fretboardLabel } from '../components/Fretboard';
import { Neck } from '../components/Neck';
import { RootToggle } from '../components/RootToggle';
import { BackButton, Field, OptionGrid, PanelCard, cx, gridStyle } from '../components/ui';
import { DEGREE_NUM } from '../config';
import { buildScaleView } from '../music/scaleView';
import type { LabelMode, ScaleId } from '../music/types';

export interface ScaleViewProps {
  scaleId: ScaleId;
  keyPc: number;
  mode: number;
  rs: number;
  labels: LabelMode;
  onKey: (pc: number) => void;
  onMode: (i: number) => void;
  onRs: (rs: number) => void;
  onLabels: (l: LabelMode) => void;
  onBack: () => void;
}

export function ScaleView(props: ScaleViewProps) {
  const { scaleId, keyPc, mode, rs, labels } = props;
  const v = useMemo(
    () => buildScaleView({ scaleId, keyPc, mode, rs, labels, num: DEGREE_NUM }),
    [scaleId, keyPc, mode, rs, labels],
  );

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Toutes les gammes" onClick={props.onBack} />
        <h2 className="view__title">{v.title}</h2>
        <span className="view__meta">{v.parentLabel}</span>
      </div>

      <Field label="Tonalité">
        <OptionGrid label="Tonalité" min="72px">
          {v.keys.map((k) => (
            <button
              key={k.pc}
              type="button"
              className={cx('opt', 'opt--key', 'opt--key-lg', k.pc === keyPc && 'is-on')}
              aria-pressed={k.pc === keyPc}
              onClick={() => props.onKey(k.pc)}
            >
              {k.name}
            </button>
          ))}
        </OptionGrid>
      </Field>

      {v.ctx.hasModes ? (
        <Field label="Mode">
          <OptionGrid label="Mode" min="150px">
            {v.modes.map((m) => (
              <button
                key={m.index}
                type="button"
                className={cx('opt', 'opt--mode', 'opt--mode-lg', m.index === v.ctx.mi && 'is-on')}
                aria-pressed={m.index === v.ctx.mi}
                onClick={() => props.onMode(m.index)}
              >
                <span className="opt__tonic">{m.tonic}</span>
                <span className="opt__name">{m.name}</span>
              </button>
            ))}
          </OptionGrid>
        </Field>
      ) : null}

      <section className="card card--pad">
        <div className="scale-toolbar">
          <div className="scale-toolbar__left">
            <div className="pos-label">{v.positionLabel}</div>
            <RootToggle rs={rs} onChange={props.onRs} small />
          </div>
          <div className="scale-toolbar__right">
            <button
              type="button"
              className="btn btn--toggle btn--sm"
              onClick={() => props.onLabels(labels === 'note' ? 'deg' : 'note')}
            >
              {v.labelBtn}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => playSequence(v.playMidis)}
            >
              ▶ Écouter la gamme
            </button>
          </div>
        </div>

        <Fretboard
          rows={v.rows}
          frets={v.frets}
          label={fretboardLabel(v.rows, v.frets, `Diagramme — ${v.title}, ${v.positionLabel}`)}
        />
      </section>

      <section className="card card--neck">
        <div className="neck-head">
          <h3 className="eyebrow">Manche complet · sillet à frette 19</h3>
          <p className="neck-head__hint">{v.neckHint}</p>
        </div>
        <Neck rows={v.neckRows} frets={v.neckFrets} />
      </section>

      <div className="grid" style={gridStyle('260px', '14px')}>
        {v.panels.map((p) => (
          <PanelCard key={p.title} panel={p} />
        ))}
      </div>
    </div>
  );
}
