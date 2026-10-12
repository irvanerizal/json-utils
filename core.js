export function positionToLineCol(text, position) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, col };
}

function parseError(message, text, originalText) {
  const match = /position (\d+)/.exec(message);
  const position = match ? Number(match[1]) : 0;
  const { line, col } = positionToLineCol(text, position);
  return {
    message: message.replace(/ in JSON at position \d+.*$/, "").replace(/ \(\d+:\d+\)$/, ""),
    line,
    col,
    position
  };
}

export function analyze(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: { message: "Input kosong", line: 1, col: 1, position: 0 } };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (err) {
    return { ok: false, error: parseError(String(err.message), trimmed, text) };
  }
}

export function format(text, indent = 2) {
  const result = analyze(text);
  if (!result.ok) return result;
  return { ok: true, text: JSON.stringify(result.value, null, indent) };
}

export function minify(text) {
  const result = analyze(text);
  if (!result.ok) return result;
  return { ok: true, text: JSON.stringify(result.value) };
}

export function cleanText(text) {
  const applied = [];
  let out = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += '"';
      i += 1;
      while (i < text.length) {
        const c = text[i];
        if (c === "\\") {
          const next = text[i + 1];
          out += next === "'" ? "'" : "\\" + next;
          i += 2;
          continue;
        }
        if (c === quote) {
          i += 1;
          break;
        }
        out += c === '"' && quote === "'" ? '\\"' : c;
        i += 1;
      }
      out += '"';
      continue;
    }

    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      if (!applied.includes("comments")) applied.push("comments");
      continue;
    }

    if (ch === "#") {
      while (i < text.length && text[i] !== "\n") i += 1;
      if (!applied.includes("comments")) applied.push("comments");
      continue;
    }

    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      if (!applied.includes("comments")) applied.push("comments");
      continue;
    }

    out += ch;
    i += 1;
  }

  out = out.replace(/,\s*([}\]])/g, (m, close) => {
    if (!applied.includes("trailing-commas")) applied.push("trailing-commas");
    return close;
  });

  out = out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, (m, prefix, key) => {
    if (!applied.includes("unquoted-keys")) applied.push("unquoted-keys");
    return `${prefix}"${key}":`;
  });

  out = out.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
  if (/\b(True|False|None)\b/.test(text) && !applied.includes("python-literals")) {
    applied.push("python-literals");
  }

  return { text: out, applied };
}

export function repair(text) {
  const direct = analyze(text);
  if (direct.ok) return { ok: true, text: JSON.stringify(direct.value, null, 2), applied: [] };

  const { text: cleaned, applied } = cleanText(text);
  const result = analyze(cleaned);
  if (!result.ok) {
    return { ok: false, error: result.error, applied };
  }
  return { ok: true, text: JSON.stringify(result.value, null, 2), applied };
}

