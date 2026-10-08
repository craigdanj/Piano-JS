# Piano JS changes

## Crisper tuning — 2026-10-08

- Shorten contact scales across registers for a more defined excitation.
- Raise string brightness and its velocity response.
- Reduce common-mode bridge attenuation rate by 75% to preserve the core note.
- Restore half of the attack-noise reduction from the prior update.
- Re-run numerical audio validation and replace the validation report.


## Acoustic engine update — 2026-10-08

- Replace the fixed hammer pulse with compression-only nonlinear felt contact,
  hammer deceleration/rebound, and approximate returning-string feedback.
- Solve quadratic contact implicitly with four substeps and no per-sample allocation.
- Couple unison strings through a passive bridge for a faster attack decay and
  slower differential tail, with small excitation and output asymmetries.
- Interpolate bass, middle, and treble targets for loss, contact, dispersion,
  detuning, strike position, output level, and damping.
- Make release smoothing and sympathetic resonator decay sample-rate aware.
- Expand offline validation to three sample rates, all keys, velocity response,
  stereo stability, sustain, repeated notes, voice reuse, and panic release.

Existing demo controls and processor message names are preserved. The synth
remains sample-free, with 40 voices by default. Numerical checks do not establish
perceptual realism or guarantee real-time performance on every device.
