/**
 * Détection d'attaques sur le signal d'entrée, dans le thread audio.
 *
 * Un `AudioWorklet` plutôt qu'un `AnalyserNode` interrogé en `requestAnimationFrame` :
 * le worklet voit chaque bloc de 128 échantillons (≈ 2,7 ms à 48 kHz) et horodate sur
 * l'horloge de l'`AudioContext`, alors que rAF plafonne à ~16 ms et gigue avec l'affichage.
 */
class OnsetProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    /** Combien de fois au-dessus du bruit de fond une attaque doit se détacher. */
    this.factor = o.factor || 3.5;
    /** Niveau minimal absolu, pour ignorer le souffle d'une entrée ouverte. */
    this.floor = o.floor || 0.012;
    /** Temps mort après une attaque, en secondes. */
    this.refractory = o.refractory || 0.06;

    this.baseline = 0;
    this.lastOnset = -1;
    /** Faux tant que le signal n'est pas redescendu : évite de compter une note deux fois. */
    this.armed = true;
    this.peak = 0;
    this.blocks = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;

    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / ch.length);

    // Bruit de fond : suit très lentement, pour ne pas être tiré vers le haut par les notes.
    this.baseline = this.baseline * 0.999 + rms * 0.001;
    const trigger = Math.max(this.floor, this.baseline * this.factor);

    if (rms > trigger && this.armed && currentTime - this.lastOnset > this.refractory) {
      this.lastOnset = currentTime;
      this.armed = false;
      this.port.postMessage({ type: 'onset', time: currentTime, level: rms });
    }
    // Réarmement à 60 % du seuil : hystérésis, sinon une note tenue redéclenche.
    if (rms < trigger * 0.6) this.armed = true;

    this.peak = Math.max(this.peak, rms);
    this.blocks++;
    if (this.blocks % 8 === 0) {
      this.port.postMessage({ type: 'level', level: this.peak });
      this.peak = 0;
    }
    return true;
  }
}

registerProcessor('onset-processor', OnsetProcessor);
