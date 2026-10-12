# JSON Formatter

A fast, privacy-friendly tool to format, minify, validate, repair, and compare JSON — **100% client-side** (your data never leaves the browser), zero dependencies, zero build step.

## Features

- **Format** — beautify with 2/4-space or tab indentation
- **Minify** — strip whitespace
- **Validate** — errors shown with exact `line:column`
- **Repair** — fix broken JSON automatically: single quotes, trailing commas, `//` `#` `/* */` comments, unquoted keys, Python literals (`True`/`None`)
- **Sort keys** — recursively sort object keys A-Z
- **JSON → TypeScript types** — generate interfaces from your JSON
- **JSON → CSV** — flatten nested objects into `a.b.c` columns
- **JSON Schema** — generate draft-07 schema from sample data
- **Escape / unescape** — convert to/from a JSON string literal
- **Compare** — structural diff of two JSON documents in a side-by-side **Before/After** view, with differences highlighted in yellow (`+` added, `-` removed, `~` changed, including type changes)
- **Stats** — key/object/array counts, depth, size
- Copy, download `data.json`, dark mode

Note: actions (Format, Minify, Repair, Sort, etc.) apply to the **active field** — click a field first to target it.

## Run locally

```bash
npm run dev        # http://localhost:5173
npm test           # run core logic tests via node
```

No install needed — `npm run dev` just starts a static file server.

## Structure

```
index.html   # shell + toolbar + result dialog
style.css    # light/dark theme (CSS variables)
core.js      # pure logic, tested via node: format, minify, repair, sort, ts-types, csv, schema, diff
app.js       # DOM wiring
test.js      # unit tests for core.js
```

## Deploy

Static hosting works out of the box — GitHub Pages, GitLab Pages, or Cloudflare Pages:

```bash
npx wrangler pages deploy . --project-name <project-name>
```

## License

MIT
