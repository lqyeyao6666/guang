import type { Level } from './level.ts';
import type { Settings } from './settings.ts';

type Chapter = Level['chapter'];
const tracks = {
  1: { title: '暖阳琴声 · Vaporware', url: '/music/chapter-1-vaporware.mp3' },
  2: { title: '梦境薄云 · Heavenly Loop', url: '/music/chapter-2-heavenly-loop.mp3' },
  3: { title: '安静色谱 · Calm Ambient 1', url: '/music/chapter-3-calm-ambient-1.mp3' },
} as const;
interface Voice {
  chapter: Chapter;
  source: AudioBufferSourceNode;
  gain: GainNode;
  started: number;
  offset: number;
}

/** One audio graph for the whole game; chapter changes never accumulate players. */
export class ChapterMusic {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly samples = new Float32Array(1024);
  private readonly buffers = new Map<Chapter, AudioBuffer>();
  private readonly loading = new Map<Chapter, Promise<AudioBuffer>>();
  private readonly positions = new Map<Chapter, number>();
  private readonly voices = new Set<Voice>();
  private active: Voice | null = null;
  private chapter: Chapter;
  private enabled: boolean;
  private volume: number;
  private unlocked = false;
  private pageHidden = false;
  private disposed = false;
  private revision = 0;
  private pauseTimer = 0;
  private error: string | null = null;

  constructor(settings: Settings, chapter: Chapter, private readonly onChange: () => void) {
    this.enabled = settings.musicEnabled;
    this.volume = settings.musicVolume;
    this.chapter = chapter;
    document.addEventListener('pointerdown', this.unlock, true);
    document.addEventListener('keydown', this.unlock, true);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
  }

  private readonly unlock = (event: Event): void => {
    if (!event.isTrusted || this.disposed) return;
    if (this.unlocked && this.context?.state === 'running' && this.active?.chapter === this.chapter && !this.error) return;
    this.unlocked = true;
    void this.sync();
  };
  private readonly onVisibility = (): void => { void this.sync(); };
  private readonly onPageHide = (): void => { this.pageHidden = true; void this.sync(); };
  private readonly onPageShow = (): void => { this.pageHidden = false; void this.sync(); };
  private canPlay(): boolean {
    return !this.disposed && this.unlocked && this.enabled && this.volume > 0 && !document.hidden && !this.pageHidden;
  }

  setChapter(chapter: Chapter): void {
    if (chapter === this.chapter) return;
    this.chapter = chapter;
    this.error = null;
    this.onChange();
    void this.sync();
  }

  setSettings(settings: Settings): void {
    if (this.enabled === settings.musicEnabled && this.volume === settings.musicVolume) return;
    this.enabled = settings.musicEnabled;
    this.volume = settings.musicVolume;
    void this.sync();
  }

  private buffer(chapter: Chapter): Promise<AudioBuffer> {
    const cached = this.buffers.get(chapter);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(chapter);
    if (pending) return pending;
    const task = (async () => {
      const response = await fetch(tracks[chapter].url);
      if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(chapter, buffer);
      return buffer;
    })().finally(() => this.loading.delete(chapter));
    this.loading.set(chapter, task);
    return task;
  }

  private async sync(): Promise<void> {
    const revision = ++this.revision;
    window.clearTimeout(this.pauseTimer);
    if (!this.canPlay()) {
      if (this.context && this.master && this.context.state !== 'closed') {
        const context = this.context;
        const now = context.currentTime;
        this.master.gain.cancelAndHoldAtTime(now);
        this.master.gain.linearRampToValueAtTime(0, now + .08);
        // Freeze the audio clock when hidden or muted, retaining the exact play position.
        if (document.hidden || this.pageHidden) await context.suspend().catch(() => {});
        else this.pauseTimer = window.setTimeout(() => {
          if (!this.canPlay() && context.state === 'running') void context.suspend().catch(() => {});
        }, 100);
      }
      this.onChange();
      return;
    }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.samples.length;
        this.master.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      }
      const context = this.context;
      if (context.state !== 'running') await context.resume();
      if (revision !== this.revision || !this.canPlay()) return;
      const now = context.currentTime;
      this.master!.gain.cancelAndHoldAtTime(now);
      this.master!.gain.linearRampToValueAtTime(this.volume, now + .12);
      if (this.active?.chapter !== this.chapter) {
        const chapter = this.chapter;
        const buffer = await this.buffer(chapter);
        if (revision !== this.revision || !this.canPlay()) return;
        this.start(chapter, buffer);
      }
      this.error = null;
    } catch (error) {
      if (revision === this.revision) this.error = error instanceof Error ? error.message : String(error);
    }
    this.onChange();
  }

  private position(voice: Voice, at = this.context!.currentTime): number {
    return (voice.offset + Math.max(0, at - voice.started)) % voice.source.buffer!.duration;
  }
  private stop(voice: Voice): void {
    this.positions.set(voice.chapter, this.position(voice));
    voice.source.stop();
    voice.source.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
  private start(chapter: Chapter, buffer: AudioBuffer): void {
    const context = this.context!;
    const now = context.currentTime;
    // Fast repeated navigation can leave at most one outgoing and one incoming voice.
    for (const voice of this.voices) if (voice !== this.active) this.stop(voice);
    const previous = this.active;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(this.master!);
    const offset = (this.positions.get(chapter) ?? 0) % buffer.duration;
    const voice: Voice = { chapter, source, gain, started: now, offset };
    this.voices.add(voice);
    this.active = voice;
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect(); gain.disconnect();
    };
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, now + (previous ? 1.1 : .3));
    source.start(now, offset);
    if (previous) {
      previous.gain.gain.cancelAndHoldAtTime(now);
      previous.gain.gain.linearRampToValueAtTime(0, now + 1.1);
      this.positions.set(previous.chapter, this.position(previous, now + 1.1));
      previous.source.stop(now + 1.12);
    }
  }

  state() {
    this.analyser?.getFloatTimeDomainData(this.samples);
    const playing = this.canPlay() && this.context?.state === 'running' && !!this.active;
    const rms = playing ? Math.sqrt(this.samples.reduce((sum, sample) => sum + sample * sample, 0) / this.samples.length) : 0;
    return {
      chapter: this.chapter, title: tracks[this.chapter].title, url: tracks[this.chapter].url,
      enabled: this.enabled, volume: this.volume, unlocked: this.unlocked,
      context: this.context?.state ?? 'locked', playing, rms, error: this.error,
      activeChapter: this.active?.chapter ?? null, voices: this.voices.size,
      position: this.active ? this.position(this.active) : 0,
      duration: this.active?.source.buffer?.duration ?? 0,
      cachedChapters: [...this.buffers.keys()],
    };
  }

  dispose(): void {
    this.disposed = true;
    ++this.revision;
    window.clearTimeout(this.pauseTimer);
    document.removeEventListener('pointerdown', this.unlock, true);
    document.removeEventListener('keydown', this.unlock, true);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    for (const voice of this.voices) this.stop(voice);
    void this.context?.close().catch(() => {});
  }
}
