import { useEffect, useRef, useState } from 'react';
import { Power, Activity } from 'lucide-react';

type Wave = 'sine'|'triangle'|'square'|'sawtooth';
export default function Workspace(){
 const [wave,setWave]=useState<Wave>('sine');
 const [freq,setFreq]=useState(220);
 const [level,setLevel]=useState(35);
 const [playing,setPlaying]=useState(false);
 const ctxRef=useRef<AudioContext|null>(null);
 const oscRef=useRef<OscillatorNode|null>(null);
 const gainRef=useRef<GainNode|null>(null);
 const stop=()=>{try{oscRef.current?.stop()}catch{};oscRef.current=null;gainRef.current=null;setPlaying(false)};
 const start=async()=>{stop();const ctx=ctxRef.current??(ctxRef.current=new AudioContext());await ctx.resume();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type=wave;osc.frequency.value=freq;gain.gain.value=level/100;osc.connect(gain).connect(ctx.destination);osc.start();oscRef.current=osc;gainRef.current=gain;setPlaying(true)};
 useEffect(()=>{if(oscRef.current&&ctxRef.current)oscRef.current.frequency.setTargetAtTime(freq,ctxRef.current.currentTime,.02)},[freq]);
 useEffect(()=>{if(oscRef.current&&ctxRef.current)oscRef.current.type=wave},[wave]);
 useEffect(()=>{if(gainRef.current&&ctxRef.current)gainRef.current.gain.setTargetAtTime(level/100,ctxRef.current.currentTime,.02)},[level]);
 useEffect(()=>()=>{try{oscRef.current?.stop()}catch{};void ctxRef.current?.close()},[]);
 return <div className="minimal-synth">
  <div className="minimal-head"><div><div className="eyebrow">THE GAZE / SYNTH 001</div><h1>Oscillator</h1><p>Single voice · direct audio output</p></div><button className={playing?'power on':'power'} onClick={playing?stop:start}><Power size={16}/>{playing?'STOP':'PLAY'}</button></div>
  <section className="minimal-card">
   <div className="minimal-display"><Activity size={16}/><span>{playing?'SIGNAL ACTIVE':'READY'}</span><strong>{freq} Hz</strong></div>
   <label>WAVEFORM</label><div className="wave-options">{(['sine','triangle','square','sawtooth'] as Wave[]).map(w=><button key={w} className={wave===w?'selected':''} onClick={()=>setWave(w)}>{w==='sawtooth'?'SAW':w.toUpperCase()}</button>)}</div>
   <div className="slider-row"><div><label>FREQUENCY</label><strong>{freq} <em>Hz</em></strong></div><input type="range" min="20" max="2000" value={freq} onChange={e=>setFreq(+e.target.value)}/></div>
   <div className="slider-row"><div><label>OUTPUT LEVEL</label><strong>{level}%</strong></div><input type="range" min="0" max="100" value={level} onChange={e=>setLevel(+e.target.value)}/></div>
   <div className="minimal-foot">Web Audio oscillator → gain → output</div>
  </section>
 </div>
}