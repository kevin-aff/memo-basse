import { useRef, useState } from 'react';
import {
  BEATS_MAX,
  BEATS_MIN,
  DEFAULT_PROGRAM,
  NOTE_NAME,
  NOTE_VALUES,
  SEG_BARS_MAX,
  SUBDIVISIONS,
  TEMPO_MAX,
  TEMPO_MIN,
  TIMBRES,
  clampTempo,
  cycleAccent,
  fitAccents,
  programToBars,
  subdivPattern,
  tempoName,
} from '../rhythm/metronome';
import type { Accent, MetroPreset, MetroSettings, Segment } from '../rhythm/metronome';
import type { Metronome } from '../rhythm/useMetronome';
import type { AppState } from '../state/appState';
import { Eyebrow, Field, cx } from './ui';

const ACCENT_LABEL = ['muet', 'faible', 'normal', 'fort'];

/** Au-delà, on considère que la série de frappes est finie et qu'une autre commence. */
const TAP_TIMEOUT_MS = 2000;
/** Nombre de frappes retenues : assez pour lisser, assez peu pour suivre un changement. */
const TAP_KEEP = 5;

interface Props {
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  metro: Metronome;
}

/** Réglage entier avec deux boutons, sur le modèle du sélecteur de tempo. */
function Step({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-step">
      <span className="mt-step__lab">{label}</span>
      <div className="stepper" role="group" aria-label={label}>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Diminuer : ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <span className="stepper__val">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Augmenter : ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Motif d'un temps dessiné en pastilles : pleine si le clic sonne, creuse s'il se tait. */
export function Pattern({ subdiv, live = -1 }: { subdiv: number; live?: number }) {
  return (
    <span className="mt-pat" aria-hidden="true">
      {subdivPattern(subdiv).map((a, i) => (
        <span
          key={i}
          className={cx('mt-pip', a === 0 && 'mt-pip--off', i === 0 && 'mt-pip--head', live === i && 'is-on')}
        />
      ))}
    </span>
  );
}

export function MetronomeCard({ state, patch, metro }: Props) {
  const taps = useRef<number[]>([]);

  const setTempo = (bpm: number): void => patch({ rTempo: clampTempo(bpm) });

  /**
   * Le tempo se lit sur l'étendue complète de la série — première à dernière frappe —
   * et non sur la moyenne des intervalles : une frappe hésitante pèse alors beaucoup
   * moins qu'en comparant les intervalles deux à deux.
   */
  const tap = (): void => {
    const now = performance.now();
    const t = taps.current;
    if (t.length && now - t[t.length - 1] > TAP_TIMEOUT_MS) t.length = 0;
    t.push(now);
    if (t.length > TAP_KEEP) t.shift();
    if (t.length >= 2) {
      const span = t[t.length - 1] - t[0];
      if (span > 0) setTempo((60000 * (t.length - 1)) / span);
    }
  };

  const setBeats = (n: number): void =>
    patch({ rBeats: n, rAccents: fitAccents(state.rAccents, n) });

  return (
    <section className="card card--pad">
      <div className="repertoire__head">
        <Eyebrow>Métronome</Eyebrow>
        <span className="mt-mouvement">{tempoName(metro.running ? metro.bpm : state.rTempo)}</span>
      </div>

      <div className="mt-head">
        <div className="mt-bpm">
          <input
            className="mt-bpm__in"
            type="number"
            inputMode="numeric"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            aria-label="Tempo en battements par minute"
            value={metro.running && state.rRamp.on ? metro.bpm : state.rTempo}
            disabled={metro.running && state.rRamp.on}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
          <span className="mt-bpm__unit">BPM</span>
        </div>

        <div className="mt-transport">
          <button
            type="button"
            className={cx('btn', metro.running ? 'btn--outline' : 'btn--primary')}
            onClick={metro.toggle}
          >
            {metro.running ? '■ Arrêter' : '▶ Démarrer'}
          </button>
          <button type="button" className="btn btn--toggle" onClick={tap}>
            TAP
          </button>
        </div>
      </div>

      <div className="mt-slide">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Tempo moins 5"
          onClick={() => setTempo(state.rTempo - 5)}
        >
          −5
        </button>
        <input
          type="range"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          value={state.rTempo}
          aria-label="Tempo"
          onChange={(e) => setTempo(Number(e.target.value))}
        />
        <button
          type="button"
          className="stepper__btn"
          aria-label="Tempo plus 5"
          onClick={() => setTempo(state.rTempo + 5)}
        >
          +5
        </button>
      </div>

      <Field label="Temps de la mesure">
        <div className={cx('mt-beats', metro.muet && 'is-muet')} role="group" aria-label="Accents">
          {state.rAccents.map((a, i) => (
            <button
              key={i}
              type="button"
              className={cx('mt-beat', `mt-beat--${a}`, metro.beat === i && 'is-on')}
              aria-label={`Temps ${i + 1} : ${ACCENT_LABEL[a]}`}
              onClick={() =>
                patch({
                  rAccents: state.rAccents.map((x, j) => (j === i ? cycleAccent(x) : x)) as Accent[],
                })
              }
            >
              <span className="mt-beat__n">{i + 1}</span>
            </button>
          ))}
        </div>
        <p className="rk-note">
          Un clic sur un temps monte son niveau d'un cran — faible, normal, fort — puis le coupe.
          Couper les temps 1 et 3 d'un 4/4, c'est se retrouver seul à tenir le premier temps :
          l'exercice le plus court pour savoir où l'on en est.
          {metro.muet ? ' Clic coupé : tenez le tempo.' : ''}
        </p>
      </Field>

      <div className="mt-grid">
        <Field label="Métrique">
          <div className="mt-meter">
            <span className="mt-sig">
              {state.rBeats}/{state.rNote}
            </span>
            <Step
              label="Temps"
              value={state.rBeats}
              min={BEATS_MIN}
              max={BEATS_MAX}
              onChange={setBeats}
            />
            <div className="mt-note">
              <span className="mt-step__lab">Unité</span>
              <div className="mt-note__opts" role="group" aria-label="Unité de temps">
                {NOTE_VALUES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={cx('chip', state.rNote === n && 'is-on')}
                    aria-pressed={state.rNote === n}
                    aria-label={NOTE_NAME[n]}
                    onClick={() => patch({ rNote: n })}
                  >
                    /{n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="rk-note">Le tempo compte {NOTE_NAME[state.rNote]}.</p>
        </Field>

        <Field label="Son">
          <div className="mt-note__opts" role="group" aria-label="Timbre du clic">
            {TIMBRES.map((t, i) => (
              <button
                key={t}
                type="button"
                className={cx('chip', state.rTimbre === i && 'is-on')}
                aria-pressed={state.rTimbre === i}
                onClick={() => patch({ rTimbre: i })}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="rk-calib__row">
            <label htmlFor="mt-vol">Volume</label>
            <input
              id="mt-vol"
              type="range"
              min={0}
              max={100}
              step={1}
              value={state.rVolume}
              onChange={(e) => patch({ rVolume: Number(e.target.value) })}
            />
            <span className="rk-calib__val">{state.rVolume} %</span>
          </div>
        </Field>
      </div>

      <Field label="Subdivision">
        <div className="grid grid--sub" role="group" aria-label="Subdivision">
          {SUBDIVISIONS.map((s, i) => {
            // Enchaînement en service : c'est lui qui décide, mesure après mesure.
            const joue = metro.running && metro.subdiv === i;
            const choisi = state.rProg.on ? joue : state.rSubdiv === i;
            return (
              <button
                key={s.id}
                type="button"
                className={cx('opt', 'opt--card', choisi && 'is-on', state.rProg.on && 'is-auto')}
                aria-pressed={choisi}
                aria-label={`${s.nom} — ${s.sous}`}
                onClick={() => patch({ rSubdiv: i })}
              >
                <Pattern subdiv={i} live={joue ? metro.sub : -1} />
                <span className="opt__label">{s.nom}</span>
                <span className="opt__sub">{s.sous}</span>
              </button>
            );
          })}
        </div>
        {state.rProg.on ? (
          <p className="rk-note">
            L'enchaînement pilote la subdivision mesure par mesure : ce choix ne sert que
            lorsqu'il est arrêté.
          </p>
        ) : null}
      </Field>
    </section>
  );
}

export function ProgramCard({ state, patch, metro }: Props) {
  const prog = state.rProg;
  const bars = programToBars(prog);
  const total = bars.length;
  /** mesure en cours dans le passage : la boucle ramène au début */
  const ici = metro.running && prog.on && total ? metro.bar % total : -1;

  const setSegs = (segs: Segment[]): void =>
    patch({ rProg: { ...prog, segs: segs.length ? segs : DEFAULT_PROGRAM.segs } });

  return (
    <section className="card card--pad">
      <div className="repertoire__head">
        <Eyebrow>Enchaînement</Eyebrow>
        <span className="rk-progress">
          {total} mesure{total > 1 ? 's' : ''}
          {prog.loop ? ' · en boucle' : ''}
          {ici >= 0 ? ` · mesure ${ici + 1}` : ''}
        </span>
      </div>

      <div className="mt-mode">
        <button
          type="button"
          className={cx('btn', 'btn--toggle', 'btn--sm', prog.on && 'is-on')}
          aria-pressed={prog.on}
          onClick={() => patch({ rProg: { ...prog, on: !prog.on } })}
        >
          Suivre l'enchaînement
        </button>
        <button
          type="button"
          className={cx('btn', 'btn--toggle', 'btn--sm', prog.loop && 'is-on')}
          aria-pressed={prog.loop}
          onClick={() => patch({ rProg: { ...prog, loop: !prog.loop } })}
        >
          Boucler
        </button>
      </div>

      <p className="rk-note">
        Une suite de tranches : tant de mesures dans telle subdivision. Le métronome la suit
        mesure après mesure — la montée en tempo et le temps intérieur continuent de
        s'appliquer par-dessus. Le même enchaînement sert de partition à l'exercice mesuré,
        pour un passage.
      </p>

      <ul className="mt-segs">
        {prog.segs.map((s, i) => (
          <li key={i} className="mt-seg">
            <Pattern subdiv={s.subdiv} />
            <Step
              label="Mesures"
              value={s.bars}
              min={1}
              max={SEG_BARS_MAX}
              onChange={(v) =>
                setSegs(prog.segs.map((x, j) => (j === i ? { ...x, bars: v } : x)))
              }
            />
            <div className="mt-seg__val">
              <span className="mt-step__lab">Valeur</span>
              <select
                className="rk-select"
                value={s.subdiv}
                aria-label={`Subdivision de la tranche ${i + 1}`}
                onChange={(e) =>
                  setSegs(
                    prog.segs.map((x, j) =>
                      j === i ? { ...x, subdiv: Number(e.target.value) } : x,
                    ),
                  )
                }
              >
                {SUBDIVISIONS.map((sd, k) => (
                  <option key={sd.id} value={k}>
                    {sd.nom}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="mt-preset__del"
              aria-label={`Supprimer la tranche ${i + 1}`}
              disabled={prog.segs.length < 2}
              onClick={() => setSegs(prog.segs.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="rk-input">
        <button
          type="button"
          className="btn btn--toggle btn--sm"
          onClick={() =>
            setSegs([...prog.segs, { bars: 1, subdiv: prog.segs[prog.segs.length - 1]?.subdiv ?? 0 }])
          }
        >
          + Ajouter une tranche
        </button>
      </div>

      <div className="mt-plan" aria-hidden="true">
        {bars.map((sd, i) => (
          <span key={i} className={cx('mt-plan__bar', i === ici && 'is-on')}>
            <Pattern subdiv={sd} />
            <span className="mt-plan__n">{i + 1}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export function TrainingCard({ state, patch, metro }: Props) {
  const ramp = state.rRamp;
  const gap = state.rGap;

  return (
    <section className="card card--pad">
      <Eyebrow>Travail du tempo</Eyebrow>

      <div className="mt-mode">
        <button
          type="button"
          className={cx('btn', 'btn--toggle', 'btn--sm', ramp.on && 'is-on')}
          aria-pressed={ramp.on}
          onClick={() => patch({ rRamp: { ...ramp, on: !ramp.on } })}
        >
          Montée en tempo
        </button>
        {ramp.on && metro.running ? (
          <span className="rk-progress">
            {metro.bpm} BPM · mesure {metro.bar + 1}
            {metro.bpm === ramp.to ? ' · palier final atteint' : ''}
          </span>
        ) : null}
      </div>

      {ramp.on ? (
        <>
          <div className="mt-row">
            <Step
              label="Départ"
              value={ramp.from}
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              step={5}
              onChange={(v) => patch({ rRamp: { ...ramp, from: v } })}
            />
            <Step
              label="Arrivée"
              value={ramp.to}
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              step={5}
              onChange={(v) => patch({ rRamp: { ...ramp, to: v } })}
            />
            <Step
              label="Palier"
              value={ramp.step}
              min={1}
              max={30}
              suffix=" BPM"
              onChange={(v) => patch({ rRamp: { ...ramp, step: v } })}
            />
            <Step
              label="Toutes les"
              value={ramp.bars}
              min={1}
              max={32}
              suffix=" mes."
              onChange={(v) => patch({ rRamp: { ...ramp, bars: v } })}
            />
          </div>
          <p className="rk-note">
            Le clic part à {ramp.from} BPM et {ramp.to >= ramp.from ? 'gagne' : 'perd'}{' '}
            {ramp.step} BPM toutes les {ramp.bars} mesure{ramp.bars > 1 ? 's' : ''}, jusqu'à{' '}
            {ramp.to} — soit environ{' '}
            {Math.max(
              1,
              Math.ceil(Math.abs(ramp.to - ramp.from) / Math.max(1, ramp.step)) * ramp.bars,
            )}{' '}
            mesures. Le réglage de tempo est neutralisé pendant la montée.
          </p>
        </>
      ) : null}

      <div className="mt-mode">
        <button
          type="button"
          className={cx('btn', 'btn--toggle', 'btn--sm', gap.on && 'is-on')}
          aria-pressed={gap.on}
          onClick={() => patch({ rGap: { ...gap, on: !gap.on } })}
        >
          Temps intérieur
        </button>
        {gap.on && metro.running ? (
          <span className="rk-progress">{metro.muet ? 'clic coupé' : 'clic présent'}</span>
        ) : null}
      </div>

      {gap.on ? (
        <>
          <div className="mt-row">
            <Step
              label="Avec clic"
              value={gap.bars}
              min={1}
              max={16}
              suffix=" mes."
              onChange={(v) => patch({ rGap: { ...gap, bars: v } })}
            />
            <Step
              label="Sans clic"
              value={gap.silent}
              min={0}
              max={16}
              suffix=" mes."
              onChange={(v) => patch({ rGap: { ...gap, silent: v } })}
            />
            <button
              type="button"
              className={cx('btn', 'btn--toggle', 'btn--sm', gap.random && 'is-on')}
              aria-pressed={gap.random}
              onClick={() => patch({ rGap: { ...gap, random: !gap.random } })}
            >
              Au hasard
            </button>
          </div>
          <p className="rk-note">
            {gap.random
              ? 'Une mesure sur deux en moyenne, tirée au sort : impossible de compter les mesures à la place du tempo.'
              : `${gap.bars} mesure${gap.bars > 1 ? 's' : ''} avec clic, puis ${gap.silent} sans. `}
            La dérive ne s'entend qu'au retour du clic — c'est tout l'intérêt.
          </p>
        </>
      ) : null}
    </section>
  );
}

export function PresetsCard({ state, patch }: Omit<Props, 'metro'>) {
  const [name, setName] = useState('');

  const current = (): MetroSettings => ({
    bpm: state.rTempo,
    beats: state.rBeats,
    note: state.rNote,
    subdiv: state.rSubdiv,
    accents: state.rAccents,
    volume: state.rVolume,
    timbre: state.rTimbre,
    ramp: state.rRamp,
    gap: state.rGap,
    prog: state.rProg,
  });

  const save = (): void => {
    const n = name.trim();
    if (!n) return;
    const p: MetroPreset = { name: n, fav: false, s: current() };
    // Un nom déjà pris écrase : c'est ce qu'on attend en réenregistrant un réglage.
    const rest = state.rPresets.filter((x) => x.name !== n);
    patch({ rPresets: [...rest, p] });
    setName('');
  };

  const apply = (p: MetroPreset): void =>
    patch({
      rTempo: p.s.bpm,
      rBeats: p.s.beats,
      rNote: p.s.note,
      rSubdiv: p.s.subdiv,
      rAccents: fitAccents(p.s.accents, p.s.beats),
      rVolume: p.s.volume,
      rTimbre: p.s.timbre,
      rRamp: p.s.ramp,
      rGap: p.s.gap,
      rProg: p.s.prog ?? DEFAULT_PROGRAM,
    });

  const sorted = [...state.rPresets].sort(
    (a, b) => Number(b.fav) - Number(a.fav) || a.name.localeCompare(b.name, 'fr'),
  );

  return (
    <section className="card card--pad">
      <Eyebrow>Mémoires</Eyebrow>
      <p className="rk-note">
        Tout le réglage courant — tempo, métrique, accents, subdivision, travail du tempo — sous
        un nom. Conservé dans le navigateur.
      </p>

      <div className="rk-input">
        <input
          className="rk-select"
          type="text"
          value={name}
          placeholder="Nom du réglage"
          aria-label="Nom du réglage"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!name.trim()}
          onClick={save}
        >
          Enregistrer
        </button>
      </div>

      {sorted.length ? (
        <ul className="mt-presets">
          {sorted.map((p) => (
            <li key={p.name} className="mt-preset">
              <button
                type="button"
                className={cx('mt-preset__fav', p.fav && 'is-on')}
                aria-label={p.fav ? `Retirer ${p.name} des favoris` : `Mettre ${p.name} en favori`}
                aria-pressed={p.fav}
                onClick={() =>
                  patch({
                    rPresets: state.rPresets.map((x) =>
                      x.name === p.name ? { ...x, fav: !x.fav } : x,
                    ),
                  })
                }
              >
                {p.fav ? '★' : '☆'}
              </button>
              <button type="button" className="mt-preset__go" onClick={() => apply(p)}>
                <span className="mt-preset__name">{p.name}</span>
                <span className="mt-preset__sub">
                  {p.s.bpm} BPM · {p.s.beats}/{p.s.note} ·{' '}
                  {p.s.prog?.on
                    ? `enchaînement de ${programToBars(p.s.prog).length} mesures`
                    : (SUBDIVISIONS[p.s.subdiv]?.nom ?? '—')}
                  {p.s.ramp.on ? ' · montée' : ''}
                  {p.s.gap.on ? ' · temps intérieur' : ''}
                </span>
              </button>
              <button
                type="button"
                className="mt-preset__del"
                aria-label={`Supprimer ${p.name}`}
                onClick={() => patch({ rPresets: state.rPresets.filter((x) => x.name !== p.name) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rk-note">Aucun réglage enregistré.</p>
      )}
    </section>
  );
}
