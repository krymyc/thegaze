# THE GAZE — Audio Architecture

## Product modules
- **Generate**: synthesis and sound design. Sources are instruments, not files.
- **Process**: imported audio, samples and loops. Source-independent effect rack.
- **Voice**: microphone input and voice recordings. Shared processing graph, with explicit monitoring to prevent feedback.

## Shared audio core
All modules use one `GazeAudioEngine` / `AudioContext` per browser session:
- Input/source adapters: oscillator instrument, file player, microphone, buffer playback.
- Processing graph: ordered, bypassable effects.
- Metering: analyser nodes at source, post-processing and master.
- Output: master gain, limiter/safety stage (planned), analyser, destination.
- Session lifecycle: resume only from user gestures; stop sources; release media tracks; revoke object URLs.

## Effect-rack contract
`EffectRack` owns the external routing edges and ordering. Effect implementations own their internal nodes and feedback loops. Rebuilding the chain must never dismantle internal feedback topology. Effects can be added, removed, bypassed and reordered by ID. Disposal stops scheduled source nodes and disconnects their graph.

## Planned effect families
1. **Dynamics / utility** — gain, pan, limiter, gate, compressor.
2. **Filter** — LP/HP/BP/notch, resonant, comb, formant bank.
3. **Drive** — saturation, waveshaper, foldback, bit-depth reduction.
4. **Time** — delay, ping-pong, granular delay, freeze/glitch.
5. **Space** — algorithmic reverb, convolution, stereo width.
6. **Modulation** — tremolo, ring modulation, chorus, phaser, flanger, FM.
7. **Spectral** — FFT analysis, spectral freeze, vocoder (later; requires custom processing).

## Source adapter contract (next implementation stage)
A source exposes `output`, `start()`, `stop()` and optional `dispose()`. Modules should not create their own unrelated AudioContexts or bypass the shared master chain.

## UI architecture
- Shared `EffectRack` UI: card-based modules, enable/bypass, reorder, remove, per-effect controls.
- Shared visualizers: waveform, spectrum analyzer, peak/RMS meter.
- Preset state serialized as versioned JSON (no audio or microphone data).
- Responsive control surfaces; parameter changes should update active nodes when supported.

## Build order
1. Shared engine and effect-rack routing foundation.
2. Source adapters and session lifecycle.
3. Effect parameter schemas and live update functions.
4. Processor rebuilt on shared source/rack.
5. Voice rebuilt on shared graph with raw input meter, processed monitor, recording and playback.
6. Generate instrument expansion (wavetable, FM operator routing, modulation matrix, polyphony).
7. Spectral/granular systems and preset library.

## Current caveats
The existing Generate panel and Voice Lab still contain module-local audio routing. This architecture is introduced incrementally; the first migration must preserve the currently working Voice recording/playback and monitoring behavior. The current effect implementations are prototypes, not production DSP: ring modulation, reverb mix, feedback safety, and effect parameter automation need refinement before being exposed as a full rack.
