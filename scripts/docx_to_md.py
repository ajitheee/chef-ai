"""docx -> markdown, verbatim: headings, list levels, tables and equations (OMML) are preserved.

    python scripts/docx_to_md.py in.docx out.md
"""
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
M = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"


def para_text(p):
    """All text in a paragraph in document order: w:t, m:t (equations), tabs, breaks."""
    out = []
    for el in p.iter():
        tag = el.tag
        if tag in (W + "t", M + "t"):
            out.append(el.text or "")
        elif tag == W + "tab":
            out.append("\t")
        elif tag in (W + "br", W + "cr"):
            out.append("\n")
    return "".join(out)


def para_style(p):
    ppr = p.find(W + "pPr")
    if ppr is None:
        return "", None
    st = ppr.find(W + "pStyle")
    style = st.get(W + "val") if st is not None else ""
    num = ppr.find(W + "numPr")
    lvl = None
    if num is not None:
        il = num.find(W + "ilvl")
        lvl = int(il.get(W + "val")) if il is not None else 0
    return style or "", lvl


def is_bold(p):
    """Whole-paragraph bold (some documents use it for pseudo-headings)."""
    runs = p.findall(W + "r")
    if not runs:
        return False
    for r in runs:
        t = r.find(W + "t")
        if t is None or not (t.text or "").strip():
            continue
        rpr = r.find(W + "rPr")
        if rpr is None or rpr.find(W + "b") is None:
            return False
    return True


def heading_level(style):
    m = re.match(r"Heading(\d)", style or "")
    if m:
        return int(m.group(1))
    if style == "Title":
        return 1
    if style == "Subtitle":
        return 2
    return 0


def convert(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")
    lines = []
    for child in body:
        if child.tag == W + "p":
            text = para_text(child).strip()
            style, lvl = para_style(child)
            h = heading_level(style)
            if not text:
                lines.append("")
            elif h:
                lines += ["", "#" * h + " " + text, ""]
            elif lvl is not None:
                lines.append("  " * lvl + "- " + text)
            elif is_bold(child) and len(text) < 90:
                lines += ["", "**" + text + "**"]
            else:
                lines.append(text)
        elif child.tag == W + "tbl":
            rows = []
            for tr in child.iter(W + "tr"):
                cells = []
                for tc in tr.findall(W + "tc"):
                    cell = " ".join(para_text(p).strip() for p in tc.findall(W + "p")).strip()
                    cells.append(cell.replace("|", "\\|").replace("\n", " "))
                rows.append(cells)
            if rows:
                width = max(len(r) for r in rows)
                lines.append("")
                for i, r in enumerate(rows):
                    r = r + [""] * (width - len(r))
                    lines.append("| " + " | ".join(r) + " |")
                    if i == 0:
                        lines.append("|" + "---|" * width)
                lines.append("")
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = sys.argv[1], sys.argv[2]
    md = convert(src)
    with open(dst, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(md)
    heads = [l for l in md.split("\n") if l.startswith("#")]
    print(f"wrote {os.path.relpath(dst)}: {len(md.split())} words, {len(heads)} headings")
