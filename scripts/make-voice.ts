/**
 * Renders the broadcast voices: one clip per script line into public/voice/ (+ manifest.json), with the mood per line.
 * Chuck Sprocket (src/data/lines.ts) and General Grandiose (src/data/general.ts) use two different Piper voices.
 * Engine: Piper neural TTS (tools/voice/render.py). Re-run whenever either script changes (tests check they match).
 *
 *   python3 -m venv .venv && .venv/bin/pip install piper-tts      # once; ffmpeg + ffprobe must be on PATH
 *   # Piper voices (.onnx and .onnx.json) from huggingface.co/rhasspy/piper-voices, both permissively licensed:
 *   #   Chuck:   en_US-joe-medium  (CC0)         General: en_US-norman-medium  (public domain; pitched lower in render.py)
 *   VOICE_MODEL=.../en_US-joe-medium.onnx VOICE_MODEL_GENERAL=.../en_US-norman-medium.onnx \
 *     PYTHON=.venv/bin/python npx vite-node scripts/make-voice.ts
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { GENERAL_LINES } from '../src/data/general';
import { LINES, MOOD, type Cat } from '../src/data/lines';

const model = process.env.VOICE_MODEL;
const modelGeneral = process.env.VOICE_MODEL_GENERAL;
if (!model || !modelGeneral) throw new Error('set VOICE_MODEL and VOICE_MODEL_GENERAL to Piper .onnx voices (see the header of this file)');

const chuck = Object.entries(LINES).flatMap(([cat, texts]) =>
  texts.map((text, i) => ({ key: `${cat}_${i}`, text, mood: MOOD[cat as Cat], speaker: 'chuck' })),
);
const general = Object.entries(GENERAL_LINES).flatMap(([cat, texts]) =>
  (texts ?? []).map((text, i) => ({ key: `g_${cat}_${i}`, text, mood: MOOD[cat as Cat], speaker: 'general' })),
);
writeFileSync('tools/voice/lines.json', JSON.stringify([...chuck, ...general], null, 1));
execFileSync(
  process.env.PYTHON ?? 'python3',
  ['tools/voice/render.py', '--model', model, '--model-general', modelGeneral, '--lines', 'tools/voice/lines.json', '--out', 'public/voice'],
  { stdio: 'inherit' },
);
