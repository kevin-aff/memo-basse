import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeInputError, listInputs, requestPermission, startInput } from '../audio/input';
import type { InputDevice, InputError, InputSession } from '../audio/input';
import { MetronomeCard, Pattern, PresetsCard, ProgramCard, TrainingCard } from '../components/Metronome';
import { BackButton, Eyebrow, Field, cx } from '../components/ui';
import { CORRECT_MS, EXERCISE, JUSTE_MS, barName, totalBeats } from '../rhythm/exercise';
import type { Bar } from '../rhythm/exercise';
import { programToBars } from '../rhythm/metronome';
import type { MetroSettings } from '../rhythm/metronome';
import type { NoteResult, Verdict } from '../rhythm/exercise';
import { CALIB_BARS, CALIB_TEMPO, MIN_NOTES, useCalibration } from '../rhythm/useCalibration';
import { useMetronome } from '../rhythm/useMetronome';
import { useRhythmSession } from '../rhythm/useRhythmSession';
import type { AppState } from '../state/appState';

/** Chaque cause appelle un geste précis : le message le dit plutôt que de rester vague. */
const ERROR_HELP: Record<InputError, string> = {
  refuse:
    "Le navigateur bloque le micro pour ce site. Cliquez sur l'icône à gauche de l'adresse (cadenas ou curseurs), mettez « Microphone » sur « Autoriser », puis rechargez la page.",
  introuvable:
    "Aucune entrée audio disponible. Vérifiez que la Scarlett est bien branchée et reconnue par Windows.",
  occupee:
    "L'interface est déjà utilisée en exclusif par un autre logiciel — Ableton Live, OBS, Zoom… Fermez-le puis réessayez.",
  nonSecurise:
    "L'accès au micro exige une page sécurisée : ouvrez l'application en https, ou en local sur localhost.",
  inconnu: "Impossible d'ouvrir l'entrée audio.",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  juste: 'juste',
  correct: 'correct',
  imprecis: 'imprécis',
  manque: 'manquée',
};

/** Position d'une note dans la barre de résultats, en pourcentage de l'écart max affiché. */
const DEV_SCALE = 80; // ms de part et d'autre du centre

function NoteMarks({ results, bar, name }: { results: NoteResult[]; bar: number; name: string }) {
  const rows = results.filter((r) => r.note.bar === bar);
  return (
    <div className="rk-bar">
      <div className="rk-bar__head">
        <span className="rk-bar__name">
          Mesure {bar + 1} · {name}
        </span>
        <span className="rk-bar__count">{rows.length} notes</span>
      </div>
      <div className="rk-bar__marks">
        {rows.map((r, i) => (
          <span
            key={i}
            className={cx('rk-mark', `rk-mark--${r.verdict}`)}
            title={
              r.devMs === null
                ? 'Non détectée'
                : `${r.devMs > 0 ? '+' : ''}${r.devMs.toFixed(0)} ms — ${VERDICT_LABEL[r.verdict]}`
            }
            style={
              r.devMs === null
                ? undefined
                : {
                    // Décalage horizontal proportionnel à l'écart : en avance à gauche.
                    transform: `translateX(${Math.max(-1, Math.min(1, r.devMs / DEV_SCALE)) * 40}%)`,
                  }
            }
          />
        ))}
      </div>
    </div>
  );
}

