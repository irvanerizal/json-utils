import { analyze, format, minify, repair, stats, positionToLineCol, sortKeys, toTypeScript, toCSV, toJsonSchema, escapeString, unescapeString, diffJson, renderDiff, deepEqual, diffLines } from "./core.js";
import assert from "node:assert";

const t1 = format('{"a":1,"b":[1,2]}', 2);
assert.ok(t1.ok);
assert.strictEqual(t1.text, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');

const t2 = minify('{\n "a": 1\n}');
assert.ok(t2.ok);
assert.strictEqual(t2.text, '{"a":1}');

const t3 = analyze('{"a":');
assert.strictEqual(t3.ok, false);
assert.ok(t3.error.line >= 1);

const t4 = positionToLineCol("abc\ndef\nghi", 5);
assert.deepStrictEqual(t4, { line: 2, col: 2 });

const broken = `{
  "nama": 'Budi',
  "hobi": ["coding", "baca",],
  # komentar
  umur: 30,
  aktif: True
}`;
const t5 = repair(broken);
assert.ok(t5.ok, JSON.stringify(t5.error));
assert.ok(t5.applied.includes("trailing-commas"));
assert.ok(t5.applied.includes("unquoted-keys"));
assert.ok(t5.applied.includes("python-literals"));
const parsed = JSON.parse(t5.text);
assert.strictEqual(parsed.nama, "Budi");
assert.strictEqual(parsed.umur, 30);
assert.strictEqual(parsed.aktif, true);

const t6 = stats({ a: { b: { c: [1, 2] } }, d: 3 });
assert.strictEqual(t6.keys, 4);
assert.strictEqual(t6.depth, 4);
assert.strictEqual(t6.values, 3);

const t7 = repair('{"sudah":"valid"}');
assert.ok(t7.ok);
assert.deepStrictEqual(t7.applied, []);

const t8 = analyze("");
assert.strictEqual(t8.ok, false);

const t9 = repair("{tidak bisa diperbaiki");
assert.strictEqual(t9.ok, false);

const sorted = sortKeys({ b: 1, a: { d: 1, c: 2 } });
assert.deepStrictEqual(Object.keys(sorted), ["a", "b"]);
assert.deepStrictEqual(Object.keys(sorted.a), ["c", "d"]);

const ts = toTypeScript({ nama: "Budi", umur: 30, hobi: ["a", "b"], alamat: { kota: "Bandung" } });
assert.ok(ts.includes("interface Root {"));
assert.ok(ts.includes("nama: string;"));
assert.ok(ts.includes("umur: number;"));
assert.ok(ts.includes("hobi: string[];"));
assert.ok(ts.includes("interface Alamat {"));
assert.ok(ts.includes("kota: string;"));

const tsRootArray = toTypeScript([{ id: 1 }]);
assert.ok(tsRootArray.includes("interface RootItem {") || tsRootArray.includes("interface Root {"));

const csv = toCSV([{ a: 1, b: "x" }, { a: 2, b: "y, z" }]);
assert.ok(csv.ok);
assert.strictEqual(csv.text, "a,b\n1,x\n2,\"y, z\"\n");

const csvBad = toCSV({ a: 1 });
assert.strictEqual(csvBad.ok, false);

const schema = toJsonSchema({ nama: "Budi", tags: ["x"] });
assert.strictEqual(schema.type, "object");
assert.strictEqual(schema.properties.nama.type, "string");
assert.strictEqual(schema.properties.tags.type, "array");
assert.deepStrictEqual(schema.required, ["nama", "tags"]);

const esc = escapeString('{"a":"b"}');
assert.strictEqual(esc, '"{\\"a\\":\\"b\\"}"');
const unesc = unescapeString(esc);
assert.ok(unesc.ok);
assert.strictEqual(unesc.text, '{"a":"b"}');
assert.strictEqual(unescapeString("bukan string").ok, false);

assert.ok(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
assert.ok(!deepEqual({ a: 1 }, { a: 2 }));
assert.ok(!deepEqual([1, 2], [1, 2, 3]));
assert.ok(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }));

const identical = diffJson({ a: 1 }, { a: 1 });
assert.strictEqual(identical.length, 0);
assert.ok(renderDiff(identical).includes("identik"));

const orderOnly = diffJson({ a: 1, b: 2 }, { b: 2, a: 1 });
assert.strictEqual(orderOnly.length, 0);

const diff = diffJson(
  { nama: "Budi", umur: 30, hobi: ["a"], alamat: { kota: "Bandung" }, hapus: 1 },
  { nama: "Andi", umur: "tiga puluh", hobi: ["a", "b"], alamat: {}, tambah: true }
);
const kinds = Object.fromEntries(diff.map((d) => [d.path, d.kind]));
assert.strictEqual(kinds["$.nama"], "changed");
assert.strictEqual(kinds["$.umur"], "type-changed");
assert.strictEqual(kinds["$.hobi[1]"], "added");
assert.strictEqual(kinds["$.alamat.kota"], "removed");
assert.strictEqual(kinds["$.hapus"], "removed");
assert.strictEqual(kinds["$.tambah"], "added");

const rendered = renderDiff(diff);
assert.ok(rendered.includes("~ $.nama"));
assert.ok(rendered.includes("+ $.tambah"));
assert.ok(rendered.includes("- $.hapus"));
assert.ok(rendered.includes("perbedaan"));

const arrDiff = diffJson([1, 2], [1, 2, 3]);
assert.strictEqual(arrDiff.length, 1);
assert.strictEqual(arrDiff[0].kind, "added");

const sides = diffLines(
  { nama: "Budi", hapus: 1, nested: { x: 1 } },
  { nama: "Andi", tambah: true, nested: { x: 1 } },
  diffJson({ nama: "Budi", hapus: 1, nested: { x: 1 } }, { nama: "Andi", tambah: true, nested: { x: 1 } })
);

const leftHighlights = sides.left.filter((l) => l.highlight).map((l) => l.text.trim());
const rightHighlights = sides.right.filter((l) => l.highlight).map((l) => l.text.trim());
assert.ok(leftHighlights.some((t) => t.includes('"nama"')));
assert.ok(rightHighlights.some((t) => t.includes('"nama"')));
assert.ok(leftHighlights.some((t) => t.includes('"hapus"')));
assert.ok(!leftHighlights.some((t) => t.includes('"tambah"')));
assert.ok(rightHighlights.some((t) => t.includes('"tambah"')));
assert.ok(!leftHighlights.some((t) => t.includes('"nested"')));
assert.strictEqual(sides.left[0].highlight, false);

const sameSides = diffLines({ a: 1 }, { a: 1 }, []);
assert.ok(sameSides.left.every((l) => !l.highlight));
assert.ok(sameSides.right.every((l) => !l.highlight));

const arrSides = diffLines({ list: [1, 2] }, { list: [1, 2, 3] }, diffJson({ list: [1, 2] }, { list: [1, 2, 3] }));
assert.ok(arrSides.right.some((l) => l.highlight && l.text.includes("3")));
assert.ok(arrSides.left.every((l) => !l.highlight));

console.log("semua test lolos");
