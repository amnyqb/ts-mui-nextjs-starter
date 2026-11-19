/**
 * Renders Chuck Sprocket's voice: one clip per script line into public/voice/ (+ manifest.json), with his mood per line.
 * Engine: Piper neural TTS (tools/voice/render.py). Re-run whenever src/data/lines.ts changes (a test checks they match).
 *
 *   python3 -m venv .venv && .venv/bin/pip install piper-tts      # once; ffmpeg + ffprobe must be on PATH
 *   # a Piper voice: en_US-joe-medium (CC0). Get the .onnx and .onnx.json from huggingface.co/rhasspy/piper-voices
 *   VOICE_MODEL=/path/to/en_US-joe-medium.onnx PYTHON=.venv/bin/python npx vite-node scripts/make-voice.ts
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { LINES, MOOD } from '../src/data/lines';

const model = process.env.VOICE_MODEL;
if (!model) throw new Error('set VOICE_MODEL to a Piper .onnx voice (see the header of this file)');

const lines = Object.entries(LINES).flatMap(([cat, texts]) =>
  texts.map((text, i) => ({ key: `${cat}_${i}`, text, mood: MOOD[cat as keyof typeof MOOD] })),
);
writeFileSync('tools/voice/lines.json', JSON.stringify(lines, null, 1));
execFileSync(process.env.PYTHON ?? 'python3', ['tools/voice/render.py', '--model', model, '--lines', 'tools/voice/lines.json', '--out', 'public/voice'], { stdio: 'inherit' });
