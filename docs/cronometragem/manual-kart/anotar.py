#!/usr/bin/env python3
"""Marca onde clicar nas fotos do teste do programa (passos.json) e gera recortes ampliados.

Uso: python3 anotar.py <pasta-das-fotos> <pasta-saida>
Para cada foto: <nome>-marcada.png (caixas vermelhas numeradas) e <nome>-zoom<N>.png (recorte de cada alvo).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

VERMELHO = (229, 30, 45)


def fonte(t):
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(f, t)
        except OSError:
            pass
    return ImageFont.load_default()


def main(origem: Path, destino: Path):
    destino.mkdir(parents=True, exist_ok=True)
    passos = json.loads((origem / "passos.json").read_text(encoding="utf-8-sig"))
    for p in passos:
        foto = origem / p["foto"]
        if not foto.exists():
            continue
        img = Image.open(foto).convert("RGB")
        nome = foto.stem
        marcada = img.copy()
        d = ImageDraw.Draw(marcada)
        for i, a in enumerate(p.get("alvos") or [], 1):
            x, y, w, h = a["x"], a["y"], a["w"], a["h"]
            m = 4
            d.rounded_rectangle([x - m, y - m, x + w + m, y + h + m], radius=8, outline=VERMELHO, width=4)
            if len(p["alvos"]) > 1:
                r = 13
                cx, cy = x - m, y - m
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=VERMELHO)
                d.text((cx, cy), str(i), fill="white", font=fonte(16), anchor="mm")
            # recorte ampliado do alvo com um pouco de contexto
            ctx = 60
            box = (max(0, x - ctx), max(0, y - ctx), min(img.width, x + w + ctx), min(img.height, y + h + ctx))
            z = img.crop(box)
            zd = ImageDraw.Draw(z)
            zd.rounded_rectangle([x - box[0] - m, y - box[1] - m, x - box[0] + w + m, y - box[1] + h + m], radius=8, outline=VERMELHO, width=3)
            esc = 2 if z.width < 500 else 1
            z = z.resize((z.width * esc, z.height * esc), Image.LANCZOS)
            z.save(destino / f"{nome}-zoom{i}.png")
        marcada.save(destino / f"{nome}-marcada.png")
        print(nome, len(p.get("alvos") or []))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
