"""Pre-process TEI letters with spaCy NER and emit per-letter JSON annotations.

Reads data/*.xml, extracts the <div type="transcription"> paragraphs as plain
text (preserving character offsets back to the source XML so that <ref> markup
for bibliography is retained), runs spaCy NER, then writes
data/ner/<id>.json with this shape:

    {
      "paragraphs": [
        {"segments": [{"text": "...", "label": "PER" | null}, ...]}
      ]
    }

Run:  python3 ner_preprocess.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from xml.etree import ElementTree as ET

import spacy

TEI = "http://www.tei-c.org/ns/1.0"
NS = {"t": TEI}

# Map spaCy labels → our entity classes (matches CSS in styles.css).
LABEL_MAP = {
    "PERSON": "person",
    "NORP":   "person",   # nationalities/religious/political groups → treat as person-ish
    "ORG":    "org",
    "GPE":    "place",
    "LOC":    "place",
    "FAC":    "place",
    "DATE":   "date",
    "TIME":   "date",
    "EVENT":  "org",
    "WORK_OF_ART": "bibl",
}


def text_with_bibl_spans(elem: ET.Element):
    """Walk a <p> element, returning (plain_text, bibl_spans).

    `bibl_spans` is a list of (start, end) character offsets in the returned
    plain text that correspond to <ref target="../bibliographies/…"> content.
    Anchors and other empty markup are skipped; <hi>/<ref>/<persName>/etc.
    contribute only their text content.
    """
    out = []
    bibl = []

    def visit(node, inside_bibl=False):
        # Element's own text (before children)
        if node.text:
            out.append(node.text)
        for child in node:
            local = child.tag.split("}", 1)[-1]
            if local == "anchor":
                # anchors are empty but may carry a tail
                pass
            else:
                child_is_bibl = inside_bibl
                if local == "ref":
                    tgt = child.get("target") or ""
                    if "bibliographies/" in tgt:
                        child_is_bibl = True
                if child_is_bibl and not inside_bibl:
                    start = sum(len(s) for s in out)
                if local != "anchor":
                    visit(child, child_is_bibl)
                if child_is_bibl and not inside_bibl:
                    end = sum(len(s) for s in out)
                    if end > start:
                        bibl.append((start, end))
            if child.tail:
                out.append(child.tail)

    visit(elem)
    return "".join(out), bibl


def paragraphs_for(xml_path: Path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    transcription = None
    for div in root.iter(f"{{{TEI}}}div"):
        if div.get("type") == "transcription":
            transcription = div
            break
    if transcription is None:
        return []
    paras = []
    for p in transcription.findall(f"{{{TEI}}}p"):
        text, bibl = text_with_bibl_spans(p)
        paras.append({"text": text, "bibl": bibl})
    return paras


def merge_spans(spans):
    """Sort by start, drop overlaps (prefer longer-then-earlier)."""
    spans = sorted(spans, key=lambda s: (s["start"], -(s["end"] - s["start"])))
    out = []
    cursor = 0
    for s in spans:
        if s["start"] < cursor:
            continue
        if s["end"] <= s["start"]:
            continue
        out.append(s)
        cursor = s["end"]
    return out


def segmentise(text: str, spans):
    """Slice text into [{text, label?}, …] using non-overlapping spans."""
    segments = []
    pos = 0
    for s in spans:
        if s["start"] > pos:
            segments.append({"text": text[pos:s["start"]], "label": None})
        segments.append({"text": text[s["start"]:s["end"]], "label": s["label"]})
        pos = s["end"]
    if pos < len(text):
        segments.append({"text": text[pos:], "label": None})
    return segments


def main():
    here = Path(__file__).parent
    data_dir = here / "data"
    out_dir = data_dir / "ner"
    out_dir.mkdir(exist_ok=True)

    print("Loading spaCy en_core_web_sm …")
    nlp = spacy.load("en_core_web_sm")

    xml_files = sorted(data_dir.glob("DCP-LETT-*.xml"))
    print(f"Processing {len(xml_files)} letters")

    for path in xml_files:
        paras = paragraphs_for(path)
        out_paragraphs = []
        for para in paras:
            text = para["text"]
            spans = []
            if text.strip():
                doc = nlp(text)
                for ent in doc.ents:
                    cls = LABEL_MAP.get(ent.label_)
                    if not cls:
                        continue
                    spans.append({
                        "start": ent.start_char,
                        "end": ent.end_char,
                        "label": cls,
                    })
            for (s, e) in para["bibl"]:
                spans.append({"start": s, "end": e, "label": "bibl"})

            spans = merge_spans(spans)
            out_paragraphs.append({"segments": segmentise(text, spans)})

        out_path = out_dir / (path.stem + ".json")
        out_path.write_text(json.dumps({"paragraphs": out_paragraphs}, ensure_ascii=False, indent=1))
        print(f"  {path.name} → {out_path.name}  ({sum(1 for p in out_paragraphs for s in p['segments'] if s['label'])} entities)")

    print("Done.")


if __name__ == "__main__":
    main()
