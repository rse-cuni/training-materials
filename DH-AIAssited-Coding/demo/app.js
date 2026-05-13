const TEI = "http://www.tei-c.org/ns/1.0";
const TAG_FOR = { person: "PER", place: "LOC", date: "DATE", org: "ORG", bibl: "BIBL" };
const LABEL_NAMES = { person: "Person", place: "Place", date: "Date", org: "Organisation", bibl: "Reference" };
const CONTEXT_WORDS = 7;
const STORAGE_KEY = "darwin-ner-custom-v1";

const DEFAULT_COLORS = ["#c2853b", "#6d9f78", "#7d8fc2", "#b86a83", "#9a7fbd", "#d4a14f", "#7fa9a8", "#a05b3f"];

const state = {
  letters: [],
  current: null,
  currentInstances: [],
  customCats: [], // [{ id, name, color, terms: [] }]
};

// ---------------- init / bootstrap ----------------

function bindUi() {
  document.getElementById("filter").addEventListener("input", e =>
    renderList(e.target.value.toLowerCase())
  );
  document.getElementById("show-tags").addEventListener("change", e =>
    document.body.classList.toggle("show-tags", e.target.checked)
  );
  document.getElementById("export-letter").addEventListener("click", exportCurrentLetter);
  document.getElementById("export-all").addEventListener("click", exportAllLetters);
  document.getElementById("add-category").addEventListener("click", addCategoryFlow);
  document.body.classList.add("show-tags");
}

async function init() {
  bindUi();
  loadCustom();
  renderCustomPanel();
  try {
    state.letters = await fetch("letters.json").then(r => r.json());
  } catch (err) {
    console.error("Failed to load letters.json", err);
    return;
  }
  renderList();
  if (state.letters.length) loadLetter(state.letters[0]);
}

// ---------------- custom categories ----------------

function loadCustom() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.customCats = raw ? JSON.parse(raw) : [];
  } catch { state.customCats = []; }
}

function saveCustom() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customCats));
  refreshHighlightStyles();
}

function newId() { return "c" + Math.random().toString(36).slice(2, 9); }

function addCategoryFlow() {
  const name = prompt("Name of the new category (e.g. Animal, Ship, Species):");
  if (!name || !name.trim()) return;
  const color = DEFAULT_COLORS[state.customCats.length % DEFAULT_COLORS.length];
  state.customCats.push({ id: newId(), name: name.trim(), color, terms: [] });
  saveCustom();
  renderCustomPanel();
  reloadCurrent();
}

function deleteCategory(id) {
  if (!confirm("Delete this category?")) return;
  state.customCats = state.customCats.filter(c => c.id !== id);
  saveCustom();
  renderCustomPanel();
  reloadCurrent();
}

function updateCategory(id, patch) {
  const c = state.customCats.find(c => c.id === id);
  if (!c) return;
  Object.assign(c, patch);
  saveCustom();
}

function reloadCurrent() {
  if (state.current) loadLetter(state.current);
}

function renderCustomPanel() {
  const root = document.getElementById("categories");
  root.innerHTML = "";
  if (!state.customCats.length) {
    root.innerHTML = "<p class='placeholder'>No custom categories yet.</p>";
    refreshHighlightStyles();
    return;
  }
  for (const cat of state.customCats) {
    const card = document.createElement("div");
    card.className = "category-card";
    card.dataset.catId = cat.id;
    card.innerHTML = `
      <div class="cat-head">
        <span class="cat-swatch" style="background:${cat.color}"></span>
        <input class="cat-name" type="text" value="${escapeHtml(cat.name)}">
        <input class="cat-color" type="color" value="${cat.color}" title="colour">
        <span class="cat-count">${cat.terms.length} term${cat.terms.length === 1 ? "" : "s"}</span>
        <button class="cat-del ghost" title="delete category">✕</button>
      </div>
      <div class="cat-terms">
        ${cat.terms.map(t => `<span class="term-chip" data-term="${escapeHtml(t)}">${escapeHtml(t)} <button class="term-x" title="remove">×</button></span>`).join("")}
        <span class="term-input-wrap">
          <input class="term-input" type="text" placeholder="type term, comma-separate for many" />
          <button class="term-add" title="add term">+</button>
        </span>
      </div>
    `;
    root.appendChild(card);

    card.querySelector(".cat-name").addEventListener("change", e => {
      updateCategory(cat.id, { name: e.target.value.trim() || cat.name });
      reloadCurrent();
    });
    card.querySelector(".cat-color").addEventListener("input", e => {
      updateCategory(cat.id, { color: e.target.value });
      card.querySelector(".cat-swatch").style.background = e.target.value;
      refreshHighlightStyles();
      reloadCurrent();
    });
    card.querySelector(".cat-del").addEventListener("click", () => deleteCategory(cat.id));

    card.querySelectorAll(".term-x").forEach(btn => {
      btn.addEventListener("click", () => {
        const term = btn.parentElement.dataset.term;
        const c = state.customCats.find(c => c.id === cat.id);
        c.terms = c.terms.filter(t => t !== term);
        saveCustom();
        renderCustomPanel();
        reloadCurrent();
      });
    });

    const input = card.querySelector(".term-input");
    const addBtn = card.querySelector(".term-add");
    const commit = () => {
      const val = input.value.trim();
      if (!val) return;
      const c = state.customCats.find(c => c.id === cat.id);
      for (const piece of val.split(",").map(s => s.trim()).filter(Boolean)) {
        if (!c.terms.includes(piece)) c.terms.push(piece);
      }
      input.value = "";
      saveCustom();
      renderCustomPanel();
      reloadCurrent();
    };
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
    });
    input.addEventListener("blur", () => { if (input.value.trim()) commit(); });
    addBtn.addEventListener("click", commit);
  }
  refreshHighlightStyles();
}

