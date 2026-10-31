export type Effect = 'click' | 'rotate' | 'grab' | 'place';

/** Small original UI sounds synthesized locally; no sample files or network requests. */
export class SoundEffects {
  private context: AudioContext | null = null;
  private enabled: boolean;
  private disposed = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    document.addEventListener('pointerdown', this.unlock, true);
    document.addEventListener('keydown', this.unlock, true);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pagehide', this.suspend);
    window.addEventListener('pageshow', this.resume);
  }

  private readonly unlock = (event: Event): void => {
    if (!event.isTrusted || this.disposed || !this.enabled) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  };
  private readonly visibility = (): void => {
    if (document.hidden) this.suspend();
    else this.resume();
  };
  private readonly suspend = (): void => { if (this.context?.state === 'running') void this.context.suspend().catch(() => {}); };
  private readonly resume = (): void => {
    if (!document.hidden && !this.disposed && this.enabled && this.context?.state === 'suspended') void this.context.resume().catch(() => {});
  };

  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  play(effect: Effect): void {
    if (!this.enabled || this.disposed || document.hidden) return;
    if (!this.context) this.context = new AudioContext();
    const context = this.context;
    const schedule = (): void => {
      if (this.disposed || !this.enabled || context.state !== 'running') return;
      const now = context.currentTime + .006;
      const voice = (type: OscillatorType, startHz: number, endHz: number, delay: number, length: number, peak: number): void => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + delay, end = start + length;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(startHz, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), end);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(.008, length * .18));
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(end + .012);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      };
      switch (effect) {
        case 'click':
          voice('sine', 760, 510, 0, .052, .055);
          voice('sine', 1140, 870, .008, .034, .012);
          break;
        case 'rotate':
          voice('triangle', 540, 880, 0, .085, .044);
          voice('sine', 790, 1120, .055, .065, .026);
          voice('sine', 1320, 990, .06, .09, .009);
          break;
        case 'grab':
          voice('triangle', 330, 220, 0, .095, .052);
          voice('sine', 500, 390, .012, .068, .014);
          break;
        case 'place':
          voice('sine', 250, 165, 0, .11, .048);
          voice('triangle', 470, 620, .018, .075, .018);
          break;
      }
    };
    if (context.state === 'running') schedule();
    else void context.resume().then(schedule).catch(() => {});
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('pointerdown', this.unlock, true);
    document.removeEventListener('keydown', this.unlock, true);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pagehide', this.suspend);
    window.removeEventListener('pageshow', this.resume);
    void this.context?.close().catch(() => {});
  }
}
