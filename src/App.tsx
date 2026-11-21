import { useEffect, useRef, useState } from 'react';

type Wave = OscillatorType;
export default function App() {
  const [freq, setFreq] = useState(110);
  const [wave, setWave] = useState<Wave>('sawtooth');
  const [attack, setAttack] = useState(0.08);
  const [decay, setDecay] = useState(0.25);
  const [sustain, setSustain] = useState(0.65);
  const [release, setRelease] = useState(0.45);
  const [volume, setVolume] = useState(0.7);
  const [active, setActive] = useState(false);
  const audio = useRef<{ctx: AudioContext; osc: OscillatorNode; amp: GainNode; out: GainNode} | null>(null);

  const start = () => {
    if (audio.current) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const out = ctx.createGain();
    osc.type = wave; osc.frequency.value = freq;
    amp.gain.value = 0;
    out.gain.value = volume;
    osc.connect(amp); amp.connect(out); out.connect(ctx.destination);
    osc.start();
    audio.current = {ctx, osc, amp, out};
    gateOn();
  };
  const gateOn = () => {
    const a = audio.current; if (!a) return;
    const now = a.ctx.currentTime; const g = a.amp.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + attack);
    g.linearRampToValueAtTime(sustain, now + attack + decay);
    setActive(true);
  };
  const gateOff = () => {
    const a = audio.current; if (!a) return;
    const now = a.ctx.currentTime; const g = a.amp.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + release);
    setActive(false);
  };
  const stop = () => {
    if (!audio.current) return;
    const a = audio.current;
    gateOff();
    window.setTimeout(() => { try { a.osc.stop(); a.ctx.close(); } catch {} }, Math.max(80, release * 1000 + 80));
    audio.current = null;
  };
  useEffect(() => { if(audio.current) audio.current.osc.frequency.setTargetAtTime(freq, audio.current.ctx.currentTime, .015); }, [freq]);
  useEffect(() => { if(audio.current) audio.current.osc.type = wave; }, [wave]);
  useEffect(() => { if(audio.current) audio.current.out.gain.setTargetAtTime(volume, audio.current.ctx.currentTime, .02); }, [volume]);
  useEffect(() => () => { try { audio.current?.ctx.close(); } catch {} }, []);

  const knob = (label:string, value:number, min:number, max:number, step:number, setter:(v:number)=>void, display:string, accent=false) => (
    <label className={`control ${accent ? 'accent' : ''}`}>
      <span className="control-name">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>setter(Number(e.target.value))}/>
      <span className="value">{display}</span>
    </label>
  );
  return (
    <main className="shell">
      <header className="topbar"><div className="brand">THE <b>GAZE</b><span className="version"> / 01</span></div><div className="status"><i/> AUDIO ENGINE READY</div></header>
      <section className="intro"><div className="eyebrow">SINGLE VOICE · EXPERIMENT 001</div><h1>OSCILLATOR</h1><p>One source. Shape it. Listen.</p></section>
      <div className="rack">
        <section className="module oscillator">
          <div className="module-head"><span className="module-number">01</span><div><h2>OSCILLATOR</h2><small>MONO SIGNAL GENERATOR</small></div><span className="module-led"/></div>
          <div className="osc-display"><div className="wave-label">{wave.toUpperCase()} · {freq.toFixed(1)} Hz</div><div className="waveform"><svg viewBox="0 0 600 100" preserveAspectRatio="none"><path d={wave==='sawtooth'?'M0 88 L100 12 L100 88 L200 12 L200 88 L300 12 L300 88 L400 12 L400 88 L500 12 L500 88 L600 12':wave==='square'?'M0 80 L0 20 L150 20 L150 80 L300 80 L300 20 L450 20 L450 80 L600 80':wave==='triangle'?'M0 80 L75 20 L150 80 L225 20 L300 80 L375 20 L450 80 L525 20 L600 80':'M0 50 Q75 0 150 50 T300 50 T450 50 T600 50'} /></svg></div></div>
          <div className="osc-controls"><div className="wave-select"><label>WAVEFORM</label><div className="select-buttons">{(['sine','triangle','sawtooth','square'] as Wave[]).map(w=><button className={wave===w?'selected':''} onClick={()=>setWave(w)} key={w}>{w==='sawtooth'?'SAW':w.toUpperCase()}</button>)}</div></div>{knob('TUNE',freq,20,2000,1,setFreq,`${freq.toFixed(0)} Hz`,true)}</div>
          <div className="frequency-note">FREQUENCY RANGE <span>20 Hz — 2 kHz</span></div>
        </section>
        <section className="module envelope">
          <div className="module-head"><span className="module-number">02</span><div><h2>ADSR</h2><small>AMPLITUDE ENVELOPE</small></div><span className="module-led muted"/></div>
          <div className="env-visual"><svg viewBox="0 0 600 160" preserveAspectRatio="none"><path className="env-grid" d="M0 130 H600 M0 80 H600 M0 30 H600 M150 0 V160 M300 0 V160 M450 0 V160"/><path className="env-line" d={`M0 130 L${Math.max(30,attack*220)} 20 L${Math.max(30,attack*220)+decay*160} ${130-sustain*100} L${Math.max(30,attack*220)+decay*160+130} ${130-sustain*100} L600 130`}/></svg></div>
          <div className="env-controls">{knob('ATTACK',attack,0.01,2,.01,setAttack,`${attack.toFixed(2)} s`)}{knob('DECAY',decay,0.01,2,.01,setDecay,`${decay.toFixed(2)} s`)}{knob('SUSTAIN',sustain,0,1,.01,setSustain,`${Math.round(sustain*100)} %`)}{knob('RELEASE',release,0.01,3,.01,setRelease,`${release.toFixed(2)} s`)}</div>
        </section>
        <section className="module output">
          <div className="module-head"><span className="module-number">03</span><div><h2>OUTPUT</h2><small>AMPLITUDE / MONITOR</small></div><span className={`module-led ${active?'lit':''}`}/></div>
          <div className="output-row">{knob('LEVEL',volume,0,1,.01,setVolume,`${Math.round(volume*100)} %`,true)}<div className="meter"><label>OUTPUT</label><div className="meter-bars">{Array.from({length:24},(_,i)=><i key={i} className={active&&i<13?'on':''}/>)}</div><span>{active?'SIGNAL':'SILENT'}</span></div></div>
          <button className={`gate-button ${active?'pressed':''}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId); if(!audio.current) start(); else gateOn();}} onPointerUp={gateOff} onPointerCancel={gateOff} onPointerLeave={e=>{if(active)gateOff();}}>{active?'GATE ON':'GATE'}<small>HOLD TO PLAY</small></button>
        </section>
      </div>
      <footer><span>THE GAZE — MODULAR AUDIO LAB</span><span>PROTOTYPE 01 / OSC → ADSR → OUT</span></footer>
    </main>
  );
}