export function RhythmView({
  state,
  patch,
  onBack,
}: {
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  onBack: () => void;
}) {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [level, setLevel] = useState(0);
  const [input, setInput] = useState<InputSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<InputSession | null>(null);
  // Compteur de contrôle : permet de régler le gain et de vérifier la détection
  // avant de lancer l'exercice, plutôt que de découvrir un problème à l'arrivée.
  const [hits, setHits] = useState(0);
  const [lastLevel, setLastLevel] = useState(0);
  const [peak, setPeak] = useState(0);

  // L'exercice mesuré joue l'enchaînement composé quand il est en service — un passage,
  // même en boucle : on ne peut noter que ce qui a une fin.
  const bars: Bar[] = useMemo(
    () =>
      state.rProg.on
        ? programToBars(state.rProg).map((subdiv) => ({ subdiv }))
        : EXERCISE,
    [state.rProg],
  );

  const session = useRhythmSession({
    tempo: state.rTempo,
    offBeat: state.rOffBeat,
    latencyMs: state.rLatencyMs,
    bars,
    beatsPerBar: state.rBeats,
  });
  const pushOnset = session.pushOnset;

  const metroSettings: MetroSettings = useMemo(
    () => ({
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
    }),
    [
      state.rTempo,
      state.rBeats,
      state.rNote,
      state.rSubdiv,
      state.rAccents,
      state.rVolume,
      state.rTimbre,
      state.rRamp,
      state.rGap,
      state.rProg,
    ],
  );
  const metro = useMetronome(metroSettings);
  const calib = useCalibration();
  const calibPush = calib.pushOnset;

  const closeInput = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setInput(null);
    setLevel(0);
    setPeak(0);
  }, []);

  useEffect(() => closeInput, [closeInput]);

  const openInput = useCallback(
    async (deviceId: string) => {
      setBusy(true);
      setError(null);
      try {
        const refus = await requestPermission();
        if (refus) {
          setError(ERROR_HELP[refus]);
          return;
        }
        setDevices(await listInputs());
        sessionRef.current?.stop();
        setHits(0);
        setPeak(0);
        const s = await startInput({
          deviceId: deviceId || undefined,
          onOnset: (e) => {
            pushOnset(e.time);
            calibPush(e.time);
            setHits((h) => h + 1);
            setLastLevel(e.level);
          },
          onLevel: (l) => {
            setLevel(l);
            setPeak((p) => Math.max(p, l));
          },
        });
        sessionRef.current = s;
        setInput(s);
      } catch (e) {
        setError(ERROR_HELP[describeInputError(e)]);
      } finally {
        setBusy(false);
      }
    },
    [pushOnset, calibPush],
  );

  const score = session.score;
  const pos = session.position;
  const currentBar = pos < 0 ? -1 : Math.floor(pos / Math.max(1, state.rBeats));
  const countIn = pos < 0 ? Math.ceil(-pos) : 0;

  return (
    <div className="view">
      <div className="view__bar">
        <BackButton label="← Menu" onClick={onBack} />
        <h2 className="view__title">Précision rythmique</h2>
      </div>

      <MetronomeCard state={state} patch={patch} metro={metro} />
      <ProgramCard state={state} patch={patch} metro={metro} />
      <TrainingCard state={state} patch={patch} metro={metro} />
      <PresetsCard state={state} patch={patch} />

      <section className="card card--pad">
        <Eyebrow>Entrée audio</Eyebrow>
        <p className="rk-note">
          Ce qui suit mesure le placement de vos notes et demande la basse branchée — le
          métronome ci-dessus, lui, se passe d'instrument. Choisissez l'entrée de la Scarlett. Le
          signal est analysé dans la page : rien n'est enregistré ni envoyé.
        </p>

        <div className="rk-input">
          <select
            className="rk-select"
            value={state.rDevice}
            aria-label="Entrée audio"
            onChange={(e) => {
              patch({ rDevice: e.target.value });
              if (input) void openInput(e.target.value);
            }}
          >
            <option value="">Entrée par défaut</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>

          {input ? (
            <button type="button" className="btn btn--toggle btn--sm" onClick={closeInput}>
              Couper l'entrée
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => void openInput(state.rDevice)}
            >
              {busy ? 'Ouverture…' : "Activer l'entrée"}
            </button>
          )}
        </div>

        {input ? (
          <div className="rk-meter" role="img" aria-label={`Niveau d'entrée ${Math.round(level * 100)} %`}>
            <span
              className="rk-meter__fill"
              style={{ width: Math.min(100, Math.round(level * 320)) + '%' }}
            />
          </div>
        ) : null}

        {input ? (
          <>
            <p className="rk-note rk-note--ok">
              {input.label} · {Math.round(input.sampleRate / 100) / 10} kHz.
            </p>
            <div className="rk-check">
              <div className="rk-stat">
                <span className="rk-stat__val">{hits}</span>
                <span className="rk-stat__lab">attaques détectées</span>
              </div>
              <div className="rk-stat">
                <span className="rk-stat__val">{peak.toFixed(3)}</span>
                <span className="rk-stat__lab">
                  niveau crête {peak > 0.9 ? '· sature' : peak < 0.02 ? '· trop faible' : '· correct'}
                </span>
              </div>
              <div className="rk-stat">
                <span className="rk-stat__val">{lastLevel.toFixed(3)}</span>
                <span className="rk-stat__lab">dernière attaque</span>
              </div>
              <button
                type="button"
                className="btn btn--toggle btn--sm"
                onClick={() => {
                  setHits(0);
                  setPeak(0);
                }}
              >
                Remettre à zéro
              </button>
            </div>
            <p className="rk-note">
              Avant de lancer l'exercice : jouez une dizaine de notes détachées. Le compteur doit
              avancer d'exactement une unité par note. S'il n'avance pas, montez le gain de la
              Scarlett ; s'il avance de deux, baissez-le.
            </p>
          </>
        ) : null}
        {error ? <p className="rk-note rk-note--err">{error}</p> : null}
      </section>

      {input ? (
        <section className="card card--pad">
          <div className="repertoire__head">
            <Eyebrow>Latence d'entrée</Eyebrow>
            <span className="rk-latency">{state.rLatencyMs} ms</span>
          </div>
          <p className="rk-note">
            Le navigateur n'indique pas le temps que met le son à revenir de la Scarlett. Sans
            cette constante, tous les écarts mesurés sont décalés de la même quantité. L'étalonnage
            la mesure : {CALIB_BARS} mesures de noires à {CALIB_TEMPO} BPM, une note sur chaque
            clic. Jouez régulièrement, sans chercher à corriger.
          </p>

          <div className="rk-input">
            {calib.running ? (
              <>
                <button type="button" className="btn btn--outline btn--sm" onClick={calib.stop}>
                  ■ Terminer maintenant
                </button>
                <span className="rk-progress">
                  {calib.captured} note{calib.captured > 1 ? 's' : ''} captée
                  {calib.captured > 1 ? 's' : ''} sur {calib.total}
                </span>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={session.running}
                onClick={() => {
                  metro.stop();
                  calib.start();
                }}
              >
                ▶ Étalonner la latence
              </button>
            )}
          </div>

          {!calib.running && calib.result ? (
            <div className="rk-check">
              <div className="rk-stat">
                <span className="rk-stat__val">
                  {calib.result.medianMs > 0 ? '+' : ''}
                  {calib.result.medianMs.toFixed(0)} ms
                </span>
                <span className="rk-stat__lab">latence mesurée</span>
              </div>
              <div className="rk-stat">
                <span className="rk-stat__val">± {calib.result.spreadMs.toFixed(0)} ms</span>
                <span className="rk-stat__lab">
                  dispersion {calib.result.spreadMs > 25 ? '· jeu irrégulier' : '· fiable'}
                </span>
              </div>
              <div className="rk-stat">
                <span className="rk-stat__val">
                  {calib.result.count} / {calib.total}
                </span>
                <span className="rk-stat__lab">clics avec une note</span>
              </div>
              <div className="rk-stat">
                <span className="rk-stat__val">{calib.result.doubles}</span>
                <span className="rk-stat__lab">déclenchements doubles</span>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  patch({ rLatencyMs: Math.round(calib.result?.medianMs ?? 0) });
                  calib.reset();
                }}
              >
                Appliquer
              </button>
            </div>
          ) : null}

          {!calib.running && calib.result ? (
            <p className="rk-note">
              Le navigateur déclare {input.baseLatencyMs.toFixed(0)} ms de latence interne et{' '}
              {input.outputLatencyMs.toFixed(0)} ms en sortie. Une latence mesurée très supérieure
              à cet ordre de grandeur ne vient pas de la chaîne audio mais du jeu : on jouerait
              alors systématiquement après le clic. L'étalonnage ne sait pas distinguer les deux —
              il retranche ce qu'il mesure.
              {calib.result.doubles > calib.result.count / 10
                ? ' Attention : la détection se déclenche deux fois sur plusieurs notes. Baissez le gain de la Scarlett.'
                : ''}
            </p>
          ) : null}

          {!calib.running && !calib.result && calib.captured > 0 ? (
            <p className="rk-note rk-note--err">
              Moins de {MIN_NOTES} notes exploitables : la médiane ne serait pas fiable. Vérifiez le
              gain et recommencez.
            </p>
          ) : null}

          <div className="rk-calib__row">
            <label htmlFor="lat">Réglage manuel</label>
            <input
              id="lat"
              type="range"
              min={-50}
              max={200}
              step={1}
              value={state.rLatencyMs}
              onChange={(e) => patch({ rLatencyMs: Number(e.target.value) })}
            />
            <span className="rk-calib__val">{state.rLatencyMs} ms</span>
          </div>
        </section>
      ) : null}

      <div className="train-row">
        <div className="train-row__keys">
          <Field label="Placement">
            <div className="grid grid--two" role="group" aria-label="Placement des notes">
              <button
                type="button"
                className={cx('opt', 'opt--card', !state.rOffBeat && 'is-on')}
                aria-pressed={!state.rOffBeat}
                onClick={() => patch({ rOffBeat: false })}
              >
                <span className="opt__label">Sur le temps</span>
                <span className="opt__sub">Les notes tombent avec le métronome</span>
              </button>
              <button
                type="button"
                className={cx('opt', 'opt--card', state.rOffBeat && 'is-on')}
                aria-pressed={state.rOffBeat}
                onClick={() => patch({ rOffBeat: true })}
              >
                <span className="opt__label">À contretemps</span>
                <span className="opt__sub">
                  Décalées d'une demi-valeur : les noires sur les « et »
                </span>
              </button>
            </div>
          </Field>
        </div>
      </div>

      <section className="card card--pad">
        <div className="transport">
          <div className="transport__meta">
            <span className="transport__title">
              {session.running
                ? countIn > 0
                  ? `Décompte… ${countIn}`
                  : `Mesure ${currentBar + 1} / ${bars.length} · ${barName(bars[Math.min(currentBar, bars.length - 1)])}`
                : state.rProg.on
                  ? "L'enchaînement composé, un passage"
                  : 'Noires · croches · doubles · croches · noires'}
            </span>
            <span className="transport__sub">
              {state.rTempo} BPM · {state.rBeats}/{state.rNote} · {bars.length} mesures ·{' '}
              {totalBeats(bars, state.rBeats)} temps · {session.grid.length} notes ·{' '}
              {state.rOffBeat ? 'à contretemps' : 'sur le temps'}
            </span>
          </div>
          <div className="transport__ctrls">
            {session.running ? (
              <button type="button" className="btn btn--outline" onClick={session.stop}>
                ■ Arrêter
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!input}
                onClick={() => {
                  // L'exercice a son propre décompte et ses propres clics :
                  // laisser tourner le métronome libre les ferait doubler.
                  metro.stop();
                  session.start();
                }}
              >
                ▶ Démarrer
              </button>
            )}
          </div>
        </div>

        {!input ? (
          <p className="rk-note">Activez l'entrée audio pour lancer l'exercice.</p>
        ) : null}

        <div className="rk-timeline" aria-hidden="true">
          {bars.map((b, i) => (
            <div
              key={i}
              className={cx('rk-slot', session.running && i === currentBar && 'is-on')}
            >
              <Pattern subdiv={b.subdiv} />
              <span className="rk-slot__name">{barName(b)}</span>
            </div>
          ))}
        </div>
      </section>

      {score ? (
        <section className="card card--pad">
          <div className="repertoire__head">
            <Eyebrow>Résultat</Eyebrow>
            <button type="button" className="btn btn--toggle btn--sm" onClick={session.clear}>
              Effacer
            </button>
          </div>

          <div className="rk-stats">
            <div className="rk-stat">
              <span className="rk-stat__val">{score.meanAbsMs.toFixed(0)} ms</span>
              <span className="rk-stat__lab">écart moyen</span>
            </div>
            <div className="rk-stat">
              <span className="rk-stat__val">
                {score.medianSignedMs > 0 ? '+' : ''}
                {score.medianSignedMs.toFixed(0)} ms
              </span>
              <span className="rk-stat__lab">
                {score.medianSignedMs > 8
                  ? 'tendance à traîner'
                  : score.medianSignedMs < -8
                    ? 'tendance à précipiter'
                    : 'bien centré'}
              </span>
            </div>
            <div className="rk-stat">
              <span className="rk-stat__val">
                {score.juste} / {score.results.length}
              </span>
              <span className="rk-stat__lab">à moins de {JUSTE_MS} ms</span>
            </div>
            <div className="rk-stat">
              <span className="rk-stat__val">{score.manque}</span>
              <span className="rk-stat__lab">non détectées</span>
            </div>
          </div>

          <div className="rk-legend">
            <span className="rk-mark rk-mark--juste" /> ≤ {JUSTE_MS} ms
            <span className="rk-mark rk-mark--correct" /> ≤ {CORRECT_MS} ms
            <span className="rk-mark rk-mark--imprecis" /> au-delà
            <span className="rk-mark rk-mark--manque" /> non détectée
            {score.extras ? <em>· {score.extras} attaque(s) en trop</em> : null}
          </div>

          {bars.map((b, i) => (
            <NoteMarks key={i} results={score.results} bar={i} name={barName(b)} />
          ))}

          <div className="rk-calib">
            <p className="rk-note">
              Latence appliquée : {state.rLatencyMs} ms. Elle se règle plus haut — l'étalonnage sur
              des noires lentes est plus sûr que ce report, qui mêle latence et placement.
            </p>
            <button
              type="button"
              className="btn btn--toggle btn--sm"
              disabled={session.rawMedianMs === null}
              onClick={() => patch({ rLatencyMs: Math.round(session.rawMedianMs ?? 0) })}
            >
              À défaut, caler sur cette session
              {session.rawMedianMs !== null
                ? ` (${session.rawMedianMs > 0 ? '+' : ''}${session.rawMedianMs.toFixed(0)} ms)`
                : ''}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
