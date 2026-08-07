import { getCtx } from './engine';
import processorUrl from './onset-processor.js?url';

export interface InputDevice {
  deviceId: string;
  label: string;
}

let moduleLoaded = false;

/**
 * Contraintes de capture pour un instrument : tous les traitements « voix » doivent
 * être coupés. L'annulation d'écho et la réduction de bruit détruisent une basse,
 * et le gain automatique fausse toute mesure de niveau.
 */
const CONSTRAINTS = (deviceId?: string): MediaStreamConstraints => ({
  audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  },
  video: false,
});

export type InputError = 'refuse' | 'introuvable' | 'occupee' | 'nonSecurise' | 'inconnu';

/**
 * Traduit l'échec de `getUserMedia` en cause exploitable. Le nom de l'exception
 * distingue des situations qui appellent des gestes très différents : autoriser
 * dans le navigateur, brancher l'interface, ou fermer le logiciel qui la retient.
 */
export function describeInputError(e: unknown): InputError {
  if (!window.isSecureContext) return 'nonSecurise';
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'refuse';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'introuvable';
  // L'interface est ouverte en exclusif par un autre logiciel (DAW, OBS…).
  if (name === 'NotReadableError' || name === 'AbortError') return 'occupee';
  return 'inconnu';
}

/**
 * Demande l'autorisation micro. Sans elle, les entrées n'ont pas de nom exploitable.
 * Renvoie `null` si tout va bien, sinon la cause du refus.
 */
export async function requestPermission(): Promise<InputError | null> {
  if (!window.isSecureContext) return 'nonSecurise';
  if (!navigator.mediaDevices?.getUserMedia) return 'introuvable';
  try {
    const s = await navigator.mediaDevices.getUserMedia(CONSTRAINTS());
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch (e) {
    return describeInputError(e);
  }
}

export async function listInputs(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Entrée ${i + 1}` }));
}

export interface OnsetEvent {
  /** date de l'attaque sur l'horloge de l'AudioContext */
  time: number;
  level: number;
}

export interface InputSession {
  stop: () => void;
  /** fréquence d'échantillonnage réellement négociée avec l'interface */
  sampleRate: number;
  label: string;
  /**
   * Latences déclarées par le navigateur, en millisecondes. Elles ne couvrent pas
   * la capture, mais donnent un ordre de grandeur : une latence mesurée très
   * supérieure vient du jeu, pas de la chaîne audio.
   */
  baseLatencyMs: number;
  outputLatencyMs: number;
}

export interface InputOptions {
  deviceId?: string;
  onOnset: (e: OnsetEvent) => void;
  onLevel: (level: number) => void;
  /** injection d'un flux de test, pour vérifier la chaîne sans instrument */
  stream?: MediaStream;
}

/**
 * Ouvre l'entrée et branche la détection d'attaques.
 * Rien n'est enregistré ni transmis : le signal ne quitte pas la page.
 */
export async function startInput(opts: InputOptions): Promise<InputSession> {
  const ac = getCtx();
  if (!ac) throw new Error("AudioContext indisponible");

  if (!moduleLoaded) {
    await ac.audioWorklet.addModule(processorUrl);
    moduleLoaded = true;
  }

  const stream =
    opts.stream ?? (await navigator.mediaDevices.getUserMedia(CONSTRAINTS(opts.deviceId)));

  const source = ac.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ac, 'onset-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });

  node.port.onmessage = (ev: MessageEvent) => {
    const d = ev.data as { type: string; time: number; level: number };
    if (d.type === 'onset') opts.onOnset({ time: d.time, level: d.level });
    else if (d.type === 'level') opts.onLevel(d.level);
  };

  // Un worklet sans sortie branchée n'est pas toujours cadencé : on le relie à la
  // destination via un gain nul, ce qui le fait tourner sans rien faire entendre
  // (et sans risque de larsen).
  const silent = ac.createGain();
  silent.gain.value = 0;
  source.connect(node);
  node.connect(silent);
  silent.connect(ac.destination);

  const track = stream.getAudioTracks()[0];

  return {
    sampleRate: ac.sampleRate,
    label: track?.label || 'Entrée audio',
    baseLatencyMs: (ac.baseLatency || 0) * 1000,
    outputLatencyMs: (ac.outputLatency || 0) * 1000,
    stop: () => {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
        silent.disconnect();
      } catch {
        /* déjà détaché */
      }
      // Le flux de test est fourni par l'appelant : à lui de l'arrêter.
      if (!opts.stream) stream.getTracks().forEach((t) => t.stop());
    },
  };
}
