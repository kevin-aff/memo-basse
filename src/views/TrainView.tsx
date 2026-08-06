import { useMemo } from 'react';
import { useSequencer } from '../audio/useSequencer';
import { Fretboard, fretboardLabel } from '../components/Fretboard';
import { TabStaff } from '../components/TabStaff';
import { BackButton, Eyebrow, Field, OptionGrid, cx } from '../components/ui';
import { KEYS, MINOR_FAM, STRING_A, STRING_E } from '../music/constants';
import { buildRows } from '../music/fretboard';
import { MOTIFS, motifById } from '../music/motifs';
import { SCALES, modeScale } from '../music/scales';
import { tabSystems, trainCfg, trainSteps } from '../music/training';
import type { AppState } from '../state/appState';

export function TrainView({
  state,
  patch,
  onBack,
}: {
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  onBack: () => void;
}) {
  const cfg = useMemo(
    () =>
      trainCfg({
        tScale: state.tScale,
        tKey: state.tKey,
        tRs: state.tRs,
        tEx: state.tEx,
        tMode: state.tMode,
        tFull: state.tFull,
        tMotif: state.tMotif,
        tempo: state.tempo,
      }),
    [
      state.tScale,
      state.tKey,
      state.tRs,
      state.tEx,
      state.tMode,
      state.tFull,
      state.tMotif,
      state.tempo,
    ],
  );

  const steps = useMemo(() => trainSteps(cfg), [cfg]);
  const midis = useMemo(() => steps.map((s) => s.midi), [steps]);
  const systems = useMemo(() => tabSystems(steps), [steps]);

  const seq = useSequencer({
    midis,
    tempo: state.tempo,
    loop: state.tLoop,
    sound: state.tSound,
  });

  // Tout changement de réglage arrête la lecture en cours.
  const change = (p: Partial<AppState>): void => {
    seq.stop();
    patch(p);
  };

  const idx = steps.length ? Math.min(seq.index, steps.length - 1) : 0;
  const cur = steps[idx];

  const board = useMemo(() => {
    const M = cur.M;
    const f = cur.f;
    const r = buildRows(M.sc, {
      mode: 'note',
      pc: M.pc,
      tonic: M.tonic,
      rootFret: f,
      rs: cfg.rs,
      full: cfg.full,
      extra: cfg.extra,
    });
    const start = r.p.start;

    r.rows.forEach((row, s) =>
      row.cells.forEach((cell, ci) => {
        const on = seq.running && s === cur.str && ci + start === cur.off;
        cell.isNote = cell.isNote && !on;
        cell.isRoot = cell.isRoot && !on;
        cell.isGhost = cell.isGhost && !on;
        cell.isGhostRoot = cell.isGhostRoot && !on;
        cell.isPlay = on;
      }),
    );

    // La frette 0 n'est pas une case : c'est une colonne « sillet » détachée à gauche.
    const hasNut = f + start <= 0;
    const cut = hasNut ? 0 - f - start : -1;
    const nut = hasNut ? r.rows.map((row) => row.cells[cut]) : null;
    let frets = r.frets;
    if (hasNut) {
      r.rows.forEach((row) => {
        row.cells = row.cells.slice(cut + 1);
      });
      frets = frets.slice(cut + 1);
    }

    return {
      rows: r.rows,
      frets,
      nut,
      minWidth: 26 + (hasNut ? 46 : 0) + frets.length * 46 + 'px',
    };
  }, [cur, cfg, seq.running]);

  const chips = useMemo(
    () =>
      cfg.seq.map((m) => ({
        mode: m,
        label: modeScale(cfg.parent, cfg.parentTonic, cfg.key.pc, m).tonic,
      })),
    [cfg],
  );

  const title = cur.M.tonic + ' ' + cur.M.name.toLowerCase();
  const sub =
    (cfg.ex === 'cycle'
      ? 'Cycle des modes · ' + (cur.slot + 1) + '/' + cfg.seq.length
      : 'Un mode') +
    ' · ' +
    (cfg.full ? 'position 4 cordes' : 'une octave') +
    ' · ' +
    motifById(cfg.motif).nom.toLowerCase();
  const counter = seq.running ? idx + 1 + ' / ' + steps.length : steps.length + ' notes';
  const posLabel =
    'Fondamentale ' +
    cur.M.tonic +
    ' · corde de ' +
    (cfg.rs === STRING_A ? 'La' : 'Mi') +
    ', frette ' +
    cur.f;

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Menu" onClick={onBack} />
        <h2 className="view__title">Répétition des gammes</h2>
      </div>

      <Field label="Gamme">
        <OptionGrid label="Gamme" min="180px">
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cx('opt', s.id === cfg.parent.id && 'is-on')}
              aria-pressed={s.id === cfg.parent.id}
              onClick={() => change({ tScale: s.id, tMode: 0 })}
            >
              {s.nom}
            </button>
          ))}
        </OptionGrid>
      </Field>

      <div className="train-row">
        <div className="train-row__keys">
          <Field label="Tonalité">
            <OptionGrid label="Tonalité" min="64px">
              {KEYS.map((k) => (
                <button
                  key={k.pc}
                  type="button"
                  className={cx('opt', 'opt--key', k.pc === cfg.key.pc && 'is-on')}
                  aria-pressed={k.pc === cfg.key.pc}
                  onClick={() => change({ tKey: k.pc })}
                >
                  {MINOR_FAM[cfg.parent.id] ? k.min : k.maj}
                </button>
              ))}
            </OptionGrid>
          </Field>
        </div>
        <div className="train-row__root">
          <Field label="Fondamentale sur">
            <div className="grid grid--two" role="group" aria-label="Corde de la fondamentale">
              {[
                { rs: STRING_E, label: 'Corde de Mi' },
                { rs: STRING_A, label: 'Corde de La' },
              ].map((r) => (
                <button
                  key={r.rs}
                  type="button"
                  className={cx('opt', 'opt--root', cfg.rs === r.rs && 'is-on')}
                  aria-pressed={cfg.rs === r.rs}
                  onClick={() => change({ tRs: r.rs })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {cfg.names ? (
        <div className="field field--wide">
          <Eyebrow>Exercice</Eyebrow>

          <OptionGrid label="Type d'exercice" min="280px" gap="10px">
            <button
              type="button"
              className={cx('opt', 'opt--card', cfg.ex === 'one' && 'is-on')}
              aria-pressed={cfg.ex === 'one'}
              onClick={() => change({ tEx: 'one' })}
            >
              <span className="opt__label">Montée / descente sur un mode</span>
              <span className="opt__sub">Un seul motif, en boucle si besoin</span>
            </button>
            <button
              type="button"
              className={cx('opt', 'opt--card', cfg.ex === 'cycle' && 'is-on')}
              aria-pressed={cfg.ex === 'cycle'}
              onClick={() => change({ tEx: 'cycle' })}
            >
              <span className="opt__label">Cycle des modes</span>
              <span className="opt__sub">Mode I, II, III… puis retour en sens inverse</span>
            </button>
          </OptionGrid>

          <OptionGrid label="Étendue" min="280px" gap="10px">
            <button
              type="button"
              className={cx('opt', 'opt--card', !cfg.full && 'is-on')}
              aria-pressed={!cfg.full}
              onClick={() => change({ tFull: false })}
            >
              <span className="opt__label">Étendue : une octave</span>
              <span className="opt__sub">Le motif seul, fondamentale à fondamentale</span>
            </button>
            <button
              type="button"
              className={cx('opt', 'opt--card', cfg.full && 'is-on')}
              aria-pressed={cfg.full}
              onClick={() => change({ tFull: true })}
            >
              <span className="opt__label">Étendue : position 4 cordes</span>
              <span className="opt__sub">
                Toutes les notes de la position, de la plus grave à la plus aiguë
              </span>
            </button>
          </OptionGrid>

          <OptionGrid label="Mode" min="140px">
            {cfg.names.map((nom, i) => {
              const M = modeScale(cfg.parent, cfg.parentTonic, cfg.key.pc, i);
              const on = cfg.ex === 'one' && i === cfg.mi;
              return (
                <button
                  key={i}
                  type="button"
                  className={cx('opt', 'opt--mode', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => change({ tEx: 'one', tMode: i })}
                >
                  <span className="opt__tonic">{M.tonic}</span>
                  <span className="opt__name">{nom}</span>
                </button>
              );
            })}
          </OptionGrid>
        </div>
      ) : null}

      <Field label="Motif">
        <OptionGrid label="Motif" min="170px">
          {MOTIFS.map((mo) => (
            <button
              key={mo.id}
              type="button"
              className={cx('opt', 'opt--motif', mo.id === cfg.motif && 'is-on')}
              aria-pressed={mo.id === cfg.motif}
              onClick={() => change({ tMotif: mo.id })}
            >
              <span className="opt__label opt__label--sm">{mo.nom}</span>
              <span className="opt__sub opt__sub--mono">{mo.sub}</span>
            </button>
          ))}
        </OptionGrid>
      </Field>

      <section className="card card--pad transport-card">
        <div className="transport">
          <div className="transport__meta">
            <span className="transport__title">{title}</span>
            <span className="transport__sub">
              {sub} · {counter}
            </span>
          </div>

          <div className="transport__ctrls">
            <div className="stepper" role="group" aria-label="Tempo">
              <button
                type="button"
                className="stepper__btn"
                aria-label="Diminuer le tempo"
                onClick={() => patch({ tempo: Math.max(40, state.tempo - 5) })}
              >
                −
              </button>
              <span className="stepper__val" aria-live="polite">
                {state.tempo} BPM
              </span>
              <button
                type="button"
                className="stepper__btn"
                aria-label="Augmenter le tempo"
                onClick={() => patch({ tempo: Math.min(200, state.tempo + 5) })}
              >
                +
              </button>
            </div>

            <div className="segmented segmented--sm" role="group" aria-label="Son">
              <button
                type="button"
                className={cx('seg', 'seg--sm', state.tSound !== 'click' && 'is-on')}
                aria-pressed={state.tSound !== 'click'}
                onClick={() => patch({ tSound: 'notes' })}
              >
                Notes jouées
              </button>
              <button
                type="button"
                className={cx('seg', 'seg--sm', state.tSound === 'click' && 'is-on')}
                aria-pressed={state.tSound === 'click'}
                onClick={() => patch({ tSound: 'click' })}
              >
                Métronome
              </button>
            </div>

            <button
              type="button"
              className="btn btn--toggle"
              aria-pressed={state.tLoop}
              onClick={() => patch({ tLoop: !state.tLoop })}
            >
              {state.tLoop ? 'Boucle activée' : 'Boucle désactivée'}
            </button>

            {seq.running ? (
              <button type="button" className="btn btn--outline" onClick={seq.stop}>
                ■ Arrêter
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={seq.start}>
                ▶ Démarrer
              </button>
            )}
          </div>
        </div>

        {cfg.ex === 'cycle' ? (
          <div className="chips">
            {chips.map((c, i) => (
              <span
                key={i}
                className={cx('chip', seq.running && i === cur.slot && 'is-on')}
              >
                {c.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="pos-label">{posLabel}</div>

        <Fretboard
          rows={board.rows}
          frets={board.frets}
          nut={board.nut}
          fixed
          scroll
          minWidth={board.minWidth}
          label={fretboardLabel(board.rows, board.frets, `Diagramme — ${title}, ${posLabel}`)}
        />

        <div className="tab">
          <h3 className="eyebrow">Tablature de l'exercice · 4/4</h3>
          <TabStaff
            systems={systems}
            activeStep={seq.running ? idx : null}
            label={`Tablature : ${steps.length} notes, ${systems.length} systèmes de 4 mesures.`}
          />
        </div>
      </section>
    </div>
  );
}
