import type { EffectNode, EffectSettings } from './engine';

/** Apply supported parameter changes to an existing effect without rebuilding its graph. */
export function updateEffect(effect: EffectNode, patch: EffectSettings): void {
  const settings = { ...effect.settings, ...patch };
  const nodes = effect.nodes;
  switch (effect.kind) {
    case 'filter': {
      const filter = nodes[0] as BiquadFilterNode;
      if (settings.type) filter.type = settings.type as BiquadFilterType;
      if (settings.frequency !== undefined) filter.frequency.setTargetAtTime(Number(settings.frequency), filter.context.currentTime, 0.02);
      if (settings.q !== undefined) filter.Q.setTargetAtTime(Number(settings.q), filter.context.currentTime, 0.02);
      break;
    }
    case 'gain': {
      const gain = nodes[0] as GainNode;
      if (settings.gain !== undefined) gain.gain.setTargetAtTime(Number(settings.gain), gain.context.currentTime, 0.02);
      break;
    }
    case 'distortion': {
      const shaper = nodes[0] as WaveShaperNode;
      if (settings.amount !== undefined) shaper.curve = distortionCurve(Number(settings.amount));
      if (settings.oversample) shaper.oversample = settings.oversample as OverSampleType;
      break;
    }
    case 'delay': {
      const [delay, feedback, wet, dry] = nodes as [DelayNode, GainNode, GainNode, GainNode, GainNode];
      const now = delay.context.currentTime;
      if (settings.time !== undefined) delay.delayTime.setTargetAtTime(Number(settings.time), now, 0.02);
      if (settings.feedback !== undefined) feedback.gain.setTargetAtTime(clamp(Number(settings.feedback), 0, 0.95), now, 0.02);
      if (settings.mix !== undefined) {
        const mix = clamp(Number(settings.mix), 0, 1);
        wet.gain.setTargetAtTime(mix, now, 0.02);
        dry.gain.setTargetAtTime(1 - mix, now, 0.02);
      }
      break;
    }
    case 'reverb': {
      const convolver = nodes[0] as ConvolverNode;
      if (settings.seconds !== undefined || settings.decay !== undefined) {
        const seconds = clamp(Number(settings.seconds ?? 2), 0.1, 10);
        const decay = Math.max(0.1, Number(settings.decay ?? 2.5));
        const length = Math.floor(convolver.context.sampleRate * seconds);
        const impulse = convolver.context.createBuffer(2, length, convolver.context.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
        convolver.buffer = impulse;
      }
      break;
    }
    case 'tremolo': {
      const [gain, lfo, mod] = nodes as [GainNode, OscillatorNode, GainNode];
      const now = gain.context.currentTime;
      if (settings.rate !== undefined) lfo.frequency.setTargetAtTime(Number(settings.rate), now, 0.02);
      if (settings.depth !== undefined) {
        const depth = clamp(Number(settings.depth), 0, 1);
        mod.gain.setTargetAtTime(depth, now, 0.02);
        gain.gain.setTargetAtTime(1 - depth, now, 0.02);
      }
      break;
    }
    case 'ringmod': {
      const [carrier] = nodes as [OscillatorNode, GainNode];
      if (settings.frequency !== undefined) carrier.frequency.setTargetAtTime(Number(settings.frequency), carrier.context.currentTime, 0.02);
      break;
    }
    case 'bitcrusher': {
      const shaper = nodes[0] as WaveShaperNode;
      if (settings.bits !== undefined) shaper.curve = bitcrusherCurve(Number(settings.bits));
      break;
    }
  }
  effect.settings = settings;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distortionCurve(amount: number): Float32Array {
  const k = Math.max(0, amount);
  const curve = new Float32Array(44100);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1;
    curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
  }
  return curve;
}

function bitcrusherCurve(bits: number): Float32Array {
  const steps = Math.pow(2, clamp(Math.round(bits), 2, 16));
  const curve = new Float32Array(65536);
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / (curve.length - 1) - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}
