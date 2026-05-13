# Darwin Correspondence — NER Viewer

This demo is simple named entity recognition and its visualisation as a website.

The data are 36 letters downloaded from database of Darwins letters.

- Darwin letters project website: https://www.darwinproject.ac.uk/
- All the letters data: https://github.com/cambridge-collection/darwin-correspondence-data

The demo was developed with help of Claude Code. The conversation log is in `2026-05-13-140522-data-build-a-simple-website-for-named-entinty-r.txt`.

## Repository layout

```
demo/
├── data/
│   ├── DCP-LETT-2200.xml … DCP-LETT-2235.xml   # TEI XML source letters
│   └── ner/
│       └── DCP-LETT-*.json                      # Pre-processed NER annotations
├── index.html          # Single-page viewer
├── app.js              # Loads letters.json + per-letter NER JSON, renders UI
├── styles.css          # Parchment-style theme
├── letters.json        # Metadata index (id, sender, recipient, date)
└── ner_preprocess.py   # Offline preprocessing script (spaCy)
```

## Quickstart

### 1. (Optional) Re-run the NER preprocessing

The `data/ner/` JSON files are already committed, so this step is only needed if you change the source XML or the entity mapping.

```bash
pip install spacy
python -m spacy download en_core_web_sm
python ner_preprocess.py
```

### 2. Serve the frontend

The page loads JSON via `fetch`, so it must be served over HTTP (not opened as a local file).

```bash
python -m http.server 8000
# then open http://localhost:8000
```
