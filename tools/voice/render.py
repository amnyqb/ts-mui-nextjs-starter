#!/usr/bin/env python3
"""Render Chuck Sprocket's voice clips: Piper neural TTS + a per-mood ffmpeg treatment.

Offline and licence-clean when used with a permissive voice (see README: en_US-joe-medium is CC0).
Needs: pip install piper-tts ; ffmpeg + ffprobe on PATH ; a Piper .onnx voice model (+ its .onnx.json).

  python3 tools/voice/render.py --model en_US-joe-medium.onnx --lines lines.json --out public/voice

lines.json is a list of {"key": "captureMine_0", "text": "...", "mood": "excited"} (written by scripts/make-voice.ts).
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import wave

from piper import PiperVoice, SynthesisConfig

# ls: Piper length_scale (<1 = faster). ns/nw: noise scales (more = livelier, less predictable delivery).
# pitch: rubberband ratio (formants preserved, so it stays the same voice). lufs: loudness target (shouting is louder).
MOODS = {
    "calm":    dict(ls=0.97, ns=0.667, nw=0.8, pitch=1.00, lufs=-19, eq="equalizer=f=3200:t=q:w=1:g=2"),
    "deadpan": dict(ls=1.02, ns=0.55,  nw=0.7, pitch=1.00, lufs=-19, eq="equalizer=f=3200:t=q:w=1:g=2"),
    "excited": dict(ls=0.89, ns=0.85,  nw=0.95, pitch=1.07, lufs=-16, eq="equalizer=f=3400:t=q:w=1:g=2.5"),
    "shout":   dict(ls=0.87, ns=0.95,  nw=1.05, pitch=1.12, lufs=-12, eq="equalizer=f=3000:t=q:w=1:g=3.5"),
    "worried": dict(ls=1.08, ns=0.6,   nw=0.9, pitch=0.96, lufs=-20, eq="equalizer=f=3000:t=q:w=1:g=1"),
}


def measure_lufs(path: str) -> float:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    found = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(found[-1]) if found else -23.0


def treat(src: str, dst: str, m: dict) -> None:
    """Shape the voice for the mood, then set the loudness exactly (two passes) with a limiter so loud shouts never clip."""
    chain = []
    if abs(m["pitch"] - 1.0) > 0.005:
        chain.append(f"rubberband=pitch={m['pitch']}:formant=preserved")
    chain += ["highpass=f=85", m["eq"], "acompressor=threshold=-20dB:ratio=4:attack=5:release=80"]
    shaped = dst + ".shaped.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", ",".join(chain), "-ac", "1", "-ar", "22050", shaped], check=True)
    gain = m["lufs"] - measure_lufs(shaped)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", shaped, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.95:level=disabled",
         "-ac", "1", "-ar", "22050", "-c:a", "libmp3lame", "-b:a", "32k", dst],
        check=True,
    )
    pathlib.Path(shaped).unlink()


def duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--lines", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="render just this key (for quick tests)")
    ap.add_argument("--moods", help="JSON file overriding MOODS settings, e.g. to compare delivery styles")
    a = ap.parse_args()
    if a.moods:
        for name, over in json.loads(pathlib.Path(a.moods).read_text()).items():
            MOODS[name].update(over)

    lines = json.loads(pathlib.Path(a.lines).read_text())
    if a.only:
        lines = [l for l in lines if l["key"] == a.only]
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(a.model)
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for i, l in enumerate(lines):
            m = MOODS[l["mood"]]
            raw = f"{tmp}/{l['key']}.wav"
            with wave.open(raw, "wb") as w:
                voice.synthesize_wav(
                    l["text"], w,
                    syn_config=SynthesisConfig(length_scale=m["ls"], noise_scale=m["ns"], noise_w_scale=m["nw"]),
                )
            dst = str(out / f"{l['key']}.mp3")
            treat(raw, dst, m)
            manifest[l["key"]] = round(duration(dst), 2)
            print(f"[{i + 1}/{len(lines)}] {l['key']} ({l['mood']}) {manifest[l['key']]}s", file=sys.stderr)
    (out / "manifest.json").write_text(json.dumps(manifest))
    print(f"rendered {len(manifest)} clips, {sum(manifest.values()):.0f} s of speech")


if __name__ == "__main__":
    main()
