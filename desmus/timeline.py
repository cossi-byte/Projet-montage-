"""Placement de la voix off et grille musicale pour chaque version (60 / 30 / 15 s).

Les versions courtes coupent dans la voix off sans la réécrire : elles ne
gardent que certaines phrases, dans l'ordre.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
META = json.load(open(os.path.join(HERE, "build", "voice", "meta.json")))

BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
FPS = 30
W, H = 1080, 1920

# silence (s) avant chaque segment ; "P" = [pause] du texte = 1 s pile
GAPS = {
    "s02": "P", "s03": 0.50, "s04": 0.30, "s05": 0.40, "s06": 0.45, "s07": 0.40,
    "s08": 0.30, "s09": 0.30, "s10": 0.45, "s11": 0.12, "s12": 0.30, "s13a": 0.40,
    "s13b": 0.06, "s13c": 0.06, "s13d": 0.06, "s14": 0.40, "s15": 0.35, "s16a": 0.25,
    "s16b": 0.14, "s16c": 0.04, "s17": 0.45, "s18a": "P", "s18b": 0.55,
}

VERSIONS = {
    "60": {"ids": [k for k in META], "start": 2.6, "length": 60.0},
    "30": {"ids": ["s01", "s02", "s03", "s05", "s08", "s09", "s13a", "s13b", "s13c", "s13d",
                   "s17", "s18a", "s18b"], "start": 1.6, "length": 30.0,
           "gaps": {"s03": 0.4, "s05": 0.35, "s08": 0.35, "s13a": 0.35, "s17": 0.4}},
    "15": {"ids": ["s01", "s02", "s16a", "s16b", "s16c", "s17", "s18a", "s18b"], "start": 0.5,
           "length": 15.0, "gaps": {"s16a": 0.25, "s17": 0.3}},
}


def build(version):
    v = VERSIONS[version]
    t = v["start"]
    out = []
    prev = None
    for sid in v["ids"]:
        if prev is not None:
            g = v.get("gaps", {}).get(sid, GAPS.get(sid, 0.35))
            t += 1.0 if g == "P" else g
        m = META[sid]
        out.append({"id": sid, "t0": round(t, 3), "t1": round(t + m["dur"], 3), "show": m["show"],
                    "words": [[round(t + a, 3), round(t + b, 3), w] for a, b, w in m["words"]]})
        t += m["dur"]
        prev = sid
    drop = out[-1]["t0"]          # « DESMUS » = drop
    # la grille musicale est calée pour qu'une mesure commence pile sur le drop
    grid0 = drop - BAR * int(drop / BAR)
    return {"version": version, "length": v["length"], "segments": out, "drop": drop,
            "grid0": grid0, "bpm": BPM}


def seg(tl, sid):
    for s in tl["segments"]:
        if s["id"] == sid:
            return s
    return None


def snap(tl, t, sub=2):
    """Ramène un instant sur la croche la plus proche (coupe sur le beat)."""
    step = BEAT / sub
    return tl["grid0"] + round((t - tl["grid0"]) / step) * step


if __name__ == "__main__":
    for v in VERSIONS:
        tl = build(v)
        print(f"== {v}s  drop={tl['drop']:.2f}  fin voix={tl['segments'][-1]['t1']:.2f}")
        for s in tl["segments"]:
            print(f"  {s['t0']:6.2f}-{s['t1']:6.2f}  {s['show']}")
