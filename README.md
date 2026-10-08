# Piano JS

A dependency-free JavaScript acoustic piano experiment using digital waveguide synthesis. No recorded piano samples or remote assets.

## Run

Serve `dist/` over localhost or HTTPS (AudioWorklet requires a secure context). For example:

```sh
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 and select **Enable sound**. Use the onscreen keys or A W S E D F T G Y H U J K O L P ;. Space holds sustain; Escape releases all notes. Touch position sets strike strength. The octave buttons shift computer-key mappings. The visible keyboard covers C3–C6; the DSP engine accepts MIDI notes 21–108.

## Architecture

- `dist/piano-core.js`: 40-voice engine, 1–3 strings per note, cubic fractional-delay interpolation, loop-phase tuning, dispersive allpass, frequency-dependent damping, nonlinear felt contact with returning-string feedback, passive unison-string coupling, interpolated register voicing, strike-position cancellation, and pedal-controlled sympathetic resonators.
- `dist/piano-worklet.js`: AudioWorklet wrapper and message interface.
- `dist/app.js`: interaction, soundboard EQ, generated room impulse, output compression, and waveform display.
- `dist/index.html` and `dist/style.css`: responsive instrument interface.

The hammer uses a simplified quadratic felt force law, four implicit contact substeps per audio sample, and hammer rebound. Returning waveguide output provides approximate contact feedback; this is not a spatially exact bidirectional string/hammer model. Soundboard response and sympathetic coupling are perceptual approximations. Parameters are hand-tuned, not fitted to recordings of a specific grand piano. This is an acoustic-style synthesis prototype, not a claim of concert-grand equivalence.

## Definition tuning

The current tuning shortens felt contact, raises the loss-filter brightness,
restores some attack noise, and reduces the bridge's logarithmic common-mode
loss rate to 25% of the first coupled-string release. The nonlinear hammer and
coupled tail remain active. Existing tone and decay controls still apply.

## Acoustic engine improvements

- **Hammer interaction:** a compression-only nonlinear felt spring changes the
  attack with strike velocity. An implicit quadratic solution keeps stiff contact
  numerically controlled without an iterative solve. The hammer separates after
  rebound; contact has a 14 ms safety limit. Force excites each unison string with
  a slightly different strength and a delayed strike-position cancellation.
- **Coupled decay:** each note's two or three strings share a passive bridge
  matrix. Common motion loses energy faster than differential motion, creating
  a faster initial decay and slower beating tail. Both matrix eigenvalues remain
  between zero and one. Single-string bass notes retain their individual decay.
- **Register voicing:** parameters interpolate smoothly between the targets
  below. Velocity and the existing tone/decay controls further shape each strike.
  Loop phase compensation maintains nominal equal-tempered tuning; this update
  does not introduce stretch tuning.

| Target note | String decay target | Common bridge decay target | Base contact scale |
| --- | --- | --- | --- |
| A0 | 17 s | 15.2 s (unused for single string) | 2.0 ms |
| C3 | 12 s | 10.4 s | 1.5 ms |
| C5 | 8 s | 7.2 s | 1.0 ms |
| C8 | 3.5 s | 3.4 s | 0.25 ms |

These are model coefficient targets, not measured audible T60 values. Loss
filters, coupling, and voice retirement shorten the audible decay. Contact scale
is adjusted by tone and limited relative to the string period. Dispersion,
brightness, detuning, strike position, damper loss, and level also vary by register.
The bridge couples unisons within a note; the existing pedal resonators provide
approximate resonance between different notes. Body EQ and room reverb remain
separate from the strings.

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

`node check-audio.mjs` checks all 88 keys for audible output, soft/hard representative strikes at 44.1, 48 and 96 kHz, finite stereo output, velocity dynamics, dampers, sustain, repeated strikes, voice reuse, and 40-voice stress. It prints results and rendering performance. It writes temporary raw float audio under `/tmp` for spectral inspection. This is not a perceptual listening test or a guarantee of performance on every phone.

## Downloaded project

The `dist` directory contains the complete, editable JavaScript, HTML, and CSS
source, not a compiled bundle. No build step or npm dependencies are required.
Keep its files together. Run the server command above from the extracted
`piano-js` directory; opening `index.html` directly with `file://` is not
supported because the demo uses JavaScript modules and AudioWorklet.

Use a browser with Web Audio and AudioWorklet support. Enable sound through the
button before playing. For hosting, upload the contents of `dist/` to an HTTPS
static host. Node.js is needed only for the optional audio-check script.

This archive includes nonlinear hammer interaction, coupled-string decay, and
per-register voicing. Hosting account metadata and Git
history are omitted; neither is needed to run or modify the instrument.

## License

MIT License. Copyright (c) 2026 Craig Johnson. See `LICENSE`.