// Inject CSS rules for custom-category colours.
function refreshHighlightStyles() {
  let style = document.getElementById("custom-cat-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "custom-cat-styles";
    document.head.appendChild(style);
  }
  const rules = state.customCats.map(c => {
    const c1 = withAlpha(c.color, 0.5);
    const c2 = withAlpha(c.color, 0.95);
    const sel = `.ent.cat-${c.id}`;
    return `${sel}{background:${c1};border-bottom:1px solid ${c2};color:${darken(c.color, 0.55)};}`;
  }).join("\n");
  style.textContent = rules;
}

function withAlpha(hex, a) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function darken(hex, factor) {
  const { r, g, b } = parseHex(hex);
  return `rgb(${Math.round(r * (1 - factor))},${Math.round(g * (1 - factor))},${Math.round(b * (1 - factor))})`;
}
function parseHex(hex) {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function buildCustomRegex() {
  const items = [];
  for (const cat of state.customCats) {
    for (const t of cat.terms) items.push({ cat, term: t });
  }
  if (!items.length) return null;
  items.sort((a, b) => b.term.length - a.term.length);
  const alt = items.map(it => it.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`\\b(?:${alt})\\b`, "gi");
  // Lookup by lowercased term -> category
  const lookup = new Map();
  for (const it of items) {
    const key = it.term.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, it.cat);
  }
  return { re, lookup };
}

// ---------------- list ----------------

function renderList(filter = "") {
  const ul = document.getElementById("letter-list");
  ul.innerHTML = "";
  for (const name of state.letters) {
    if (filter && !name.toLowerCase().includes(filter)) continue;
    const li = document.createElement("li");
    li.textContent = name.replace(/\.xml$/, "");
    if (name === state.current) li.classList.add("active");
    li.addEventListener("click", () => loadLetter(name));
    ul.appendChild(li);
  }
}

// ---------------- letter loading ----------------

