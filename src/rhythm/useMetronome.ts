import { useCallback, useEffect, useRef, useState } from 'react';
import { getCtx, scheduleTick } from '../audio/engine';
import {
  SUBDIVISIONS,
  TEMPO_MAX,
  TEMPO_MIN,
  programSubdivAt,
  subdivCount,
  type MetroSettings,
} from './metronome';

/** Avance de planification sur l'horloge audio, en secondes. */
const LOOKAHEAD = 0.15;
/** Période du planificateur, en millisecondes. */
const TICK = 25;

export interface Metronome {
  running: boolean;
  /** temps courant dans la mesure, 0-based ; -1 à l'arrêt */
  beat: number;
  /** subdivision courante à l'intérieur du temps ; 0 = sur le temps */
  sub: number;
  /** mesures écoulées depuis le départ */
  bar: number;
  /** tempo réellement joué : il s'écarte du réglage pendant une montée */
  bpm: number;
  /** la mesure en cours est muette (travail du temps intérieur) */
  muet: boolean;
  /** subdivision réellement jouée : l'enchaînement la change de mesure en mesure */
  subdiv: number;
  toggle: () => void;
  start: () => void;
  stop: () => void;
}

interface Pending {
  t: number;
  beat: number;
  sub: number;
  bar: number;
  muet: boolean;
  subdiv: number;
}

/**
 * Métronome complet : métrique libre, accent réglable temps par temps, subdivision,
 * montée en tempo automatique et mesures muettes.
 *
 * Les clics sont planifiés à l'avance sur l'horloge de l'`AudioContext`, un par un,
 * chacun daté à partir du précédent. Cette avance pas à pas — plutôt qu'un temps
 * calculé depuis une origine fixe — est ce qui permet de changer de tempo, de
 * métrique ou de subdivision en marche : le clic suivant prend simplement la
 * nouvelle valeur, sans qu'aucun de ceux déjà en file ne se déplace.
 *
 * L'affichage ne lit pas cette file : il en dépile les entrées à mesure que
 * l'horloge audio les atteint, ce qui le garde en phase avec ce qu'on entend.
 */
