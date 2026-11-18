/**
 * Renders Chuck Sprocket's voice: one audio clip per script line, into public/voice/.
 * Engine: espeak-ng (robotic by nature, fitting for a robot) + ffmpeg radio/robot treatment. Fully offline, no licences
 * to attribute. Needs `espeak-ng` and `ffmpeg` on PATH.   Run: npx vite-node scripts/make-voice.ts
 * Re-run whenever src/data/lines.ts changes (a test fails if clips and lines disagree).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { LINES } from '../src/data/lines';

const OUT = 'public/voice';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// radio-booth treatment: band-limit, a hint of metallic flange and echo, even out the loudness
const FILTER = 'highpass=f=170,lowpass=f=5600,flanger=delay=3:depth=2:speed=0.6:width=60,aecho=0.8:0.5:18:0.22,acompressor=threshold=-20dB:ratio=3,loudnorm=I=-17:TP=-2:LRA=7';

const manifest: Record<string, number> = {};
let total = 0;
for (const [cat, lines] of Object.entries(LINES)) {
  lines.forEach((text, i) => {
    const key = `${cat}_${i}`;
    const wav = execFileSync('espeak-ng', ['-v', 'en-us+m3', '-p', '30', '-s', '158', '-a', '170', '--stdout', text], { maxBuffer: 1 << 26 });
    const file = `${OUT}/${key}.mp3`;
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-af', FILTER, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '36k', file], { input: wav });

    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
    // refuse silent or broken clips: volumedetect prints its report on stderr
    const vd = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const mean = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(vd)?.[1] ?? NaN);
    if (!(dur > 0.8) || !(mean > -38)) throw new Error(`bad clip ${key}: ${dur}s, mean ${mean} dB`);
    manifest[key] = Math.round(dur * 100) / 100;
    total++;
  });
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 0));
console.log(`rendered ${total} clips, ${Object.values(manifest).reduce((a, b) => a + b, 0).toFixed(0)} s of speech`);
