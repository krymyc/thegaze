/**
 * THE GAZE — shared Web Audio engine foundation
 * Reusable across Generate / Process / Voice.
 */
export type EffectKind = 'filter'|'gain'|'distortion'|'delay'|'reverb'|'tremolo'|'ringmod'|'bitcrusher';
export type EffectSettings = Record<string, number|string|boolean>;

export interface EffectNode {
  id: string;
  kind: EffectKind;
  enabled: boolean;
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
  settings: EffectSettings;
}

export class GazeAudioEngine {
  private static instance: GazeAudioEngine;
  context: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  private constructor(){
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 4096;
    this.master.connect(this.analyser).connect(this.context.destination);
  }
  static get(): GazeAudioEngine {
    if(!this.instance) this.instance = new GazeAudioEngine();
    return this.instance;
  }
  async resume(){ if(this.context.state==='suspended') await this.context.resume(); }
  setMaster(value:number){ this.master.gain.setTargetAtTime(Math.max(0,Math.min(2,value)),this.context.currentTime,.02); }
  createOscillator(type:OscillatorType='sine',frequency=220){
    const osc=this.context.createOscillator(); osc.type=type; osc.frequency.value=frequency; return osc;
  }
  createNoise(){
    const length=this.context.sampleRate*2;
    const buffer=this.context.createBuffer(1,length,this.context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i++) data[i]=Math.random()*2-1;
    const source=this.context.createBufferSource(); source.buffer=buffer; source.loop=true; return source;
  }
  createFilter(type:BiquadFilterType='lowpass',frequency=1000,q=.7){
    const node=this.context.createBiquadFilter();node.type=type;node.frequency.value=frequency;node.Q.value=q;return node;
  }
  createEnvelope(attack=.01,decay=.2,sustain=.7,release=.3){
    const gain=this.context.createGain();gain.gain.value=0;
    return {gain, trigger:(time=this.context.currentTime,peak=1)=>{
      const g=gain.gain;g.cancelScheduledValues(time);g.setValueAtTime(0,time);g.linearRampToValueAtTime(peak,time+Math.max(.001,attack));g.linearRampToValueAtTime(peak*sustain,time+Math.max(.001,attack)+Math.max(.001,decay));
    }, release:(time=this.context.currentTime)=>{
      const g=gain.gain;g.cancelScheduledValues(time);g.setValueAtTime(g.value,time);g.linearRampToValueAtTime(0,time+Math.max(.001,release));
    }};
  }
  createDistortion(amount=35,oversample:OverSampleType='4x'){
    const shaper=this.context.createWaveShaper();
    const curve=new Float32Array(44100);
    const k=Math.max(0,amount);
    for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=(1+k)*x/(1+k*Math.abs(x));}
    shaper.curve=curve;shaper.oversample=oversample;return shaper;
  }
  createDelay(time=.25,feedback=.35){
    const input=this.context.createGain(),delay=this.context.createDelay(5),fb=this.context.createGain(),wet=this.context.createGain(),output=this.context.createGain();
    delay.delayTime.value=time;fb.gain.value=Math.max(0,Math.min(.95,feedback));wet.gain.value=.5;
    input.connect(delay).connect(fb).connect(delay);delay.connect(wet).connect(output);input.connect(output);
    return {input,output,delay,feedback:fb,wet};
  }
  async createReverb(seconds=2.4,decay=2.5){
    const convolver=this.context.createConvolver();const length=Math.max(1,Math.floor(this.context.sampleRate*seconds));const impulse=this.context.createBuffer(2,length,this.context.sampleRate);
    for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<length;i++){data[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay);}}
    convolver.buffer=impulse;return convolver;
  }
  createTremolo(rate=5,depth=.5){
    const gain=this.context.createGain(),lfo=this.context.createOscillator(),mod=this.context.createGain();
    lfo.frequency.value=rate;mod.gain.value=depth;gain.gain.value=1-depth;lfo.connect(mod).connect(gain.gain);lfo.start();
    return {gain,lfo,mod};
  }
  createRingMod(carrierHz=40){
    const carrier=this.context.createOscillator(),modGain=this.context.createGain();
    carrier.frequency.value=carrierHz;carrier.connect(modGain);carrier.start();return {carrier,modGain};
  }
  connectChain(source:AudioNode,effects:EffectNode[],destination:AudioNode=this.master){
    let current=source;
    for(const effect of effects){if(!effect.enabled)continue;current.connect(effect.input);current=effect.output;}
    current.connect(destination);
  }
  dispose(){this.context.close();GazeAudioEngine.instance=undefined as unknown as GazeAudioEngine;}
}

export function makeEffect(kind:EffectKind,engine=GazeAudioEngine.get(),settings:EffectSettings={}):EffectNode{
  const c=engine.context;
  let input:AudioNode,output:AudioNode,nodes:AudioNode[]=[];
  switch(kind){
    case 'filter':{const f=c.createBiquadFilter();f.type=(settings.type as BiquadFilterType)||'lowpass';f.frequency.value=Number(settings.frequency??1000);f.Q.value=Number(settings.q??.7);input=output=f;nodes=[f];break;}
    case 'gain':{const g=c.createGain();g.gain.value=Number(settings.gain??1);input=output=g;nodes=[g];break;}
    case 'distortion':{const d=engine.createDistortion(Number(settings.amount??35));input=output=d;nodes=[d];break;}
    case 'delay':{const d=engine.createDelay(5),fb=c.createGain(),wet=c.createGain(),dry=c.createGain(),mix=c.createGain();d.delayTime.value=Number(settings.time??.25);fb.gain.value=Number(settings.feedback??.35);wet.gain.value=Number(settings.mix??.4);dry.gain.value=1-wet.gain.value;input=c.createGain();input.connect(d).connect(fb).connect(d);d.connect(wet).connect(mix);input.connect(dry).connect(mix);output=mix;nodes=[d,fb,wet,dry,mix];break;}
    case 'reverb':{const conv=c.createConvolver();const length=c.sampleRate*2;const impulse=c.createBuffer(2,length,c.sampleRate);for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2.5);}conv.buffer=impulse;input=output=conv;nodes=[conv];break;}
    case 'tremolo':{const g=c.createGain(),lfo=c.createOscillator(),mod=c.createGain();lfo.frequency.value=Number(settings.rate??5);mod.gain.value=Number(settings.depth??.5);g.gain.value=1-mod.gain.value;lfo.connect(mod).connect(g.gain);lfo.start();input=output=g;nodes=[g,lfo,mod];break;}
    case 'ringmod':{const carrier=c.createOscillator(),mod=c.createGain();carrier.frequency.value=Number(settings.frequency??40);carrier.connect(mod.gain);mod.gain.value=0;carrier.start();input=output=mod;nodes=[carrier,mod];break;}
    case 'bitcrusher':{const shaper=c.createWaveShaper();const bits=Math.max(2,Math.min(16,Number(settings.bits??8)));const steps=Math.pow(2,bits);const curve=new Float32Array(65536);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.round(x*steps)/steps;}shaper.curve=curve;input=output=shaper;nodes=[shaper];break;}
  }
  return {id:crypto.randomUUID(),kind,enabled:true,input,output,nodes,settings};
}
