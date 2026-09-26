# Sound design with Web Audio (no samples, no APIs)

`buildAudio(ac, when, offset)` works on both `AudioContext` (live) and `OfflineAudioContext` (MP4).
`when` = the context time at which playback starts; `offset` = the reel time it starts from (0 for the MP4, the current t when sound is switched on mid-play).
Events before `offset` are skipped; sustained ones (pads, risers) start late but stay in sync.

| Instrument | Recipe | Use |
|---|---|---|
| kick | sine 160→42Hz in 0.13s + 15ms noise click | every beat in energy scenes; `big` = 130→32Hz, 1.4s |
| snare | bandpassed noise 1.9kHz + 220→150Hz sine | beats 2 and 4; 16th roll before the drop |
| hat | noise → highpass 8kHz, 40ms (open 200ms), panned | 8ths; add 16ths in the payoff scene |
| bass | saw + sub square through resonant lowpass 1400→180Hz | offbeat 8ths on the chord root (pumping) |
| pad | detuned saw pairs (±8 cents) → lowpass 1.5kHz on a sidechained bus | chord bed; bus gain dips 0.3→1 on each kick |
| pluck | square → lowpass 4.2k→500Hz, 160ms | 16th arpeggios of chord tones in later scenes |
| riser | noise → bandpass sweeping 300→9000Hz, gain ramps up | 1s before the biggest hit |
| whoosh | noise bandpass sweep up/down, bell-shaped gain | scene transitions, fly-bys |
| impact | big kick + lowpassed noise burst + 70→24Hz sub drop | every major cut |
| bell | inharmonic sines (1, 2, 2.76, 4.07, 5.4, 6.8 × f0), rapid re-strikes | opening/closing bell |
| tick / blip | short sine 2.4kHz / square at random pitches | clocks, glitch stutters, alarms |

## Mix rules

- Music follows picture: groove off during the impact scene (only glitch blips + alarm), back on at recovery.
- Chord progression in a minor key; brighter chords (C, G) for recovery; hold a sus/add9 pad for the logo.
- Chain: master (0.9) → DynamicsCompressor (−16dB, 5:1) → **trim gain 0.5** → destination.
  Chrome's compressor adds make-up gain; without the trim the live version clips.
- Fade `out` gain from ~0.7s before the end to silence so the audio ends with the picture.
- Check with `scripts/loudness.py`: hits on the right timestamps, breakdown clearly quieter, peak ≤ −0.5dBFS.