async function loadLetter(name) {
  state.current = name;
  renderList(document.getElementById("filter").value.toLowerCase());

  const stem = name.replace(/\.xml$/, "");
  const [xmlText, nerData] = await Promise.all([
    fetch("data/" + name).then(r => r.text()),
    fetch(`data/ner/${stem}.json`).then(r => r.ok ? r.json() : { paragraphs: [] }),
  ]);
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  document.getElementById("title").textContent =
    doc.querySelector("titleStmt > title")?.textContent.trim() ?? name;

  const corr = doc.getElementsByTagNameNS(TEI, "correspAction");
  const meta = document.getElementById("correspondence");
  meta.innerHTML = "";
  for (const action of corr) {
    const type = action.getAttribute("type");
    const who = action.getElementsByTagNameNS(TEI, "persName")[0]?.textContent;
    const where = action.getElementsByTagNameNS(TEI, "placeName")[0]?.textContent;
    const when = action.getElementsByTagNameNS(TEI, "date")[0]?.textContent;
    const parts = [type === "sent" ? "From" : "To", who, where, when].filter(Boolean);
    const span = document.createElement("span");
    span.textContent = parts.join(" — ");
    meta.appendChild(span);
  }

  const target = document.getElementById("transcription");
  target.innerHTML = "";
  const counts = {};
  const instances = [];

  if (!nerData.paragraphs?.length) {
    target.innerHTML = "<p class='placeholder'>(no annotations available — run ner_preprocess.py)</p>";
    state.currentInstances = [];
    renderSummary(counts);
    renderInstances([]);
    return;
  }

  const customMatcher = buildCustomRegex();

  nerData.paragraphs.forEach((para, paraIdx) => {
    // 1) Convert spaCy segments to spans on full paragraph text.
    const fullText = para.segments.map(s => s.text).join("");
    let charPos = 0;
    const spans = [];
    for (const seg of para.segments) {
      const segLen = seg.text.length;
      if (seg.label) {
        spans.push({
          start: charPos,
          end: charPos + segLen,
          kind: "builtin",
          label: seg.label,
        });
      }
      charPos += segLen;
    }

    // 2) Add custom matches.
    if (customMatcher) {
      customMatcher.re.lastIndex = 0;
      let m;
      while ((m = customMatcher.re.exec(fullText))) {
        const cat = customMatcher.lookup.get(m[0].toLowerCase());
        if (!cat) continue;
        spans.push({
          start: m.index,
          end: m.index + m[0].length,
          kind: "custom",
          category: cat,
        });
      }
    }

    // 3) Resolve overlaps: prefer custom over builtin; within same kind, prefer longer-then-earlier.
    const resolved = resolveSpans(spans);

    // 4) Render paragraph from resolved spans + plain text.
    const p = document.createElement("p");
    let pos = 0;
    for (const s of resolved) {
      if (s.start > pos) p.appendChild(document.createTextNode(fullText.slice(pos, s.start)));
      const txt = fullText.slice(s.start, s.end);
      const span = renderEntitySpan(s, txt);
      p.appendChild(span);
      const labelKey = s.kind === "custom" ? `cat:${s.category.id}` : s.label;
      const labelName = s.kind === "custom" ? s.category.name : LABEL_NAMES[s.label];
      counts[labelKey] = counts[labelKey] || { name: labelName, color: s.kind === "custom" ? s.category.color : null, items: [] };
      counts[labelKey].items.push(txt.trim());
      const { before, after } = extractContext(fullText, s.start, s.end, CONTEXT_WORDS);
      instances.push({
        letter: stem,
        paragraph: paraIdx + 1,
        label: labelName,
        labelKey,
        entity: txt.trim(),
        before,
        after,
      });
      pos = s.end;
    }
    if (pos < fullText.length) p.appendChild(document.createTextNode(fullText.slice(pos)));
    target.appendChild(p);
  });

  state.currentInstances = instances;
  renderSummary(counts);
  renderInstances(instances);
}

function renderEntitySpan(s, text) {
  const span = document.createElement("span");
  if (s.kind === "custom") {
    span.className = `ent cat-${s.category.id}`;
    span.dataset.tag = abbrev(s.category.name);
    span.title = s.category.name;
  } else {
    span.className = "ent " + s.label;
    span.dataset.tag = TAG_FOR[s.label] || s.label.toUpperCase();
  }
  span.textContent = text;
  return span;
}

function abbrev(name) {
  const t = name.trim();
  if (!t) return "?";
  return t.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || t.slice(0, 4).toUpperCase();
}

function resolveSpans(spans) {
  // sort: start asc, then custom-first, then longer-first
  spans = spans.slice().sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.kind !== b.kind) return a.kind === "custom" ? -1 : 1;
    return (b.end - b.start) - (a.end - a.start);
  });
  const out = [];
  let cursor = 0;
  // Pre-pass: where custom and builtin overlap, drop the builtin if custom wins.
  // Simplest is greedy non-overlap with the order above.
  for (const s of spans) {
    if (s.start < cursor) continue;
    if (s.end <= s.start) continue;
    out.push(s);
    cursor = s.end;
  }
  return out;
}

function extractContext(text, start, end, nWords) {
  const before = text.slice(0, start);
  const after  = text.slice(end);
  const beforeWords = before.split(/\s+/).filter(Boolean);
  const afterWords  = after.split(/\s+/).filter(Boolean);
  const ctxBefore = beforeWords.slice(-nWords).join(" ");
  const ctxAfter  = afterWords.slice(0, nWords).join(" ");
  const prefix = beforeWords.length > nWords ? "… " : "";
  const suffix = afterWords.length > nWords ? " …" : "";
  return {
    before: (prefix + ctxBefore).replace(/\s+/g, " ").trim(),
    after:  (ctxAfter + suffix).replace(/\s+/g, " ").trim(),
  };
}

