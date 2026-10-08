# Piano JS

A dependency-free JavaScript acoustic piano experiment using digital waveguide synthesis. No recorded piano samples or remote assets.

## Run

Serve `dist/` over localhost or HTTPS (AudioWorklet requires a secure context). For example:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 and select **Enable sound**. Use the onscreen keys or A W S E D F T G Y H U J K O L P ;. Space holds sustain; Escape releases all notes. Touch position sets strike strength. The octave buttons shift computer-key mappings. The visible keyboard covers C3–C6; the DSP engine accepts MIDI notes 21–108.

## Architecture

- `dist/piano-core.js`: 40-voice engine, 1–3 strings per note, cubic fractional-delay interpolation, loop-phase tuning, dispersive allpass, frequency-dependent damping, hammer pulse with strike-position cancellation, and pedal-controlled sympathetic resonators.
- `dist/piano-worklet.js`: AudioWorklet wrapper and message interface.
- `dist/app.js`: interaction, soundboard EQ, generated room impulse, output compression, and waveform display.
- `dist/index.html` and `dist/style.css`: responsive instrument interface.

The hammer is an approximate excitation pulse rather than a fully coupled nonlinear felt-contact solver. Soundboard response and sympathetic coupling are perceptual approximations. Parameters are hand-tuned, not fitted to recordings of a specific grand piano. This is an acoustic-style synthesis prototype, not a claim of concert-grand equivalence.

## Processor messages

```js
node.port.postMessage({type: 'on', note: 60, velocity: 0.75});
node.port.postMessage({type: 'off', note: 60});
node.port.postMessage({type: 'pedal', down: true});
node.port.postMessage({type: 'params', tone: 0.5, decay: 1, width: 0.55});
node.port.postMessage({type: 'stop'});
```

Tone and width range from 0 to 1; decay ranges from 0.4 to 1.7. Voice parameters update on subsequent strikes. Audio runs at the actual AudioContext sample rate. Upper notes without dampers decay naturally after key release. All-notes-off damps every active voice.

## Validation

`node check-audio.mjs` renders representative notes from A0 to C8 and a 40-voice stress chord, checks finite output and release, and prints rendering performance. It writes temporary raw float audio under `/tmp` for spectral inspection. This is not a perceptual listening test or a guarantee of performance on every phone.

## Downloaded project

The `dist` directory contains the complete, editable JavaScript, HTML, and CSS
source, not a compiled bundle. No build step or npm dependencies are required.
Keep its files together. Run the server command above from the extracted
`piano-js` directory; opening `index.html` directly with `file://` is not
supported because the demo uses JavaScript modules and AudioWorklet.

Use a browser with Web Audio and AudioWorklet support. Enable sound through the
button before playing. For hosting, upload the contents of `dist/` to an HTTPS
static host. Node.js is needed only for the optional audio-check script.

This archive preserves the current synthesis and demo before the proposed
hammer, coupling, and voicing improvements. Hosting account metadata and Git
history are omitted; neither is needed to run or modify the instrument.

## License

MIT License. Copyright (c) 2026 Craig Johnson. See `LICENSE`.