export function stats(value) {
  const counts = { keys: 0, arrays: 0, objects: 0, values: 0, depth: 0 };

  function walk(node, depth) {
    if (Array.isArray(node)) {
      counts.depth = Math.max(counts.depth, depth);
      counts.arrays += 1;
      for (const item of node) walk(item, depth + 1);
    } else if (node !== null && typeof node === "object") {
      counts.depth = Math.max(counts.depth, depth);
      counts.objects += 1;
      for (const key of Object.keys(node)) {
        counts.keys += 1;
        walk(node[key], depth + 1);
      }
    } else {
      counts.values += 1;
    }
  }

  walk(value, 1);
  counts.depth = Math.max(counts.depth, 1);
  return counts;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

function safeKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function capitalize(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function singular(name) {
  const base = name.endsWith("s") && !name.endsWith("ss") ? name.slice(0, -1) : name;
  return capitalize(base);
}

export function toTypeScript(value, rootName = "Root") {
  const interfaces = [];
  const usedNames = new Set();

  function uniqueName(name) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    let i = 2;
    while (usedNames.has(`${name}${i}`)) i += 1;
    usedNames.add(`${name}${i}`);
    return `${name}${i}`;
  }

  function tsType(v, name) {
    if (v === null) return "null";
    if (Array.isArray(v)) {
      if (v.length === 0) return "unknown[]";
      const types = [...new Set(v.map((item) => tsType(item, singular(name))))];
      return types.length === 1 ? `${types[0]}[]` : `(${types.join(" | ")})[]`;
    }
    if (typeof v === "object") {
      const typeName = uniqueName(name);
      const body = Object.keys(v)
        .map((key) => `  ${safeKey(key)}: ${tsType(v[key], capitalize(key))};`)
        .join("\n");
      interfaces.push(`interface ${typeName} {\n${body}\n}`);
      return typeName;
    }
    if (typeof v === "number") return "number";
    if (typeof v === "boolean") return "boolean";
    return "string";
  }

  const rootType = tsType(value, rootName);
  if (interfaces.length === 0) {
    return `type ${rootName} = ${rootType};\n`;
  }
  return interfaces.join("\n\n") + "\n";
}

function flattenRow(row, prefix = "", out = {}) {
  if (row !== null && typeof row === "object" && !Array.isArray(row)) {
    for (const key of Object.keys(row)) {
      flattenRow(row[key], prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (Array.isArray(row)) {
    out[prefix] = JSON.stringify(row);
  } else {
    out[prefix] = row;
  }
  return out;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, message: "CSV butuh JSON berupa array of objects" };
  }
  const rows = value.map((item) => flattenRow(item));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return { ok: true, text: lines.join("\n") + "\n" };
}

export function toJsonSchema(value) {
  function schemaFor(v) {
    if (v === null) return { type: "null" };
    if (Array.isArray(v)) {
      if (v.length === 0) return { type: "array", items: {} };
      const itemSchemas = v.map(schemaFor);
      const first = JSON.stringify(itemSchemas[0]);
      const uniform = itemSchemas.every((s) => JSON.stringify(s) === first);
      return { type: "array", items: uniform ? itemSchemas[0] : { anyOf: itemSchemas } };
    }
    if (typeof v === "object") {
      const properties = {};
      for (const key of Object.keys(v)) {
        properties[key] = schemaFor(v[key]);
      }
      return {
        type: "object",
        properties,
        required: Object.keys(v),
        additionalProperties: false
      };
    }
    return { type: typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string" };
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    ...schemaFor(value)
  };
}

export function escapeString(text) {
  return JSON.stringify(text);
}

export function unescapeString(text) {
  const trimmed = text.trim();
  try {
    const value = JSON.parse(trimmed);
    if (typeof value === "string") return { ok: true, text: value };
  } catch {
    return { ok: false, message: "Input bukan string JSON yang valid" };
  }
  return { ok: false, message: "Input bukan string JSON yang valid" };
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => key in b && deepEqual(a[key], b[key]));
  }

  return false;
}

function formatPathKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

export function diffJson(a, b, path = "$", out = []) {
  if (deepEqual(a, b)) return out;

  const ta = typeOf(a);
  const tb = typeOf(b);

  if (ta !== tb) {
    out.push({ path, kind: "type-changed", a, b });
    return out;
  }

  if (ta === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) {
      const childPath = path + formatPathKey(key);
      if (!(key in a)) out.push({ path: childPath, kind: "added", b: b[key] });
      else if (!(key in b)) out.push({ path: childPath, kind: "removed", a: a[key] });
      else diffJson(a[key], b[key], childPath, out);
    }
    return out;
  }

  if (ta === "array") {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= a.length) out.push({ path: childPath, kind: "added", b: b[i] });
      else if (i >= b.length) out.push({ path: childPath, kind: "removed", a: a[i] });
      else diffJson(a[i], b[i], childPath, out);
    }
    return out;
  }

  out.push({ path, kind: "changed", a, b });
  return out;
}

export function renderDiff(entries) {
  if (entries.length === 0) return "JSON identik — tidak ada perbedaan.";

  const lines = entries.map((e) => {
    if (e.kind === "added") return `+ ${e.path}: ${JSON.stringify(e.b)}`;
    if (e.kind === "removed") return `- ${e.path}: ${JSON.stringify(e.a)}`;
    return `~ ${e.path}: ${JSON.stringify(e.a)} → ${JSON.stringify(e.b)}`;
  });

  return `${entries.length} perbedaan:\n\n${lines.join("\n")}`;
}

function serializeLines(value, indent) {
  const lines = [];

  function append(text, path, depth) {
    lines.push({ text: " ".repeat(indent * depth) + text, path });
  }

  function walk(v, keyPrefix, path, depth) {
    if (v !== null && typeof v === "object") {
      const isArray = Array.isArray(v);
      const open = isArray ? "[" : "{";
      const close = isArray ? "]" : "}";
      const entries = isArray ? v.map((item, i) => [String(i), item]) : Object.keys(v).map((k) => [k, v[k]]);

      if (entries.length === 0) {
        append(`${keyPrefix}${open}${close}`, path, depth);
        return;
      }

      append(`${keyPrefix}${open}`, path, depth);
      for (const [key, item] of entries) {
        const childPath = isArray ? `${path}[${key}]` : path + formatPathKey(key);
        const prefix = isArray ? "" : `${JSON.stringify(key)}: `;
        walk(item, prefix, childPath, depth + 1);
      }
      append(close, path, depth);
      return;
    }

    append(`${keyPrefix}${JSON.stringify(v)}`, path, depth);
  }

  walk(value, "", "$", 0);
  return lines;
}

function subtreeSet(entries, side) {
  const set = new Set();
  for (const e of entries) {
    if (e.kind === "changed" || e.kind === "type-changed") set.add(e.path);
    else if (e.kind === "added" && side === "b") set.add(e.path);
    else if (e.kind === "removed" && side === "a") set.add(e.path);
  }
  return set;
}

function isHighlighted(path, set) {
  for (const p of set) {
    if (path === p || path.startsWith(p + ".") || path.startsWith(p + "[")) return true;
  }
  return false;
}

export function diffLines(a, b, entries, indent = 2) {
  const setA = subtreeSet(entries, "a");
  const setB = subtreeSet(entries, "b");

  const decorate = (value, set) =>
    serializeLines(value, indent).map((line) => ({ text: line.text, highlight: isHighlighted(line.path, set) }));

  return { left: decorate(a, setA), right: decorate(b, setB) };
}
