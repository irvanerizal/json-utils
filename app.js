import { analyze, format, minify, repair, stats, formatBytes, sortKeys, toTypeScript, toCSV, toJsonSchema, escapeString, unescapeString, diffJson, renderDiff, diffLines } from "./core.js";

const inputA = document.getElementById("input-a");
const inputB = document.getElementById("input-b");
const status = document.getElementById("status");
const statsEl = document.getElementById("stats");
const indentEl = document.getElementById("indent");

let activeInput = inputA;

[inputA, inputB].forEach((el) => {
  el.addEventListener("focus", () => {
    activeInput = el;
    renderStats();
  });
  el.addEventListener("input", () => {
    activeInput = el;
    setStatus("Ready");
    renderStats();
  });
});

function activeLabel() {
  return activeInput === inputA ? "JSON A" : "JSON B";
}

function indentValue() {
  const v = indentEl.value;
  return v === "tab" ? "\t" : Number(v);
}

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind ?? "";
}

function renderStats() {
  const text = activeInput.value;
  if (!text.trim()) {
    statsEl.textContent = `${activeLabel()} is empty`;
    return;
  }
  const result = analyze(text);
  if (!result.ok) {
    statsEl.textContent = `${activeLabel()} · ${formatBytes(new Blob([text]).size)}`;
    return;
  }
  const s = stats(result.value);
  statsEl.textContent =
    `${activeLabel()} · ${formatBytes(new Blob([text]).size)} · ${s.keys} key · ${s.objects} obj · ${s.arrays} array · kedalaman ${s.depth}`;
}

function apply(text, message) {
  activeInput.value = text;
  setStatus(message, "ok");
  renderStats();
}

function failParse(error) {
  setStatus(`${activeLabel()} error baris ${error.line}:${error.col} — ${error.message}`, "err");
}

function parseActive() {
  return analyze(activeInput.value);
}

document.getElementById("btn-format").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  apply(JSON.stringify(result.value, null, indentValue()), `${activeLabel()} formatted`);
});

document.getElementById("btn-minify").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  apply(JSON.stringify(result.value), `${activeLabel()} minified`);
});

document.getElementById("btn-repair").addEventListener("click", () => {
  const result = repair(activeInput.value);
  if (!result.ok) return failParse(result.error);
  const fixed = result.applied.length ? ` (${result.applied.join(", ")})` : "";
  apply(result.text, `${activeLabel()} repaired${fixed}`);
});

document.getElementById("btn-sort").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  apply(JSON.stringify(sortKeys(result.value), null, indentValue()), `${activeLabel()} keys sorted (A-Z, recursive)`);
});

document.getElementById("btn-escape").addEventListener("click", () => {
  if (!activeInput.value.trim()) return setStatus(`${activeLabel()} is empty`, "err");
  apply(escapeString(activeInput.value), `${activeLabel()} escaped (JSON string literal)`);
});

document.getElementById("btn-unescape").addEventListener("click", () => {
  const result = unescapeString(activeInput.value);
  if (!result.ok) return setStatus(`${activeLabel()} — ${result.message}`, "err");
  apply(result.text, `${activeLabel()} unescaped`);
});

document.getElementById("btn-copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(activeInput.value);
  setStatus(`${activeLabel()} copied to clipboard`, "ok");
});

document.getElementById("btn-download").addEventListener("click", () => {
  const blob = new Blob([activeInput.value], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = activeInput === inputA ? "before.json" : "after.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`${activeLabel()} downloaded`, "ok");
});

document.getElementById("btn-clear").addEventListener("click", () => {
  activeInput.value = "";
  setStatus(`${activeLabel()} cleared`);
  renderStats();
});

const dialog = document.getElementById("result-dialog");
const dialogTitle = document.getElementById("dialog-title");
const dialogOutput = document.getElementById("dialog-output");

function showDialog(title, content) {
  dialogTitle.textContent = title;
  dialogOutput.textContent = content;
  dialog.showModal();
}

document.getElementById("btn-dialog-close").addEventListener("click", () => dialog.close());

document.getElementById("btn-dialog-copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(dialogOutput.textContent);
  setStatus("Disalin ke clipboard", "ok");
});

document.getElementById("btn-ts").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  showDialog(`TypeScript types — ${activeLabel()}`, toTypeScript(result.value));
});

document.getElementById("btn-csv").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  const csv = toCSV(result.value);
  if (!csv.ok) return setStatus(`${activeLabel()} — ${csv.message}`, "err");
  showDialog(`CSV — ${activeLabel()}`, csv.text);
});

document.getElementById("btn-schema").addEventListener("click", () => {
  const result = parseActive();
  if (!result.ok) return failParse(result.error);
  showDialog(`JSON Schema — ${activeLabel()}`, JSON.stringify(toJsonSchema(result.value), null, 2));
});

const compareSection = document.getElementById("compare-section");
const compareLeft = document.getElementById("compare-left");
const compareRight = document.getElementById("compare-right");
const compareOutput = document.getElementById("compare-output");

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPanel(lines) {
  return lines
    .map((line) => (line.highlight ? `<mark>${escapeHtml(line.text)}</mark>` : escapeHtml(line.text)))
    .join("\n");
}

document.getElementById("btn-compare").addEventListener("click", () => {
  compareSection.classList.remove("hidden");

  const a = analyze(inputA.value);
  const b = analyze(inputB.value);

  compareLeft.textContent = "";
  compareRight.textContent = "";

  if (!a.ok) {
    compareOutput.textContent = `JSON A is invalid (line ${a.error.line}:${a.error.col}) — ${a.error.message}`;
    return;
  }
  if (!b.ok) {
    compareOutput.textContent = `JSON B is invalid (line ${b.error.line}:${b.error.col}) — ${b.error.message}`;
    return;
  }

  const entries = diffJson(a.value, b.value);
  const sides = diffLines(a.value, b.value, entries);
  compareLeft.innerHTML = renderPanel(sides.left);
  compareRight.innerHTML = renderPanel(sides.right);
  compareOutput.textContent = renderDiff(entries);
  setStatus(`Compare done — ${entries.length} differences`, entries.length ? undefined : "ok");
});

document.getElementById("btn-theme").addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
});

const savedTheme = localStorage.getItem("theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

renderStats();
