#!/usr/bin/env bun
/**
 * Pull public-domain passages from Project Gutenberg into
 * packages/shared/src/passages.generated.ts.
 *
 * Idempotent:
 *   - Raw books (.txt + .rdf) are cached in scripts/.cache/gutenberg/.
 *     A cached book is never downloaded again.
 *   - A book that already has passages in the generated file is skipped.
 *   - A passage whose text already exists in PASSAGES (curated or generated)
 *     is skipped.
 *
 * Public-domain gate (fail closed), read from the book's RDF metadata:
 *   - dcterms:rights must be "Public domain in the USA."
 *   - every author/translator/editor must have a death year <= --max-death-year
 *     (default: current year - 71, i.e. life + 70, the strictest common term).
 *
 * Usage:
 *   bun run scripts/fetch-gutenberg.ts [--books 1342,11] [--per-book 9]
 *                                      [--max-death-year 1955] [--dry-run]
 */
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { PASSAGES, classifyPassageLength } from "../packages/shared/src/passages.ts";
import { GUTENBERG_PASSAGES } from "../packages/shared/src/passages.generated.ts";

const ROOT = join(import.meta.dir, "..");
const CACHE_DIR = join(ROOT, "scripts/.cache/gutenberg");
const OUT_FILE = join(ROOT, "packages/shared/src/passages.generated.ts");
const MIRROR = "https://aleph.pglaf.org/cache/epub";
const USER_AGENT = "typing-race-corpus-builder/1.0 (one-off build script)";
const FETCH_DELAY_MS = 1500;

// Same bounds as passages.test.ts ("every entry has 30-60 words in text").
const MIN_WORDS = 30;
const MAX_WORDS = 60;

/** Prose classics; ebook IDs from gutenberg.org/ebooks/<id>. */
const DEFAULT_BOOKS = [
  1342, // Pride and Prejudice — Austen
  158, // Emma — Austen
  161, // Sense and Sensibility — Austen
  11, // Alice's Adventures in Wonderland — Carroll
  74, // The Adventures of Tom Sawyer — Twain
  84, // Frankenstein — Shelley
  98, // A Tale of Two Cities — Dickens
  1400, // Great Expectations — Dickens
  46, // A Christmas Carol — Dickens
  730, // Oliver Twist — Dickens
  2701, // Moby Dick — Melville
  345, // Dracula — Stoker
  1661, // The Adventures of Sherlock Holmes — Doyle
  174, // The Picture of Dorian Gray — Wilde
  205, // Walden — Thoreau
  1260, // Jane Eyre — C. Bronte
  768, // Wuthering Heights — E. Bronte
  35, // The Time Machine — Wells
  36, // The War of the Worlds — Wells
  120, // Treasure Island — Stevenson
  43, // Dr Jekyll and Mr Hyde — Stevenson
  1184, // The Count of Monte Cristo — Dumas
  2554, // Crime and Punishment — Dostoyevsky (tr. Garnett)
  2600, // War and Peace — Tolstoy (tr. Maude)
  1232, // The Prince — Machiavelli (tr. Marriott)
  132, // The Art of War — Sun Tzu (tr. Giles)
  2680, // Meditations — Marcus Aurelius
  1497, // The Republic — Plato (tr. Jowett)
  289, // The Wind in the Willows — Grahame
  219, // Heart of Darkness — Conrad
  55, // The Wonderful Wizard of Oz — Baum
  16, // Peter Pan — Barrie
  215, // The Call of the Wild — London
  1228, // On the Origin of Species — Darwin
];

type Generated = { id: string; text: string; source: string; ebookId: number };
type Bucket = "short" | "mid" | "long";
type Candidate = { text: string; para: number; start: number; end: number };

// ---------------------------------------------------------------- CLI

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const books = get("--books");
  return {
    books: books ? books.split(",").map((s) => Number(s.trim())) : DEFAULT_BOOKS,
    perBook: Number(get("--per-book") ?? 9),
    maxDeathYear: Number(get("--max-death-year") ?? new Date().getFullYear() - 71),
    dryRun: argv.includes("--dry-run"),
  };
}

// ---------------------------------------------------------------- fetch + cache

let lastFetchAt = 0;
const stats = { downloaded: 0, cached: 0, added: 0, duplicate: 0, skippedBooks: 0 };

/** Return the cached file, or download it once and cache it. */
async function cachedFetch(fileName: string, url: string): Promise<string> {
  const file = Bun.file(join(CACHE_DIR, fileName));
  if (await file.exists()) {
    stats.cached++;
    return file.text();
  }
  const wait = lastFetchAt + FETCH_DELAY_MS - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  lastFetchAt = Date.now();

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.text();
  await Bun.write(file, body);
  stats.downloaded++;
  return body;
}

// ---------------------------------------------------------------- RDF metadata

