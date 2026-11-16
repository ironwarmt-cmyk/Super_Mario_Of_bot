import json, sys
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

NAVY = RGBColor(0x14, 0x37, 0x5E)
TEAL = RGBColor(0x0F, 0x8B, 0x8D)
PALE = RGBColor(0xE8, 0xF4, 0xF4)
GRAY = RGBColor(0xF3, 0xF5, 0xF8)
TEXT = RGBColor(0x1F, 0x29, 0x37)
MUTED = RGBColor(0x5B, 0x67, 0x78)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "Calibri"

W, H = Emu(12192000), Emu(6858000)


def tb(slide, x, y, w, h, text, size=18, bold=False, color=TEXT, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Emu(0)
    lines = text if isinstance(text, list) else [text]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = FONT
    return box


def rect(slide, x, y, w, h, fill):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def frame(prs, title, kicker, footer, num):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, Emu(80000), TEAL)
    tb(s, Emu(600000), Emu(330000), Emu(10900000), Emu(300000), kicker.upper(), 12, True, TEAL)
    tb(s, Emu(600000), Emu(600000), Emu(10900000), Emu(700000), title, 30, True, NAVY)
    tb(s, Emu(600000), Emu(6400000), Emu(9000000), Emu(250000), footer, 10, False, MUTED)
    tb(s, Emu(10800000), Emu(6400000), Emu(800000), Emu(250000), str(num), 10, True, MUTED, PP_ALIGN.RIGHT)
    return s


def bullets(s, items, x=Emu(600000), y=Emu(1550000), w=Emu(10900000), h=Emu(4600000), size=20):
    box = s.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(10)
        sub = it.startswith("  ")
        r0 = p.add_run()
        r0.text = ("– " if sub else "■  ")
        r0.font.size = Pt(size - 6 if not sub else size - 2)
        r0.font.color.rgb = TEAL
        r0.font.name = FONT
        r = p.add_run()
        r.text = it.strip()
        r.font.size = Pt(size - (3 if sub else 0))
        r.font.color.rgb = TEXT if not sub else MUTED
        r.font.name = FONT
        if sub:
            p.level = 1


def table(s, rows, x=Emu(600000), y=Emu(1550000), w=Emu(10990000), size=14, widths=None):
    nr, nc = len(rows), max(len(r) for r in rows)
    rh = Emu(380000)
    shape = s.shapes.add_table(nr, nc, x, y, w, rh * nr)
    t = shape.table
    if widths:
        tot = sum(widths)
        for i, wv in enumerate(widths):
            t.columns[i].width = Emu(int(w * wv / tot))
    for ri, row in enumerate(rows):
        for ci in range(nc):
            cell = t.cell(ri, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = NAVY if ri == 0 else (GRAY if ri % 2 == 0 else WHITE)
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            r = p.add_run()
            r.text = row[ci] if ci < len(row) else ""
            r.font.size = Pt(size)
            r.font.bold = ri == 0
            r.font.color.rgb = WHITE if ri == 0 else TEXT
            r.font.name = FONT
            cell.margin_left = cell.margin_right = Emu(70000)
            cell.margin_top = cell.margin_bottom = Emu(35000)


def build(spec, out):
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    footer = spec["footer"]
    # title slide
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, H, NAVY)
    rect(s, 0, Emu(4700000), W, Emu(60000), TEAL)
    tb(s, Emu(800000), Emu(1300000), Emu(10500000), Emu(400000), spec["kicker"].upper(), 16, True, RGBColor(0x7F, 0xD1, 0xD2))
    tb(s, Emu(800000), Emu(1800000), Emu(10500000), Emu(1800000), spec["title"], 44, True, WHITE)
    tb(s, Emu(800000), Emu(3600000), Emu(10500000), Emu(800000), spec["subtitle"], 20, False, RGBColor(0xD6, 0xE4, 0xF0))
    tb(s, Emu(800000), Emu(5000000), Emu(10500000), Emu(900000), spec["note"], 12, False, RGBColor(0xB8, 0xC7, 0xD6))
    n = 1
    for sl in spec["slides"]:
        n += 1
        if sl.get("type") == "section":
            s = prs.slides.add_slide(prs.slide_layouts[6])
            rect(s, 0, 0, W, H, PALE)
            rect(s, Emu(600000), Emu(2700000), Emu(120000), Emu(1300000), TEAL)
            tb(s, Emu(900000), Emu(2650000), Emu(10000000), Emu(400000), sl["kicker"].upper(), 16, True, TEAL)
            tb(s, Emu(900000), Emu(3050000), Emu(10000000), Emu(1200000), sl["title"], 38, True, NAVY)
            continue
        s = frame(prs, sl["title"], sl.get("kicker", spec["kicker"]), footer, n)
        if "bullets" in sl:
            if "table" in sl:
                bullets(s, sl["bullets"], h=Emu(1400000), size=18)
                table(s, sl["table"], y=Emu(1550000 + 400000 * len(sl["bullets"]) + 200000), size=sl.get("size", 13), widths=sl.get("widths"))
            else:
                bullets(s, sl["bullets"], size=sl.get("size", 20))
        elif "table" in sl:
            table(s, sl["table"], size=sl.get("size", 14), widths=sl.get("widths"))
        if sl.get("callout"):
            b = rect(s, Emu(600000), Emu(5650000), Emu(10990000), Emu(600000), PALE)
            tb(s, Emu(800000), Emu(5730000), Emu(10600000), Emu(450000), sl["callout"], 15, True, NAVY, anchor=MSO_ANCHOR.MIDDLE)
        if sl.get("notes"):
            s.notes_slide.notes_text_frame.text = sl["notes"]
    prs.save(out)
    print(out, n)


if __name__ == "__main__":
    build(json.load(open(sys.argv[1], encoding="utf-8")), sys.argv[2])
