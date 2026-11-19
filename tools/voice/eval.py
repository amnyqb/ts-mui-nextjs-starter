#!/usr/bin/env python3
"""Is Chuck understandable? Transcribe every rendered clip with a speech recogniser and compare with the script.

Word error rate (WER) of 0% means the recogniser heard exactly the scripted words. Also reports loudness and speaking rate
per mood so you can see that shouts are louder and excited lines faster. Dev tool: needs `pip install faster-whisper`.

  python3 tools/voice/eval.py --lines lines.json --clips public/voice [--model base.en] [--sample 40]
"""
import argparse
import json
import pathlib
import re
import statistics
import subprocess
from collections import defaultdict

from faster_whisper import WhisperModel


CONTRACTIONS = {
    "i'm": "i am", "i'd": "i would", "i'll": "i will", "we're": "we are", "they're": "they are", "you're": "you are",
    "that's": "that is", "it's": "it is", "what's": "what is", "there's": "there is", "don't": "do not", "can't": "can not",
    "won't": "will not", "let's": "let us", "he's": "he is", "she's": "she is", "who's": "who is", "isn't": "is not",
    "tonight's": "tonight is", "nothing's": "nothing is", "gary's": "gary is", "antenna's": "antenna is", "weather's": "weather is",
    "tank's": "tank is", "victory's": "victory is", "everyone's": "everyone is", "somebody's": "somebody is", "mine's": "mine is",
}
NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
           "10": "ten", "15": "fifteen", "20": "twenty", "40": "forty", "90": "ninety"}


def words(s: str) -> list[str]:
    """Normalise so spelling variants are not counted as mishearing: contractions, digits, case, punctuation."""
    s = s.lower().replace("-", " ").replace("’", "'")
    for k, v in CONTRACTIONS.items():
        s = s.replace(k, v)
    out = re.findall(r"[a-z0-9']+", s)
    return [NUMBERS.get(w, w) for w in out]


def wer(ref: list[str], hyp: list[str]) -> float:
    """Word error rate, capped at 100% per clip (one runaway transcription must not swamp the average)."""
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
    return min(1.0, d[len(hyp)] / max(1, len(ref)))


def load(path: str):
    """Decode with ffmpeg to 16 kHz mono float samples (avoids faster-whisper's PyAV loader, which varies by version)."""
    import numpy as np

    raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def loudness(path: str) -> float:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else float("nan")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", required=True)
    ap.add_argument("--clips", required=True)
    ap.add_argument("--model", default="base.en")
    ap.add_argument("--sample", type=int, default=0, help="evaluate only every Nth-spaced sample of this many clips")
    ap.add_argument("--top", type=int, default=5, help="how many of the hardest clips to list")
    ap.add_argument("--dump", help="write every clip's result to this JSON file")
    a = ap.parse_args()

    lines = json.loads(pathlib.Path(a.lines).read_text())
    if a.sample:
        step = max(1, len(lines) // a.sample)
        lines = lines[::step]
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    manifest = json.loads((pathlib.Path(a.clips) / "manifest.json").read_text())

    by_mood = defaultdict(lambda: {"wer": [], "lufs": [], "wps": []})
    worst = []
    for l in lines:
        f = str(pathlib.Path(a.clips) / f"{l['key']}.mp3")
        # vad_filter stops the recogniser inventing words in the silence after a clip ends
        segs, _ = model.transcribe(load(f), language="en", beam_size=5, temperature=0, vad_filter=True, condition_on_previous_text=False)
        hyp = " ".join(s.text for s in segs)
        ref = words(l["text"])
        e = wer(ref, words(hyp))
        by_mood[l["mood"]]["wer"].append(e)
        by_mood[l["mood"]]["lufs"].append(loudness(f))
        by_mood[l["mood"]]["wps"].append(len(ref) / manifest[l["key"]])
        worst.append((e, l["key"], l["text"], hyp.strip()))

    allw = [e for v in by_mood.values() for e in v["wer"]]
    print(f"{len(allw)} clips, overall word error rate {100 * statistics.mean(allw):.1f}%")
    print(f"{'mood':9} {'clips':>5} {'WER':>6} {'loudness':>10} {'words/sec':>10}")
    for mood, v in sorted(by_mood.items()):
        print(f"{mood:9} {len(v['wer']):5d} {100 * statistics.mean(v['wer']):5.1f}% {statistics.mean(v['lufs']):7.1f} LUFS {statistics.mean(v['wps']):9.2f}")
    print("hardest to understand:")
    for e, k, ref, hyp in sorted(worst, reverse=True)[: a.top]:
        print(f"  {100 * e:3.0f}%  {k}\n       said: {ref}\n       heard: {hyp}")
    if a.dump:
        pathlib.Path(a.dump).write_text(json.dumps([{"key": k, "wer": round(e, 3), "text": ref, "heard": hyp} for e, k, ref, hyp in worst], indent=1))


if __name__ == "__main__":
    main()