type Agent = { name: string; deathYear: number | null };
type BookMeta = { title: string; author: string; rights: string; language: string; agents: Agent[] };

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function parseRdf(rdf: string): BookMeta {
  const tag = (name: string) => rdf.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

  // Agents are inline once, then referenced by rdf:resource when repeated.
  const agentsByUri = new Map<string, Agent>();
  for (const m of rdf.matchAll(/<pgterms:agent rdf:about="([^"]+)">([\s\S]*?)<\/pgterms:agent>/g)) {
    const body = m[2]!;
    const name = decodeXml(body.match(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/)?.[1] ?? "");
    const death = body.match(/<pgterms:deathdate[^>]*>(-?\d+)<\/pgterms:deathdate>/)?.[1];
    agentsByUri.set(m[1]!, { name, deathYear: death !== undefined ? Number(death) : null });
  }

  // Every contributor role except illustrators (they add no text).
  const agents: Agent[] = [];
  let author = "";
  const roleRe =
    /<(dcterms:creator|marcrel:\w+)>\s*<pgterms:agent rdf:about="([^"]+)">|<(dcterms:creator|marcrel:\w+) rdf:resource="([^"]+)"\s*\/>/g;
  for (const m of rdf.matchAll(roleRe)) {
    const role = m[1] ?? m[3]!;
    const agent = agentsByUri.get(m[2] ?? m[4]!);
    if (role === "marcrel:ill") continue;
    agents.push(agent ?? { name: "(unknown)", deathYear: null });
    if (role === "dcterms:creator" && !author && agent) author = agent.name;
  }

  const language = rdf.match(/<dcterms:language>[\s\S]*?<rdf:value[^>]*>([^<]+)<\/rdf:value>/)?.[1] ?? "";
  return {
    title: decodeXml(tag("dcterms:title") ?? "")
      .split(/[\r\n;]|\s\$b\s/)[0]!
      .replace(/\s*:$/, "")
      .trim(),
    author,
    rights: (tag("dcterms:rights") ?? "").trim(),
    language: language.trim(),
    agents,
  };
}

/** "Austen, Jane" -> "Jane Austen"; "Tolstoy, Leo, graf" -> "Leo Tolstoy". */
function displayName(pgName: string): string {
  const parts = pgName
    .replace(/\([^)]*\)/g, "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const [last, first] = parts;
  if (!last) return "Unknown";
  if (!first || /\d|active|century|\bof\b/i.test(first)) return last;
  return `${first} ${last}`;
}

function publicDomainProblem(meta: BookMeta, maxDeathYear: number): string | null {
  if (meta.rights !== "Public domain in the USA.") return `rights = "${meta.rights}"`;
  if (meta.language !== "en") return `language = "${meta.language}"`;
  if (meta.agents.length === 0) return "no author in metadata";
  for (const a of meta.agents) {
    if (a.deathYear === null) return `no death year for ${a.name}`;
    if (a.deathYear > maxDeathYear) return `${a.name} died ${a.deathYear} (> ${maxDeathYear})`;
  }
  return null;
}

// ---------------------------------------------------------------- text extraction

const ABBREVIATION = /\b(Mr|Mrs|Ms|Dr|St|Mme|Mlle|Messrs|Esq|Rev|Col|Gen|Capt|Lt|Sgt|Prof|Jr|Sr|No|vs|Mt|Ft|[A-Z])\.$/;

function stripBoilerplate(raw: string): string | null {
  const text = raw.replace(/\r\n?/g, "\n");
  const start = text.match(/^\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m);
  const end = text.match(/^\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m);
  if (!start || !end || end.index! <= start.index!) return null;
  return text.slice(start.index! + start[0].length, end.index);
}

/** Map typographic characters to plain ASCII a keyboard can type. */
function normalize(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s*(?:[—―–]|--+)\s*/g, " - ")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/_/g, "")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  for (const piece of paragraph.split(/(?<=[.!?]["')]*)\s+(?=["'(]*[A-Z])/)) {
    const prev = out[out.length - 1];
    if (prev !== undefined && ABBREVIATION.test(prev)) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  return out;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

function isTypeable(text: string): boolean {
  if (!/^[A-Za-z0-9 .,;:!?'"()-]+$/.test(text)) return false; // plain ASCII only, no [ ] * etc.
  if (!/^["'(]?[A-Z]/.test(text)) return false;
  if (!/[.!?]["')]?$/.test(text)) return false;
  if ((text.match(/"/g)?.length ?? 0) % 2 !== 0) return false;
  if ((text.match(/\(/g)?.length ?? 0) !== (text.match(/\)/g)?.length ?? 0)) return false;
  if (/\b[A-Z]{3,}\b/.test(text)) return false; // headings, SHOUTING, roman numerals
  if (/["(] -|- ["')]/.test(text)) return false; // dash glued to a quote reads badly
  const words = text.split(" ");
  const capitalized = words.filter((w) => /^["'(]?[A-Z]/.test(w)).length;
  return capitalized / words.length <= 0.35; // tables of contents, lists of names
}

/** Every run of whole sentences inside one paragraph that fits 30-60 words. */
function extractCandidates(body: string): Candidate[] {
  const withoutNotes = body.replace(/\[(Illustration|Footnote)[\s\S]*?\]/g, "");
  const paragraphs = withoutNotes.split(/\n\s*\n/).map(normalize).filter(Boolean);
  const out: Candidate[] = [];
  paragraphs.forEach((paragraph, para) => {
    const sentences = splitSentences(paragraph);
    for (let start = 0; start < sentences.length; start++) {
      let words = 0;
      for (let end = start; end < sentences.length; end++) {
        words += wordCount(sentences[end]!);
        if (words > MAX_WORDS) break;
        if (words < MIN_WORDS) continue;
        const text = sentences.slice(start, end + 1).join(" ");
        if (isTypeable(text)) out.push({ text, para, start, end });
      }
    }
  });
  return out;
}

/** Pick `quota` candidates spread evenly through the book, with no overlap. */
function pickSpread(candidates: Candidate[], quota: number, taken: Candidate[]): Candidate[] {
  const picked: Candidate[] = [];
  const overlaps = (a: Candidate, b: Candidate) => a.para === b.para && a.start <= b.end && b.start <= a.end;
  for (let i = 0; i < quota && candidates.length > 0; i++) {
    const from = Math.floor(((i + 0.5) * candidates.length) / quota);
    for (let j = from; j < candidates.length; j++) {
      const c = candidates[j]!;
      if ([...taken, ...picked].some((t) => overlaps(t, c))) continue;
      picked.push(c);
      break;
    }
  }
  return picked;
}

// ---------------------------------------------------------------- ids + dedupe

const dedupeKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Deterministic RFC 4122 v4-shaped UUID, so reruns produce the same IDs. */
function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  h[12] = "4";
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// ---------------------------------------------------------------- output

function renderOutput(entries: Generated[]): string {
  const rows = entries
    .map((e) => `  { id: ${JSON.stringify(e.id)}, text: ${JSON.stringify(e.text)}, source: ${JSON.stringify(e.source)}, ebookId: ${e.ebookId} },`)
    .join("\n");
  return `// AUTO-GENERATED by scripts/fetch-gutenberg.ts — do not edit by hand.
// Public-domain passages extracted from Project Gutenberg texts.

export const GUTENBERG_PASSAGES: ReadonlyArray<{
  id: string;
  text: string;
  source: string;
  ebookId: number;
}> = [${rows ? `\n${rows}\n` : ""}];
`;
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(CACHE_DIR, { recursive: true });

  const generated: Generated[] = [...GUTENBERG_PASSAGES];
  const doneBooks = new Set(generated.map((g) => g.ebookId));
  const seenText = new Set(PASSAGES.map((p) => dedupeKey(p.text)));
  const seenIds = new Set(PASSAGES.map((p) => p.id));
  const perBucket = Math.max(1, Math.round(args.perBook / 3));

  for (const id of args.books) {
    if (doneBooks.has(id)) {
      console.log(`#${id}: already in generated file, skip`);
      continue;
    }
    try {
      const meta = parseRdf(await cachedFetch(`pg${id}.rdf`, `${MIRROR}/${id}/pg${id}.rdf`));
      const problem = publicDomainProblem(meta, args.maxDeathYear);
      if (problem) {
        console.warn(`#${id} ${meta.title}: not used, ${problem}`);
        stats.skippedBooks++;
        continue;
      }

      const body = stripBoilerplate(await cachedFetch(`pg${id}.txt`, `${MIRROR}/${id}/pg${id}.txt`));
      if (!body) {
        console.warn(`#${id} ${meta.title}: no START/END markers, skip`);
        stats.skippedBooks++;
        continue;
      }

      const buckets: Record<Bucket, Candidate[]> = { short: [], mid: [], long: [] };
      for (const c of extractCandidates(body)) {
        if (seenText.has(dedupeKey(c.text))) continue;
        buckets[classifyPassageLength(c.text)].push(c);
      }

      const source = `${displayName(meta.author)} — ${meta.title}`;
      const taken: Candidate[] = [];
      for (const bucket of ["short", "mid", "long"] as const) {
        taken.push(...pickSpread(buckets[bucket], perBucket, taken));
      }
      taken.sort((a, b) => a.para - b.para || a.start - b.start);

      let added = 0;
      for (const c of taken) {
        const key = dedupeKey(c.text);
        const passageId = stableUuid(`${id}:${key}`);
        if (seenText.has(key) || seenIds.has(passageId)) {
          stats.duplicate++;
          continue;
        }
        seenText.add(key);
        seenIds.add(passageId);
        generated.push({ id: passageId, text: c.text, source, ebookId: id });
        added++;
      }
      stats.added += added;
      const sizes = `${buckets.short.length}/${buckets.mid.length}/${buckets.long.length}`;
      console.log(`#${id} ${source}: +${added} (candidates short/mid/long ${sizes})`);
    } catch (e) {
      console.warn(`#${id}: failed, ${(e as Error).message}`);
      stats.skippedBooks++;
    }
  }

  if (stats.added > 0 && !args.dryRun) await Bun.write(OUT_FILE, renderOutput(generated));
  console.log(
    `\ndownloaded ${stats.downloaded}, cached ${stats.cached}, added ${stats.added}, ` +
      `duplicate ${stats.duplicate}, books skipped ${stats.skippedBooks}, total generated ${generated.length}` +
      (args.dryRun ? " (dry run, nothing written)" : ""),
  );
}

await main();
