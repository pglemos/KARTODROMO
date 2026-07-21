#!/usr/bin/env python3
"""Validação estrutural portátil do projeto estático do Kartódromo de Betim.

Executa apenas com a biblioteca padrão do Python 3. Não substitui a auditoria
renderizada em Chromium/Playwright, mas detecta regressões de arquivos, links,
semântica, formulários e acessibilidade básica antes da publicação.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PAGES = [
    "index.html",
    "pista.html",
    "kart-locacao.html",
    "campeonatos.html",
    "eventos.html",
    "duvidas.html",
    "kac.html",
    "kac-super.html",
    "200-milhas.html",
    "500-milhas.html",
]

LOCAL_REFERENCE_ATTRIBUTES = {"href", "src", "poster"}
FORM_TAGS = {"input", "select", "textarea"}
IGNORED_SCHEMES = {"http", "https", "mailto", "tel", "data", "javascript"}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: Counter[str] = Counter()
        self.ids: list[str] = []
        self.references: list[tuple[str, str, str]] = []
        self.labels_for: set[str] = set()
        self.form_controls: list[dict[str, str]] = []
        self.target_blank: list[dict[str, str]] = []
        self.buttons_without_type: list[str] = []
        self.nav_without_label = 0
        self.images_without_alt: list[str] = []
        self.has_title = False
        self.has_h1 = False
        self.has_main_target = False
        self.has_skip_link = False
        self.has_favicon = False
        self.has_viewport = False
        self.lang = ""
        self._in_title = False
        self._title_text: list[str] = []

    @property
    def title(self) -> str:
        return "".join(self._title_text).strip()

    def handle_starttag(self, tag: str, attrs_raw: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): value or "" for key, value in attrs_raw}
        self.tags[tag] += 1

        if tag == "html":
            self.lang = attrs.get("lang", "")
        if tag == "title":
            self._in_title = True
            self.has_title = True
        if tag == "h1":
            self.has_h1 = True
        if tag == "main" and attrs.get("id") == "conteudo":
            self.has_main_target = True
        if tag == "a" and attrs.get("href") == "#conteudo":
            self.has_skip_link = True
        if tag == "link" and "icon" in attrs.get("rel", "").split():
            self.has_favicon = True
        if tag == "meta" and attrs.get("name", "").lower() == "viewport":
            self.has_viewport = True
        if "id" in attrs and attrs["id"]:
            self.ids.append(attrs["id"])
        if tag == "label" and attrs.get("for"):
            self.labels_for.add(attrs["for"])
        if tag in FORM_TAGS:
            self.form_controls.append({
                "tag": tag,
                "id": attrs.get("id", ""),
                "name": attrs.get("name", ""),
                "type": attrs.get("type", ""),
                "aria-label": attrs.get("aria-label", ""),
                "aria-labelledby": attrs.get("aria-labelledby", ""),
            })
        if tag == "button" and not attrs.get("type"):
            self.buttons_without_type.append(attrs.get("class", "<sem classe>"))
        if tag == "nav" and not (attrs.get("aria-label") or attrs.get("aria-labelledby")):
            self.nav_without_label += 1
        if tag == "img" and "alt" not in attrs:
            self.images_without_alt.append(attrs.get("src", "<sem src>"))
        if tag == "a" and attrs.get("target") == "_blank":
            self.target_blank.append({
                "href": attrs.get("href", ""),
                "rel": attrs.get("rel", ""),
            })

        for attr in LOCAL_REFERENCE_ATTRIBUTES:
            value = attrs.get(attr)
            if value:
                self.references.append((tag, attr, value))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_text.append(data)


def local_path(page: Path, value: str) -> Path | None:
    value = value.strip()
    if not value or value.startswith("#") or value.startswith("//"):
        return None
    parts = urlsplit(value)
    if parts.scheme.lower() in IGNORED_SCHEMES or parts.netloc:
        return None
    raw_path = unquote(parts.path)
    if not raw_path:
        return None
    return (page.parent / raw_path).resolve()


def validate_media_signatures(errors: list[str]) -> None:
    checks = {
        ".png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": lambda b: b.startswith(b"\xff\xd8\xff"),
        ".jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
        ".pdf": lambda b: b.startswith(b"%PDF-"),
        ".mp4": lambda b: b"ftyp" in b[:64],
    }
    for path in sorted((ROOT / "assets").rglob("*")):
        if not path.is_file() or path.suffix.lower() not in checks:
            continue
        head = path.read_bytes()[:64]
        if not checks[path.suffix.lower()](head):
            errors.append(f"Assinatura inválida: {path.relative_to(ROOT)}")


def main() -> int:
    errors: list[str] = []
    page_summaries: list[str] = []
    referenced_files: set[Path] = set()

    if len(PAGES) != 10 or len(set(PAGES)) != 10:
        errors.append("A lista de páginas principais precisa conter exatamente 10 itens únicos.")

    for filename in PAGES:
        page = ROOT / filename
        if not page.is_file():
            errors.append(f"Página ausente: {filename}")
            continue

        text = page.read_text(encoding="utf-8")
        parser = PageParser()
        try:
            parser.feed(text)
            parser.close()
        except Exception as exc:  # pragma: no cover - proteção de diagnóstico
            errors.append(f"HTML não pôde ser analisado em {filename}: {exc}")
            continue

        if parser.lang.lower() not in {"pt-br", "pt"}:
            errors.append(f"{filename}: atributo lang ausente ou incorreto ({parser.lang!r})")
        if not parser.has_viewport:
            errors.append(f"{filename}: meta viewport ausente")
        if not parser.has_title or not parser.title:
            errors.append(f"{filename}: title ausente ou vazio")
        if not parser.has_h1:
            errors.append(f"{filename}: H1 ausente")
        for required in ("header", "main", "footer"):
            if parser.tags[required] != 1:
                errors.append(f"{filename}: esperado exatamente 1 <{required}>, encontrado {parser.tags[required]}")
        if not parser.has_main_target or not parser.has_skip_link:
            errors.append(f"{filename}: ligação de salto para #conteudo incompleta")
        if not parser.has_favicon:
            errors.append(f"{filename}: favicon ausente")
        if parser.nav_without_label:
            errors.append(f"{filename}: {parser.nav_without_label} navegação(ões) sem nome acessível")
        if parser.buttons_without_type:
            errors.append(f"{filename}: botões sem type: {', '.join(parser.buttons_without_type)}")
        if parser.images_without_alt:
            errors.append(f"{filename}: imagens sem alt: {', '.join(parser.images_without_alt)}")

        duplicate_ids = sorted(key for key, count in Counter(parser.ids).items() if count > 1)
        if duplicate_ids:
            errors.append(f"{filename}: IDs duplicados: {', '.join(duplicate_ids)}")

        for item in parser.target_blank:
            rel_tokens = set(item["rel"].split())
            if "noopener" not in rel_tokens:
                errors.append(f"{filename}: target=_blank sem noopener: {item['href']}")

        for control in parser.form_controls:
            cid = control["id"]
            has_accessible_name = bool(
                (cid and cid in parser.labels_for)
                or control["aria-label"]
                or control["aria-labelledby"]
            )
            if not has_accessible_name and control["type"].lower() != "hidden":
                label = control["name"] or cid or control["tag"]
                errors.append(f"{filename}: controle de formulário sem rótulo: {label}")

        local_count = 0
        for tag, attr, value in parser.references:
            target = local_path(page, value)
            if target is None:
                continue
            local_count += 1
            referenced_files.add(target)
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                errors.append(f"{filename}: referência escapa da pasta do projeto: {value}")
                continue
            if not target.is_file():
                errors.append(f"{filename}: arquivo local ausente ({tag}[{attr}]): {value}")

        page_summaries.append(
            f"{filename}: title/H1/estrutura OK, {local_count} referências locais, "
            f"{len(parser.ids)} IDs"
        )

    required_shared = [
        ROOT / "assets/css/site.css",
        ROOT / "assets/js/site.js",
        ROOT / "assets/videos/home-karting.mp4",
        ROOT / "assets/posters/home-karting.jpg",
        ROOT / "assets/brand/kib-logo.png",
    ]
    for path in required_shared:
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"Arquivo compartilhado ausente ou vazio: {path.relative_to(ROOT)}")

    css = (ROOT / "assets/css/site.css").read_text(encoding="utf-8") if (ROOT / "assets/css/site.css").is_file() else ""
    js = (ROOT / "assets/js/site.js").read_text(encoding="utf-8") if (ROOT / "assets/js/site.js").is_file() else ""
    for marker in ("@media", "prefers-reduced-motion", "overflow-x", ":focus-visible"):
        if marker not in css:
            errors.append(f"CSS compartilhado não contém proteção esperada: {marker}")
    for marker in ("IntersectionObserver", "requestAnimationFrame", "aria-expanded", "reportValidity"):
        if marker not in js:
            errors.append(f"JavaScript compartilhado não contém comportamento esperado: {marker}")

    validate_media_signatures(errors)

    print("AUDITORIA ESTRUTURAL — KARTÓDROMO DE BETIM")
    print(f"Raiz: {ROOT}")
    print(f"Páginas principais verificadas: {len(PAGES)}")
    for summary in page_summaries:
        print(f"  ✓ {summary}")

    if errors:
        print(f"\nFALHA: {len(errors)} problema(s) encontrado(s):")
        for error in errors:
            print(f"  ✗ {error}")
        return 1

    print("\nOK: estrutura, links, ativos, semântica e proteções básicas validados sem erros.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
