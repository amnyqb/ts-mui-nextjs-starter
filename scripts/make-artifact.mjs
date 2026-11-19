// Packages the production build into ONE self-contained HTML file for publishing as a claude.ai Artifact.
// The artifact skeleton supplies <html>/<head>/<body>, so this writes only <title>, <style>, the markup and the script.
// Usage: npm run build && node scripts/make-artifact.mjs <output.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/make-artifact.mjs <output.html>');

const html = readFileSync('dist/index.html', 'utf8');
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'WW5';
const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1];
const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1];
if (!style || !body) throw new Error('could not parse dist/index.html; run npm run build first');

const markup = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();
const jsFile = readdirSync('dist/assets').find((f) => f.endsWith('.js'));
if (!jsFile) throw new Error('no bundle found in dist/assets');
// keep the inline script from being closed or mis-parsed by the HTML parser
const js = readFileSync(`dist/assets/${jsFile}`, 'utf8').replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');

// Chuck's voice clips travel inside the page as base64 (a single file cannot serve separate audio files)
const voice = {};
for (const f of readdirSync('dist/voice').filter((x) => x.endsWith('.mp3'))) voice[f.replace(/\.mp3$/, '')] = readFileSync(`dist/voice/${f}`).toString('base64');
const voiceJs = `window.__WW5_VOICE=${JSON.stringify(voice)};`;

writeFileSync(out, `<title>${title}</title>\n<style>${style}</style>\n${markup}\n<script>${voiceJs}</script>\n<script type="module">${js}</script>\n`);
console.log(`wrote ${out}: ${(Buffer.byteLength(js) / 1e6).toFixed(2)} MB game + ${Object.keys(voice).length} voice clips (${(Buffer.byteLength(voiceJs) / 1e6).toFixed(2)} MB), bundle ${jsFile}`);
