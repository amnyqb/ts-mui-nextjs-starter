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

writeFileSync(out, `<title>${title}</title>\n<style>${style}</style>\n${markup}\n<script type="module">${js}</script>\n`);
console.log(`wrote ${out} (${(Buffer.byteLength(js) / 1e6).toFixed(2)} MB script, bundle ${jsFile})`);
