#!/usr/bin/env python3
"""Marca onde tocar nas fotos do app (coordenadas em pontos do iPad; foto = 2x) e gera recortes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
B = Path(__file__).parent
V = (229, 30, 45)
def fonte(t):
    try: return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", t)
    except OSError: return ImageFont.load_default()
# foto: [(x, y, w, h) em pontos]
ALVOS = {
  '01-login': [(199, 545, 422, 50), (199, 624, 422, 50), (199, 748, 422, 62)],
  '02-inicio': [(639, 157, 163, 120)],
  '03-frota': [(18, 186, 87, 43), (35, 532, 57, 59)],
  '25-ficha-livre': [(246, 962, 61, 59), (499, 602, 277, 48), (499, 661, 277, 55)],
  '26-chassi-app-salvar': [(17, 425, 190, 22)],
  '05-tirar-de-operacao': [(558, 831, 59, 44), (488, 985, 299, 50), (488, 1043, 299, 57)],
  '06-apos-tirar': [(316, 290, 138, 74)],
  '07-aba-oficina': [(358, 186, 70, 43), (314, 632, 61, 61)],
  '03b-botao-os': [(17, 113, 786, 57)],
  '08-ordens-servico': [(33, 617, 239, 42)],
  '09-os-preenchida': [(33, 320, 196, 42), (102, 521, 59, 41), (203, 658, 68, 42), (33, 709, 754, 55)],
  '10-os-criar-confirma': [(416, 621, 138, 48)],
  '11-os-na-lista': [(33, 423, 754, 55)],
  '12-os-em-execucao': [(33, 417, 754, 55)],
  '13-concluir-servico': [(50, 449, 718, 48), (50, 506, 632, 55)],
  '14-concluir-confirma': [(416, 669, 138, 48)],
  '16-kart-oficina': [(488, 731, 299, 57)],
  '17-concluiu-oficina': [(488, 520, 100, 30)],
  '18-abertura-selecao': [(488, 840, 61, 59)],
  '19-checklist-finalizar': [(488, 645, 299, 59)],
  '20-apos-checklist': [(416, 680, 138, 48)],
  '21-aguardando': [(113, 186, 100, 43), (35, 563, 57, 59)],
  '22-aceitar': [(488, 554, 299, 57)],
  '23-aceitar-confirma': [(416, 621, 138, 48)],
  '24-livre': [(218, 186, 66, 43), (17, 290, 140, 129), (246, 992, 61, 59)],
}
src = B / 'fotos'; out = B / 'marcadas'; out.mkdir(exist_ok=True)
# o botão de auto-preencher só existe no modo de desenvolvimento: some da foto do login
lg = Image.open(src / '01-login.png').convert('RGB'); d = ImageDraw.Draw(lg)
cor = lg.getpixel((2 * 210, 2 * 670)); d.rectangle([2 * 195, 2 * 685, 2 * 430, 2 * 735], fill=cor); lg.save(src / '01-login.png')
# botão de OS fica na foto da frota
Image.open(src / '03-frota.png').save(src / '03b-botao-os.png')
for nome, alvos in ALVOS.items():
    img = Image.open(src / f'{nome}.png').convert('RGB'); m = img.copy(); d = ImageDraw.Draw(m)
    for i, (x, y, w, h) in enumerate(alvos, 1):
        x, y, w, h = 2 * x, 2 * y, 2 * w, 2 * h
        d.rounded_rectangle([x - 8, y - 8, x + w + 8, y + h + 8], radius=16, outline=V, width=8)
        if len(alvos) > 1:
            cx, cy, r = x - 8, y - 8, 26
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=V); d.text((cx, cy), str(i), fill='white', font=fonte(32), anchor='mm')
        ctx = 90
        box = (max(0, x - ctx), max(0, y - ctx), min(img.width, x + w + ctx), min(img.height, y + h + ctx))
        z = img.crop(box); zd = ImageDraw.Draw(z)
        zd.rounded_rectangle([x - box[0] - 8, y - box[1] - 8, x - box[0] + w + 8, y - box[1] + h + 8], radius=16, outline=V, width=6)
        z.save(out / f'{nome}-zoom{i}.png')
    m.thumbnail((1100, 1600)); m.save(out / f'{nome}-marcada.png', optimize=True)
    print(nome, len(alvos))
