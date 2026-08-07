import { useCallback, useEffect, useRef, useState } from 'react';
import { getCtx, scheduleClick } from '../audio/engine';
import { BEATS_PER_BAR } from './exercise';

/** Tempo lent : à 60 BPM les temps sont à une seconde, aucun appariement n'est ambigu. */
export const CALIB_TEMPO = 60;
export const CALIB_BARS = 8;
/** Au-delà, l'attaque n'est pas rattachée à un clic : c'est du bruit. */
const MAX_DIST = 0.3;
/** En dessous, la médiane n'est pas fiable. */
export const MIN_NOTES = 8;

export interface CalibResult {
  /** décalage médian, en millisecondes : c'est la latence à retrancher */
  medianMs: number;
  /** écart absolu médian : dispersion du jeu et de la chaîne */
  spreadMs: number;
  count: number;
}

export interface Calibration {
  running: boolean;
  captured: number;
  total: number;
  result: CalibResult | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  pushOnset: (time: number) => void;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Étalonnage de la latence d'entrée : on joue des noires sur le clic, à tempo lent,
 * pendant plusieurs mesures. Chaque attaque est rattachée au clic le plus proche et
 * l'on retient la **médiane** des écarts — insensible aux quelques notes ratées,
 * contrairement à une moyenne.
 *
 * Mesurer sur l'exercice complet serait moins fiable : aux doubles croches, les
 * erreurs de placement se confondent avec la latence qu'on cherche à isoler.
 */
export function useCalibration(): Calibration {
  const [running, setRunning] = useState(false);
  const [captured, setCaptured] = useState(0);
  const [result, setResult] = useState<CalibResult | null>(null);

  const runningRef = useRef(false);
  const detections = useRef<number[]>([]);
  const clicks = useRef<number[]>([]);
  const timer = useRef<number | null>(null);

  const total = CALIB_BARS * BEATS_PER_BAR;

  const compute = (): void => {
    const devs: number[] = [];
    detections.current.forEach((d) => {
      let best = Infinity;
      clicks.current.forEach((c) => {
        if (Math.abs(d - c) < Math.abs(best)) best = d - c;
      });
      if (Math.abs(best) <= MAX_DIST) devs.push(best * 1000);
    });
    if (devs.length < MIN_NOTES) {
      setResult(null);
      return;
    }
    const med = median(devs);
    setResult({
      medianMs: med,
      spreadMs: median(devs.map((d) => Math.abs(d - med))),
      count: devs.length,
    });
  };
  const computeRef = useRef(compute);
  computeRef.current = compute;

  const finish = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    runningRef.current = false;
    setRunning(false);
    computeRef.current();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const pushOnset = useCallback((time: number) => {
    if (!runningRef.current) return;
    detections.current.push(time);
    setCaptured(detections.current.length);
  }, []);

  const start = useCallback(() => {
    const ac = getCtx();
    if (!ac) return;
    if (timer.current !== null) window.clearTimeout(timer.current);

    const spb = 60 / CALIB_TEMPO;
    const t0 = ac.currentTime + 0.5;
    const times: number[] = [];
    for (let b = 0; b < total; b++) {
      const t = t0 + b * spb;
      times.push(t);
      scheduleClick(ac, b % BEATS_PER_BAR === 0, t);
    }
    clicks.current = times;
    detections.current = [];
    setCaptured(0);
    setResult(null);
    runningRef.current = true;
    setRunning(true);

    const endAt = t0 + total * spb + 0.4;
    timer.current = window.setTimeout(
      () => finishRef.current(),
      Math.max(0, (endAt - ac.currentTime) * 1000),
    );
  }, [total]);

  /** Arrêt anticipé : on calcule sur ce qui a été joué. */
  const stop = useCallback(() => finishRef.current(), []);

  const reset = useCallback(() => {
    setResult(null);
    setCaptured(0);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { running, captured, total, result, start, stop, reset, pushOnset };
}
