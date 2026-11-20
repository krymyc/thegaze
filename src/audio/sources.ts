import { GazeAudioEngine } from './engine';

/** Common contract for source modules. Every source feeds a rack or engine bus. */
export interface AudioSource {
  readonly output: AudioNode;
  start(): Promise<void> | void;
  stop(): void;
  dispose(): void;
}

/** Restartable oscillator source for Generate and test tones. */
export class OscillatorSource implements AudioSource {
  readonly output: GainNode;
  private oscillator: OscillatorNode | null = null;
  private engine: GazeAudioEngine;

  constructor(
    private readonly type: OscillatorType = 'sawtooth',
    private frequency = 220,
    private level = 0.35,
    engine = GazeAudioEngine.get(),
  ) {
    this.engine = engine;
    this.output = engine.context.createGain();
    this.output.gain.value = Math.max(0, Math.min(1, level));
  }

  setFrequency(value: number): void {
    if (this.oscillator) {
      this.oscillator.frequency.setTargetAtTime(
        Math.max(1, value), this.engine.context.currentTime, 0.015,
      );
    }
    this.frequency = Math.max(1, value);
  }

  setLevel(value: number): void {
    this.output.gain.setTargetAtTime(
      Math.max(0, Math.min(1, value)), this.engine.context.currentTime, 0.015,
    );
  }

  start(): void {
    if (this.oscillator) return;
    const oscillator = this.engine.context.createOscillator();
    oscillator.type = this.type;
    oscillator.frequency.value = this.frequency;
    oscillator.connect(this.output);
    oscillator.start();
    this.oscillator = oscillator;
  }

  stop(): void {
    const oscillator = this.oscillator;
    this.oscillator = null;
    if (!oscillator) return;
    try { oscillator.stop(); } catch { /* already stopped */ }
    try { oscillator.disconnect(); } catch { /* already disconnected */ }
  }

  dispose(): void {
    this.stop();
    this.output.disconnect();
  }
}

/** Buffer source adapter. Buffer playback is one-shot; start() creates a fresh node. */
export class BufferSource implements AudioSource {
  readonly output: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private engine: GazeAudioEngine;

  constructor(
    private readonly buffer: AudioBuffer,
    level = 1,
    engine = GazeAudioEngine.get(),
  ) {
    this.engine = engine;
    this.output = engine.context.createGain();
    this.output.gain.value = Math.max(0, Math.min(2, level));
  }

  start(): void {
    this.stop();
    const source = this.engine.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.output);
    source.onended = () => {
      if (this.source === source) this.source = null;
      try { source.disconnect(); } catch { /* already disconnected */ }
    };
    this.source = source;
    source.start();
  }

  stop(): void {
    const source = this.source;
    this.source = null;
    if (!source) return;
    try { source.stop(); } catch { /* already stopped */ }
    try { source.disconnect(); } catch { /* already disconnected */ }
  }

  dispose(): void {
    this.stop();
    this.output.disconnect();
  }
}

/** Microphone adapter with explicit track ownership and no automatic speaker monitoring. */
export class MicrophoneSource implements AudioSource {
  readonly output: GainNode;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private engine: GazeAudioEngine;

  constructor(engine = GazeAudioEngine.get()) {
    this.engine = engine;
    this.output = engine.context.createGain();
  }

  async start(): Promise<void> {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await this.engine.resume();
    const source = this.engine.context.createMediaStreamSource(stream);
    source.connect(this.output);
    this.stream = stream;
    this.source = source;
  }

  stop(): void {
    try { this.source?.disconnect(); } catch { /* already disconnected */ }
    this.source = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }

  dispose(): void {
    this.stop();
    this.output.disconnect();
  }
}
