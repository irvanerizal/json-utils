# JSON Formatter

Tool format/minify/validate/repair JSON online — **100% client-side** (data user tidak pernah dikirim ke server), zero dependency, zero build step. Pilot #2: model bisnis ala jsoneditoronline.org (tool gratis + SEO → ads + subscription murah).

## Fitur

- **Format** — beautify dengan indent 2/4/tab
- **Minify** — hapus whitespace
- **Validate** — error ditampilkan lengkap dengan `baris:kolom`
- **Repair** — otomatis perbaiki JSON rusak: kutip tunggal, koma nyisa, comment `//` `#` `/* */`, key tanpa kutip, literal Python (`True`/`None`)
- **Sort keys** — urutkan key A-Z secara rekursif
- **JSON → TypeScript types** — generate interface dari struktur JSON
- **JSON → CSV** — flatten nested object ke kolom `a.b.c` (dialog + copy)
- **Generate JSON Schema** — draft-07 dari data sample
- **Escape / unescape** — konversi ke/dari JSON string literal
- **Compare** — diff struktural 2 JSON: layout default **2 editor (Before/After)** side-by-side, hasil compare tampil di bawah dengan **highlight kuning** pada bagian yang berbeda (`+` tambah, `-` hapus, `~` ubah, termasuk perubahan tipe data)

Catatan UX: aksi Format/Minify/Repair/Sort/dsb berlaku untuk **field yang sedang aktif** (Before atau After) — klik field-nya dulu sebelum menekan tombol.
- **Stats** — jumlah key/obj/array, kedalaman, ukuran
- Copy, download `data.json`, dark mode

## Run lokal

```bash
cd json-formatter
npm run dev        # http://localhost:5173
npm test           # test core logic via node
```

Tanpa install apa pun — `npm run dev` cuma menjalankan static file server.

## Struktur

```
index.html   # shell + toolbar + dialog hasil
style.css    # tema terang/gelap (CSS variables)
core.js      # pure logic (ter-test via node): format, minify, repair, sort, ts-types, csv, schema, diff
app.js       # wiring DOM
test.js      # unit test core.js
```

## Deploy (Cloudflare Pages, $0)

```bash
npx wrangler pages deploy json-formatter --project-name json-formatter
```

Atau hubungkan repo ke Cloudflare Pages dashboard (build: tidak ada, output: `json-formatter/`).

## Monetisasi (mengikuti pola jsoneditoronline.org)

1. **SEO dulu** — target keyword: "json formatter", "json validator online", "json repair", "minify json" (traffic besar, kompetisi ketat — perlu variasi niche)
2. **Ads** — setelah traffic, pasang jaringan iklan (Playwire/AdSense)
3. **Subscription $2/bln** — ad-free + fitur pro (riwayat, private share, batch convert)
4. **Upsell** — cross-sell ke product lain (ID Data API)

Catatan jujur: keyword "json formatter" sangat kompetitif. Peluang terbaik: varian niche (misal "JSON formatter + converter CSV/YAML untuk data marketplace ID") atau menang di UX/fitur (repair yang lebih pintar).

## Lisensi

MIT
