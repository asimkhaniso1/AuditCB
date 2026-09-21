#!/usr/bin/env python3
"""
PDF print + QA harness for Audit360 client-facing documents.

Prints an HTML file to PDF with headless Chrome, deliberately leaving the
browser's default "Headers and footers" ON (that is what a user's print dialog
does by default), then checks the RESULT rather than the source:

  * page count equals the "Page X of Y" total printed on every page
  * every page carries its own correct "Page N of Y"
  * no blank / near-blank page (the trailing-footer defect)
  * no browser decoration (about:blank, browser timestamp, "1/6" counters, file:// URL)
  * no raw HTML entity survived into text
  * no numeric (ambiguous) or ISO date in the text
  * renders every page to PNG and a contact sheet for visual inspection

Usage:
  python tools/pdf_qa.py <input.html> <out_dir> [--name NAME] [--json report.json]
  python tools/pdf_qa.py --pdf <existing.pdf> <out_dir> [--name NAME]
Exit code 0 = all checks passed, 1 = at least one failed.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz  # PyMuPDF

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
]

ENTITY_RE = re.compile(r"&(?:amp|lt|gt|quot|apos|nbsp|#\d{2,5}|#x[0-9a-f]{2,5});", re.I)
NUMERIC_DATE_RE = re.compile(r"(?<![\d./-])\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})(?![\d/-])")
ISO_DATE_RE = re.compile(r"(?<![\d-])\d{4}-\d{2}-\d{2}(?![\d-])")
ARTIFACTS = {
    "about:blank": re.compile(r"about:blank", re.I),
    "file-url": re.compile(r"file:///", re.I),
    "local-url": re.compile(r"https?://(?:localhost|127\.0\.0\.1)", re.I),
    "browser-timestamp": re.compile(r"(?:^|\n)\s*\d{1,2}/\d{1,2}/\d{2,4},\s+\d{1,2}:\d{2}\s?(?:AM|PM)\s*(?:\n|$)", re.I),
    "browser-page-counter": re.compile(r"(?:^|\n)\s*\d{1,3}/\d{1,3}\s*(?:\n|$)"),
}
PAGE_X_OF_Y = re.compile(r"Page\s+(\d+)\s+of\s+(\d+)")


def find_chrome():
    for c in CHROME_CANDIDATES:
        if os.path.exists(c):
            return c
    raise SystemExit("No Chrome/Edge found for headless printing")


def print_pdf(html_path: Path, pdf_path: Path):
    chrome = find_chrome()
    # NOTE: no --no-pdf-header-footer: keep the browser default so any missing
    # page control shows up as decoration in the output.
    profile = tempfile.mkdtemp(prefix="pdfqa-")
    args = [chrome, "--headless=new", "--disable-gpu", f"--user-data-dir={profile}",
            "--virtual-time-budget=20000", f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()]
    subprocess.run(args, capture_output=True, timeout=180)
    if not pdf_path.exists() or pdf_path.stat().st_size == 0:
        raise SystemExit(f"Chrome produced no PDF for {html_path}")


def page_ink(page) -> int:
    """How much is actually drawn on the page: text characters + drawings + images."""
    return len(page.get_text().strip()) + len(page.get_drawings()) * 5 + len(page.get_images()) * 50


def analyse(pdf_path: Path):
    doc = fitz.open(pdf_path)
    n = doc.page_count
    results = {"pages": n, "checks": [], "per_page": []}
    ok_all = True

    def check(name, ok, detail=""):
        nonlocal ok_all
        ok_all = ok_all and ok
        results["checks"].append({"check": name, "ok": bool(ok), "detail": detail})

    texts = [p.get_text() for p in doc]
    full = "\n".join(texts)

    # Page X of Y: every page must show its own number and the true total.
    wrong = []
    for i, t in enumerate(texts, 1):
        m = PAGE_X_OF_Y.findall(t)
        if not m:
            wrong.append(f"p{i}: no 'Page X of Y'")
        else:
            a, b = int(m[-1][0]), int(m[-1][1])
            if a != i or b != n:
                wrong.append(f"p{i}: says Page {a} of {b}, actual {i} of {n}")
    check("Page X of Y is correct on every page", not wrong, "; ".join(wrong[:6]))

    # Blank / near blank pages. The running header+footer alone is ~120 chars.
    thin = []
    for i, p in enumerate(doc, 1):
        body = PAGE_X_OF_Y.sub("", texts[i - 1])
        if len(re.sub(r"\s+", "", body)) < 260:
            thin.append(f"p{i}: {len(re.sub(chr(92)+'s+', '', body))} chars")
        results["per_page"].append({"page": i, "chars": len(texts[i - 1]), "ink": page_ink(p)})
    check("No blank or near-blank page", not thin, "; ".join(thin))

    art = [k for k, rx in ARTIFACTS.items() if rx.search(full)]
    check("No browser header/footer decoration", not art, ", ".join(art))

    ents = ENTITY_RE.findall(full)
    check("No raw HTML entities", not ents, " ".join(ents[:6]))

    nd = NUMERIC_DATE_RE.findall(full)
    iso = ISO_DATE_RE.findall(full)
    check("No numeric or ISO dates in client-facing text", not (nd or iso), " ".join((nd + iso)[:6]))

    # Clipping: any text block that extends past the page's right edge.
    clipped = []
    for i, p in enumerate(doc, 1):
        w = p.rect.width
        for b in p.get_text("blocks"):
            if b[2] > w - 6:
                clipped.append(f"p{i}: '{b[4][:30].strip()}' x1={b[2]:.0f}/{w:.0f}")
                break
    check("No text clipped at the page edge", not clipped, "; ".join(clipped[:5]))

    # Overlap: two text LINES from different blocks occupying the same space.
    overlaps = []
    for i, p in enumerate(doc, 1):
        lines = []
        for bi, b in enumerate(p.get_text("dict")["blocks"]):
            if b.get("type") != 0:
                continue
            for ln in b["lines"]:
                if "".join(sp["text"] for sp in ln["spans"]).strip():
                    lines.append((bi, fitz.Rect(ln["bbox"])))
        for a in range(len(lines)):
            for c in range(a + 1, len(lines)):
                if lines[a][0] == lines[c][0]:
                    continue
                inter = lines[a][1] & lines[c][1]
                if inter.is_empty:
                    continue
                smaller = min(lines[a][1].get_area(), lines[c][1].get_area())
                if smaller > 0 and inter.get_area() / smaller > 0.25:
                    overlaps.append(f"p{i}")
                    break
            else:
                continue
            break
    check("No overlapping text", not overlaps, ", ".join(overlaps[:8]))

    results["ok"] = ok_all
    return doc, results, texts


def render(doc, out_dir: Path, name: str, zoom: float = 1.6):
    out_dir.mkdir(parents=True, exist_ok=True)
    pngs = []
    for i, p in enumerate(doc, 1):
        f = out_dir / f"{name}_p{i:02d}.png"
        p.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).save(f)
        pngs.append(f)
    # Contact sheet
    cols = 4 if len(pngs) > 6 else 3
    thumb_w = 420
    thumbs = []
    for f in pngs:
        pm = fitz.Pixmap(str(f))
        s = thumb_w / pm.width
        small = fitz.Pixmap(pm, 0) if False else None
        thumbs.append((f, s))
    try:
        from PIL import Image
        imgs = []
        for f, s in thumbs:
            im = Image.open(f).convert("RGB")
            im = im.resize((thumb_w, int(im.height * s)))
            imgs.append(im)
        rows = (len(imgs) + cols - 1) // cols
        th = max(i.height for i in imgs)
        sheet = Image.new("RGB", (cols * (thumb_w + 12) + 12, rows * (th + 12) + 12), "#e2e8f0")
        for idx, im in enumerate(imgs):
            r, c = divmod(idx, cols)
            sheet.paste(im, (12 + c * (thumb_w + 12), 12 + r * (th + 12)))
        sheet_path = out_dir / f"{name}_contact_sheet.png"
        sheet.save(sheet_path)
    except ImportError:
        sheet_path = None
    return pngs, sheet_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("out_dir")
    ap.add_argument("--pdf", action="store_true", help="input is already a PDF")
    ap.add_argument("--name", default=None)
    ap.add_argument("--json", default=None)
    a = ap.parse_args()

    src = Path(a.input)
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    name = a.name or src.stem
    pdf = src if a.pdf else out / f"{name}.pdf"
    if not a.pdf:
        print_pdf(src, pdf)

    doc, results, texts = analyse(pdf)
    (out / f"{name}.txt").write_text("\n\n=====PAGE=====\n".join(texts), encoding="utf-8")
    pngs, sheet = render(doc, out, name)
    results["pdf"] = str(pdf)
    results["pngs"] = [str(p) for p in pngs]
    results["contact_sheet"] = str(sheet) if sheet else None
    if a.json:
        Path(a.json).write_text(json.dumps(results, indent=2), encoding="utf-8")

    print(f"{name}: {results['pages']} page(s)  ->  {'PASS' if results['ok'] else 'FAIL'}")
    for c in results["checks"]:
        print(f"  [{'ok' if c['ok'] else 'XX'}] {c['check']}" + (f"  — {c['detail']}" if c["detail"] else ""))
    sys.exit(0 if results["ok"] else 1)


if __name__ == "__main__":
    main()