// ---------------- summary + instances ----------------

function renderSummary(counts) {
  const root = document.getElementById("entity-summary");
  root.innerHTML = "";
  const keys = Object.keys(counts);
  if (!keys.length) {
    root.innerHTML = "<p class='placeholder'>No entities found in this letter.</p>";
    return;
  }
  for (const k of keys) {
    const bucket = counts[k];
    const col = document.createElement("div");
    const h = document.createElement("h3");
    h.textContent = `${bucket.name} (${bucket.items.length})`;
    if (bucket.color) {
      const dot = document.createElement("span");
      dot.className = "h-dot";
      dot.style.background = bucket.color;
      h.prepend(dot);
    }
    col.appendChild(h);
    const ul = document.createElement("ul");
    const seen = new Map();
    for (const t of bucket.items) seen.set(t, (seen.get(t) || 0) + 1);
    for (const [text, n] of [...seen.entries()].sort((a, b) => b[1] - a[1])) {
      const li = document.createElement("li");
      li.textContent = n > 1 ? `${text} ×${n}` : text;
      ul.appendChild(li);
    }
    col.appendChild(ul);
    root.appendChild(col);
  }
}

function renderInstances(instances) {
  const root = document.getElementById("instances-table");
  root.innerHTML = "";
  if (!instances.length) {
    root.innerHTML = "<p class='placeholder'>No instances to show.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "instances";
  table.innerHTML = `<thead><tr><th>#</th><th>Type</th><th>Entity</th><th>Context</th><th>¶</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector("tbody");
  instances.forEach((it, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="idx">${i + 1}</td>
      <td>${escapeHtml(it.label)}</td>
      <td class="entity-cell">${escapeHtml(it.entity)}</td>
      <td class="ctx-cell">
        <span class="ctx-before">${escapeHtml(it.before)}</span>
        <strong>${escapeHtml(it.entity)}</strong>
        <span class="ctx-after">${escapeHtml(it.after)}</span>
      </td>
      <td class="para">${it.paragraph}</td>
    `;
    tb.appendChild(tr);
  });
  root.appendChild(table);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------------- CSV export ----------------

const CSV_COLUMNS = ["letter", "paragraph", "label", "entity", "context_before", "context_after", "full_context"];

function instancesToCsv(rows) {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map(it => {
    const full = [it.before, it.entity, it.after].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return [it.letter, it.paragraph, it.label, it.entity, it.before, it.after, full].map(csvEscape).join(",");
  });
  return [header, ...body].join("\n") + "\n";
}
function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function exportCurrentLetter() {
  if (!state.currentInstances.length) { alert("No entities to export for this letter."); return; }
  const stem = state.current.replace(/\.xml$/, "");
  downloadCsv(`${stem}-entities.csv`, instancesToCsv(state.currentInstances));
}
async function exportAllLetters() {
  const btn = document.getElementById("export-all");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Collecting…";
  try {
    const customMatcher = buildCustomRegex();
    const all = [];
    for (const name of state.letters) {
      const stem = name.replace(/\.xml$/, "");
      const resp = await fetch(`data/ner/${stem}.json`);
      if (!resp.ok) continue;
      const data = await resp.json();
      data.paragraphs?.forEach((para, paraIdx) => {
        const fullText = para.segments.map(s => s.text).join("");
        let charPos = 0;
        const spans = [];
        for (const seg of para.segments) {
          const segLen = seg.text.length;
          if (seg.label) spans.push({ start: charPos, end: charPos + segLen, kind: "builtin", label: seg.label });
          charPos += segLen;
        }
        if (customMatcher) {
          customMatcher.re.lastIndex = 0;
          let m;
          while ((m = customMatcher.re.exec(fullText))) {
            const cat = customMatcher.lookup.get(m[0].toLowerCase());
            if (!cat) continue;
            spans.push({ start: m.index, end: m.index + m[0].length, kind: "custom", category: cat });
          }
        }
        for (const s of resolveSpans(spans)) {
          const txt = fullText.slice(s.start, s.end);
          const labelName = s.kind === "custom" ? s.category.name : LABEL_NAMES[s.label];
          const { before, after } = extractContext(fullText, s.start, s.end, CONTEXT_WORDS);
          all.push({ letter: stem, paragraph: paraIdx + 1, label: labelName, entity: txt.trim(), before, after });
        }
      });
    }
    if (!all.length) { alert("No entities found."); return; }
    downloadCsv("darwin-letters-entities.csv", instancesToCsv(all));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

init();
