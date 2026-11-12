#!/usr/bin/env python3
"""Génère un devis ou une facture (HTML + PDF) à partir d'un fichier JSON.

    python3 devis_facture.py devis   exemple_devis.json
    python3 devis_facture.py facture exemple_devis.json      # même format

Numérotation automatique et continue (D-2026-001, F-2026-001…) tenue dans
data/registre.json. Rien n'est envoyé : les fichiers sont créés dans data/sortie/
pour relecture. Monnaies : XOF (FCFA, sans décimales), EUR, USD.
"""
from __future__ import annotations

import html
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = DATA / "sortie"
SYM = {"XOF": "FCFA", "EUR": "€", "USD": "$"}


def money(x: float, cur: str) -> str:
    if cur == "XOF":
        return f"{round(x):,}".replace(",", " ") + " FCFA"
    return f"{x:,.2f}".replace(",", " ").replace(".", ",") + f" {SYM.get(cur, cur)}"


def next_number(kind: str) -> str:
    DATA.mkdir(exist_ok=True)
    reg_p = DATA / "registre.json"
    reg = json.loads(reg_p.read_text()) if reg_p.exists() else {}
    year = time.strftime("%Y")
    key = f"{kind}-{year}"
    reg[key] = reg.get(key, 0) + 1
    reg_p.write_text(json.dumps(reg, indent=2))
    return f"{'D' if kind == 'devis' else 'F'}-{year}-{reg[key]:03d}"


def render(kind: str, d: dict, num: str) -> str:
    cur = d.get("devise", "XOF")
    e = lambda s: html.escape(str(s))
    rows, total_ht = "", 0.0
    for l in d["lignes"]:
        t = l["quantite"] * l["prix_unitaire"]
        total_ht += t
        rows += (f"<tr><td>{e(l['designation'])}</td><td class=r>{l['quantite']:g} {e(l.get('unite', ''))}</td>"
                 f"<td class=r>{money(l['prix_unitaire'], cur)}</td><td class=r>{money(t, cur)}</td></tr>")
    remise = total_ht * d.get("remise_pct", 0) / 100
    base = total_ht - remise
    tva = base * d.get("tva_pct", 0) / 100
    ttc = base + tva
    acompte = ttc * d.get("acompte_pct", 0) / 100
    em, cl = d["emetteur"], d["client"]
    lines = lambda p: "<br>".join(e(v) for v in p.values() if v)
    tot = f"<tr><td>Total HT</td><td class=r>{money(total_ht, cur)}</td></tr>"
    if remise:
        tot += f"<tr><td>Remise {d['remise_pct']:g} %</td><td class=r>−{money(remise, cur)}</td></tr>"
    if d.get("tva_pct"):
        tot += f"<tr><td>TVA {d['tva_pct']:g} %</td><td class=r>{money(tva, cur)}</td></tr>"
    else:
        tot += f"<tr><td colspan=2 class=small>{e(d.get('mention_tva', 'TVA non applicable'))}</td></tr>"
    tot += f"<tr class=b><td>Total {'TTC' if d.get('tva_pct') else 'net'}</td><td class=r>{money(ttc, cur)}</td></tr>"
    if acompte and kind == "devis":
        tot += f"<tr><td>Acompte à la commande ({d['acompte_pct']:g} %)</td><td class=r>{money(acompte, cur)}</td></tr>"
    title = "DEVIS" if kind == "devis" else "FACTURE"
    validity = (f"<p>Devis valable {d.get('validite_jours', 30)} jours. Bon pour accord : date et signature du client.</p>"
                if kind == "devis" else f"<p>Échéance : {e(d.get('echeance', 'à réception'))}.</p>")
    return f"""<!doctype html><html lang=fr><meta charset=utf-8><title>{title} {num}</title>
<style>body{{font:12px/1.45 'DejaVu Sans',sans-serif;color:#222;margin:36px}}h1{{font-size:24px;letter-spacing:2px;margin:0}}
.top{{display:flex;justify-content:space-between;margin-bottom:28px}}table{{width:100%;border-collapse:collapse}}
th,td{{padding:7px 6px;border-bottom:1px solid #ddd;text-align:left}}th{{background:#f2efe9}}.r{{text-align:right}}
.tot{{width:45%;margin:16px 0 0 auto}}.b td{{font-weight:bold;border-top:2px solid #222}}.small{{font-size:10px;color:#666}}
.foot{{margin-top:30px;font-size:11px;color:#444}}</style>
<div class=top><div><b>{e(em['nom'])}</b><br>{lines({k: v for k, v in em.items() if k != 'nom'})}</div>
<div style=text-align:right><h1>{title}</h1>N° {num}<br>Date : {time.strftime('%d/%m/%Y')}</div></div>
<p><b>Client :</b><br>{lines(cl)}</p><p><b>Objet :</b> {e(d.get('objet', ''))}</p>
<table><tr><th>Désignation</th><th class=r>Qté</th><th class=r>Prix unitaire</th><th class=r>Montant</th></tr>{rows}</table>
<table class=tot>{tot}</table>
<div class=foot>{validity}<p>{e(d.get('conditions', ''))}</p><p>{e(d.get('paiement', ''))}</p></div></html>"""


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ("devis", "facture"):
        print(__doc__)
        return 1
    kind, src = sys.argv[1], Path(sys.argv[2])
    d = json.loads(src.read_text())
    num = next_number(kind)
    OUT.mkdir(parents=True, exist_ok=True)
    h = OUT / f"{num}.html"
    h.write_text(render(kind, d, num), encoding="utf-8")
    pdf = OUT / f"{num}.pdf"
    chrome = next((c for c in (os.environ.get("CHROME"), shutil.which("chromium"), shutil.which("chromium-browser"),
                               shutil.which("google-chrome"), "/opt/pw-browsers/chromium/chrome-linux64/chrome")
                   if c and Path(c).exists()), None)
    if chrome:
        subprocess.run([chrome, "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", h.as_uri()], capture_output=True, timeout=120)
    if pdf.exists():
        print(f"✔ {pdf}")
    else:
        print(f"PDF non généré (Chromium introuvable). Ouvrez {h} dans un navigateur et imprimez en PDF.")
    print(f"✔ {h}  (brouillon : relisez avant tout envoi)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