export function useMetronome(settings: MetroSettings): Metronome {
  const cfg = useRef(settings);
  cfg.current = settings;

  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [sub, setSub] = useState(0);
  const [bar, setBar] = useState(0);
  const [muet, setMuet] = useState(false);
  const [bpm, setBpm] = useState(settings.bpm);
  const [liveSubdiv, setLiveSubdiv] = useState(settings.subdiv);

  const nextTime = useRef(0);
  const pBeat = useRef(0);
  const pSub = useRef(0);
  const pBar = useRef(0);
  const curBpm = useRef(settings.bpm);
  /** mesures déjà tenues au palier courant de la montée en tempo */
  const rampHeld = useRef(0);
  /** la mesure en cours est-elle audible */
  const audible = useRef(false);
  /** mesures restantes dans la phase courante (audible ou muette) */
  const phaseLeft = useRef(0);
  /** subdivision de la mesure en cours : l'enchaînement la fait changer */
  const curSubdiv = useRef(settings.subdiv);

  const queue = useRef<Pending[]>([]);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const endTimer = useRef<number | null>(null);

  const clearAll = (): void => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    if (raf.current !== null) {
      window.cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (endTimer.current !== null) {
      window.clearTimeout(endTimer.current);
      endTimer.current = null;
    }
    queue.current = [];
  };

  const stop = useCallback((): void => {
    clearAll();
    setRunning(false);
    setBeat(-1);
    setSub(0);
    setMuet(false);
  }, []);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  /** Fin d'un enchaînement non bouclé : on laisse sonner ce qui est déjà planifié. */
  const armEnd = (ac: AudioContext): void => {
    if (endTimer.current !== null) return;
    endTimer.current = window.setTimeout(
      () => stopRef.current(),
      Math.max(0, (nextTime.current - ac.currentTime) * 1000) + 150,
    );
  };

  /** Début de mesure : on y applique la montée en tempo puis l'alternance des silences. */
  const openBar = (): void => {
    const { ramp, gap } = cfg.current;

    if (ramp.on) {
      const dir = ramp.to >= ramp.from ? 1 : -1;
      if (rampHeld.current >= Math.max(1, ramp.bars)) {
        const next = curBpm.current + dir * Math.abs(ramp.step);
        curBpm.current = dir > 0 ? Math.min(ramp.to, next) : Math.max(ramp.to, next);
        rampHeld.current = 0;
      }
      rampHeld.current++;
    } else {
      rampHeld.current = 0;
    }

    if (!gap.on) {
      audible.current = true;
      phaseLeft.current = 0;
      return;
    }
    if (gap.random) {
      audible.current = Math.random() < 0.5;
      return;
    }
    if (phaseLeft.current <= 0) {
      audible.current = !audible.current;
      let n = audible.current ? Math.max(1, gap.bars) : gap.silent;
      // Une phase de durée nulle serait sautée en boucle : on repasse à l'autre.
      if (n <= 0) {
        audible.current = !audible.current;
        n = audible.current ? Math.max(1, gap.bars) : Math.max(1, gap.silent);
      }
      phaseLeft.current = n;
    }
    phaseLeft.current--;
  };

  const schedule = (): void => {
    const ac = getCtx();
    if (!ac) return;
    const { beats, accents, timbre, volume, prog } = cfg.current;
    const nBeats = Math.max(1, beats);

    while (nextTime.current < ac.currentTime + LOOKAHEAD) {
      let divs = subdivCount(curSubdiv.current);
      // La métrique ou la subdivision ont pu rétrécir depuis le clic précédent.
      if (pSub.current >= divs) {
        pSub.current = 0;
        pBeat.current++;
      }
      if (pBeat.current >= nBeats) {
        pBeat.current = 0;
        pBar.current++;
      }

      if (pBeat.current === 0 && pSub.current === 0) {
        // La subdivision de la mesure qui s'ouvre : celle de l'enchaînement s'il est
        // en service, le réglage fixe sinon.
        const s =
          prog.on && prog.segs.length ? programSubdivAt(prog, pBar.current) : cfg.current.subdiv;
        if (s === null) {
          // Enchaînement terminé, hors boucle : on ne planifie plus rien et l'on
          // s'arrête une fois le dernier clic déjà en file effectivement passé.
          armEnd(ac);
          break;
        }
        curSubdiv.current = s;
        divs = subdivCount(s);
        openBar();
      }
      // Hors montée, le réglage s'applique au clic suivant : bouger la réglette
      // pendant qu'on joue doit s'entendre tout de suite, pas à la mesure d'après.
      if (!cfg.current.ramp.on) curBpm.current = cfg.current.bpm;
      curBpm.current = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, curBpm.current));

      const ticks = (SUBDIVISIONS[curSubdiv.current] ?? SUBDIVISIONS[0]).ticks;
      const level =
        pSub.current === 0 ? (accents[pBeat.current] ?? 2) : (ticks[pSub.current - 1] ?? 0);

      if (audible.current && level > 0) {
        scheduleTick(ac, level, nextTime.current, timbre, volume / 100);
      }
      queue.current.push({
        t: nextTime.current,
        beat: pBeat.current,
        sub: pSub.current,
        bar: pBar.current,
        muet: !audible.current,
        subdiv: curSubdiv.current,
      });

      nextTime.current += 60 / curBpm.current / divs;
      pSub.current++;
      if (pSub.current >= divs) {
        pSub.current = 0;
        pBeat.current++;
        if (pBeat.current >= nBeats) {
          pBeat.current = 0;
          pBar.current++;
        }
      }
    }

    // Onglet en arrière-plan : le navigateur suspend `requestAnimationFrame` mais pas
    // `setInterval`. Plus personne ne dépile, alors qu'on continue d'empiler — sans ce
    // garde-fou la file grossirait tant que le métronome tourne.
    if (queue.current.length > 64) queue.current.splice(0, queue.current.length - 64);
  };
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const frame = (): void => {
    const ac = getCtx();
    if (ac) {
      let last: Pending | null = null;
      while (queue.current.length && queue.current[0].t <= ac.currentTime) {
        last = queue.current.shift() as Pending;
      }
      if (last) {
        setBeat(last.beat);
        setSub(last.sub);
        setBar(last.bar);
        setMuet(last.muet);
        setLiveSubdiv(last.subdiv);
        setBpm(Math.round(curBpm.current));
      }
    }
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const start = useCallback((): void => {
    const ac = getCtx();
    if (!ac) return;
    clearAll();
    const { ramp, prog } = cfg.current;
    curBpm.current = ramp.on ? ramp.from : cfg.current.bpm;
    rampHeld.current = 0;
    audible.current = false;
    phaseLeft.current = 0;
    pBeat.current = 0;
    pSub.current = 0;
    pBar.current = 0;
    curSubdiv.current =
      (prog.on && prog.segs.length ? programSubdivAt(prog, 0) : cfg.current.subdiv) ??
      cfg.current.subdiv;
    nextTime.current = ac.currentTime + 0.12;
    setBeat(0);
    setSub(0);
    setBar(0);
    setMuet(false);
    setLiveSubdiv(curSubdiv.current);
    setBpm(Math.round(curBpm.current));
    setRunning(true);
    scheduleRef.current();
    timer.current = window.setInterval(() => scheduleRef.current(), TICK);
    raf.current = window.requestAnimationFrame(() => frameRef.current());
  }, []);

  const toggle = useCallback((): void => {
    if (timer.current !== null) stop();
    else start();
  }, [start, stop]);

  // Le réglage de tempo ne pilote plus rien de planifié : `schedule` lit `curBpm`
  // à chaque clic. À l'arrêt en revanche, l'affichage doit suivre le réglage.
  useEffect(() => {
    if (timer.current === null) {
      curBpm.current = settings.ramp.on ? settings.ramp.from : settings.bpm;
      setBpm(Math.round(curBpm.current));
    }
  }, [settings.bpm, settings.ramp.on, settings.ramp.from]);

  useEffect(() => clearAll, []);

  return { running, beat, sub, bar, bpm, muet, subdiv: liveSubdiv, toggle, start, stop };
}
