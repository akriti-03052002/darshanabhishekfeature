import { ExperienceSpec } from '../data/experiences';

type AudioProfile = ExperienceSpec['audioProfile'];

export class RitualAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private pourGain: GainNode | null = null;
  private pourFilter: BiquadFilterNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private muted = false;
  private currentProfile: AudioProfile = 'sanatan-shiva';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      this.setupPourStream();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupPourStream() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pinkish-brown noise for natural rushing water/milk
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 2.8;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.pourFilter = filter;
    this.pourGain = gain;
  }

  public startAmbient(profile: AudioProfile) {
    this.currentProfile = profile;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    this.stopAmbient();

    const ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0.001, ctx.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.11, ctx.currentTime + 1.8);
    ambientGain.connect(this.masterGain);
    this.ambientGain = ambientGain;

    // Tradition-tailored harmonic intervals (no external copyrighted MP3s)
    const droneFreqs: Record<AudioProfile, number[]> = {
      'sanatan-shiva': [130.81, 196.0, 261.63], // C3 - G3 - C4 Om Tanpura fifth
      'sanatan-flute': [146.83, 220.0, 293.66], // D3 - A3 - D4 Bansuri drone
      'sanatan-temple': [138.59, 207.65, 277.18], // C#3 - G#3 - C#4
      buddhist: [110.0, 164.81, 220.0], // Deep meditative A2 - E3 - A3
      sikh: [146.83, 220.0, 293.66, 440.0], // Serene Shabad Tanpura D-A-D-A
      christian: [174.61, 220.0, 261.63], // Warm F major cathedral pad
      islamic: [130.81, 196.0, 233.08], // Soft Sufi Ney-like fifth & minor seventh
      jain: [146.83, 220.0, 329.63] // Pure tranquil D-A-E
    };

    const freqs = droneFreqs[profile];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = profile === 'christian' ? 680 : 540;
    filter.connect(ambientGain);
    this.ambientNodes.push(filter);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f;

      const oscGain = ctx.createGain();
      oscGain.gain.value = idx === 0 ? 0.42 : 0.24 / (idx + 0.5);

      // Gentle breathing LFO
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14 + idx * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      lfo.start();
      this.ambientNodes.push(osc, lfo, oscGain, lfoGain);
    });
  }

  public stopAmbient() {
    for (const node of this.ambientNodes) {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore already stopped
      }
    }
    this.ambientNodes = [];
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {
        // ignore
      }
      this.ambientGain = null;
    }
  }

  public updatePourStream(rate: number, isMilk: boolean) {
    if (!this.ctx || !this.pourGain || !this.pourFilter) return;
    const clamped = Math.max(0, Math.min(1, rate));
    const targetGain = clamped > 0.02 ? (isMilk ? 0.16 : 0.22) * clamped : 0;
    const targetFreq = isMilk ? 520 + clamped * 360 : 880 + clamped * 920;

    this.pourGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    this.pourFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  public playBell(pitchScale = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const partials = [1, 2.02, 2.98, 4.12];
    const base = 528 * pitchScale;

    partials.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const amp = 0.18 / (idx + 1);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, now + (2.6 - idx * 0.4));
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 2.7);
    });
  }

  public playSingingBowl() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const partials = [216, 434.5, 651, 872];
    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const amp = 0.22 / (idx + 1);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 4.8);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 5.0);
    });
  }

  public playPlacementChime() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const notes = this.currentProfile === 'islamic' ? [392, 523.25] : [523.25, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + idx * 0.08;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.85);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }

  public playTasbihClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playFlameIgnite() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.16);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playBrassHandling() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    [780, 1420].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.055 / (i + 1), now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 0.35);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public playFlowerPlace() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.0004, now + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playTraySettle(heavy = true) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 185 : 290, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 88 : 140, now + 0.09);
    g.gain.setValueAtTime(heavy ? 0.1 : 0.045, now);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    this.ensureContext();
  }

  public dispose() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
