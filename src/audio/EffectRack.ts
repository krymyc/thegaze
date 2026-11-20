import { GazeAudioEngine, makeEffect, type EffectKind, type EffectNode, type EffectSettings } from './engine';

/**
 * EffectRack owns only the external routing edges between source, effects and
 * destination. It does not tear down an effect's internal topology when the
 * chain is rebuilt (important for feedback delay networks).
 */
export class EffectRack {
  private effects: EffectNode[] = [];
  private externalEdges: Array<[AudioNode, AudioNode]> = [];
  private disposed = false;

  constructor(
    private readonly source: AudioNode,
    private readonly destination: AudioNode = GazeAudioEngine.get().master,
    private readonly engine: GazeAudioEngine = GazeAudioEngine.get(),
  ) {
    this.rebuild();
  }

  get items(): readonly EffectNode[] {
    return this.effects;
  }

  add(kind: EffectKind, settings: EffectSettings = {}): EffectNode {
    this.assertAlive();
    const effect = makeEffect(kind, this.engine, settings);
    this.effects.push(effect);
    this.rebuild();
    return effect;
  }

  remove(id: string): boolean {
    this.assertAlive();
    const index = this.effects.findIndex(effect => effect.id === id);
    if (index < 0) return false;
    const [effect] = this.effects.splice(index, 1);
    this.disposeEffect(effect);
    this.rebuild();
    return true;
  }

  setEnabled(id: string, enabled: boolean): boolean {
    this.assertAlive();
    const effect = this.effects.find(item => item.id === id);
    if (!effect) return false;
    effect.enabled = enabled;
    this.rebuild();
    return true;
  }

  move(id: string, targetIndex: number): boolean {
    this.assertAlive();
    const index = this.effects.findIndex(effect => effect.id === id);
    if (index < 0 || this.effects.length < 2) return false;
    const bounded = Math.max(0, Math.min(this.effects.length - 1, Math.floor(targetIndex)));
    if (index === bounded) return true;
    const [effect] = this.effects.splice(index, 1);
    this.effects.splice(bounded, 0, effect);
    this.rebuild();
    return true;
  }

  rebuild(): void {
    this.assertAlive();
    this.disconnectExternalEdges();
    const active = this.effects.filter(effect => effect.enabled);
    let previous = this.source;
    for (const effect of active) {
      this.connectExternal(previous, effect.input);
      previous = effect.output;
    }
    this.connectExternal(previous, this.destination);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disconnectExternalEdges();
    this.effects.forEach(effect => this.disposeEffect(effect));
    this.effects = [];
    this.disposed = true;
  }

  private connectExternal(from: AudioNode, to: AudioNode): void {
    from.connect(to);
    this.externalEdges.push([from, to]);
  }

  private disconnectExternalEdges(): void {
    for (const [from, to] of this.externalEdges) {
      try { from.disconnect(to); } catch { /* edge may already be disconnected */ }
    }
    this.externalEdges = [];
  }

  private disposeEffect(effect: EffectNode): void {
    for (const node of effect.nodes) {
      if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
        try { node.stop(); } catch { /* already stopped */ }
      }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('EffectRack has been disposed');
  }
}
