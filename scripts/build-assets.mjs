// Builds the animated SVGs used by the profile README.
// Fonts are subset through Google Fonts and inlined as base64, because GitHub
// renders README images in isolation (no external requests from inside an SVG).
// Run: node scripts/build-assets.mjs
import { mkdir, writeFile } from "node:fs/promises";

const PAPER = "#E7DCC2";
const INK = "#2A1C12";
const COPPER = "#8A4B27";
const GREEN = "#304936";
const BLUE = "#36566B";

const PHRASES = [
  "desenvolvedor full-stack",
  "direção visual + código",
  "automação com IA",
  "web, mobile e dados",
  "regras antes de prompts",
];
const STAMP_TEXT = "ABERTO A PROJETOS • SALVADOR - BA • ";
const MARQUEE = [
  "REACT", "TYPESCRIPT", "REACT NATIVE", "NODE.JS", "FASTIFY", "POSTGRESQL",
  "SUPABASE", "AWS", "DOCKER", "WEBGL", "THREE.JS", "N8N", "CLAUDE", "GEMINI",
].join("  ✶  ") + "  ✶  ";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fontSubset(family, text) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const src = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!src) throw new Error(`No font URL for ${family}:\n${css}`);
  const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
  return `data:font/woff2;base64,${buf.toString("base64")}`;
}

const uniq = (s) => [...new Set(s)].join("");

// Deterministic jagged edge so rebuilds don't churn the diff.
function tornEdge(width, y, amp, step, seed) {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [];
  for (let x = 0; x <= width; x += step) {
    pts.push(`${x},${(y + (rand() - 0.5) * amp).toFixed(1)}`);
  }
  return pts;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function typingLayer({ x, y, size }) {
  const charW = size * 0.6;
  const typeStep = 0.07; // seconds per typed char
  const eraseStep = 0.035;
  const hold = 1.6;
  const gap = 0.35;

  // Lay out every phrase on one shared timeline.
  let t = 0;
  const spans = PHRASES.map((p) => {
    const start = t;
    const typed = start + p.length * typeStep;
    const held = typed + hold;
    const erased = held + p.length * eraseStep;
    t = erased + gap;
    return { p, start, typed, held, erased };
  });
  const total = t;

  const caretTimes = [0];
  const caretX = [x];
  const layers = spans.map(({ p, start, typed, held, erased }, i) => {
    const times = [0];
    const widths = [0];
    const push = (time, chars) => {
      times.push(time);
      widths.push(chars * charW);
      caretTimes.push(time);
      caretX.push(x + chars * charW);
    };
    push(start, 0);
    for (let c = 1; c <= p.length; c++) push(start + c * typeStep, c);
    push(held, p.length);
    for (let c = p.length - 1; c >= 0; c--) push(held + (p.length - c) * eraseStep, c);
    times.push(total);
    widths.push(0);

    const keyTimes = times.map((v) => (v / total).toFixed(5)).join(";");
    return `
    <clipPath id="type${i}"><rect x="${x}" y="${y - size}" height="${size * 1.4}" width="0">
      <animate attributeName="width" dur="${total.toFixed(2)}s" repeatCount="indefinite"
        calcMode="discrete" keyTimes="${keyTimes}" values="${widths.map((w) => w.toFixed(1)).join(";")}"/>
    </rect></clipPath>
    <text class="mono" x="${x}" y="${y}" font-size="${size}" fill="${COPPER}"
      textLength="${(p.length * charW).toFixed(1)}" lengthAdjust="spacingAndGlyphs"
      clip-path="url(#type${i})">${esc(p)}</text>`;
  });
  caretTimes.push(total);
  caretX.push(x);

  const caret = `
    <rect class="caret" x="${x}" y="${y - size * 0.78}" width="${(size * 0.55).toFixed(1)}" height="${size * 0.95}" fill="${INK}">
      <animate attributeName="x" dur="${total.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete"
        keyTimes="${caretTimes.map((v) => (v / total).toFixed(5)).join(";")}"
        values="${caretX.map((v) => v.toFixed(1)).join(";")}"/>
    </rect>`;
  return layers.join("") + caret;
}

function leaf(cx, cy, scale, rotate, cls, color) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${scale})">
    <g class="${cls}">
      <path d="M0 0 C 18 -30, 18 -70, 0 -100 C -18 -70, -18 -30, 0 0 Z" fill="${color}"/>
      <path d="M0 -4 L0 -92" stroke="${PAPER}" stroke-width="2" opacity=".55"/>
    </g>
  </g>`;
}

function header({ display, mono }) {
  const W = 1200, H = 380;
  const edge = tornEdge(W, 340, 18, 24, 7);
  const paper = `M0,0 L${W},0 L${W},${edge.at(-1).split(",")[1]} L${edge.slice().reverse().join(" L")} Z`;

  const stampR = 78;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Fabrício Brito — desenvolvedor full-stack com direção visual">
  <style>
    @font-face { font-family: "Bowlby One"; src: url(${display}) format("woff2"); }
    @font-face { font-family: "JetBrains Mono"; src: url(${mono}) format("woff2"); }
    .display { font-family: "Bowlby One", "Arial Black", Impact, sans-serif; }
    .mono { font-family: "JetBrains Mono", Consolas, monospace; }
    .misprint { animation: misprint 5s steps(1) infinite; }
    .stamp { transform-box: fill-box; transform-origin: center; animation: spin 22s linear infinite; }
    .sway { transform-box: fill-box; transform-origin: 50% 100%; animation: sway 4.5s ease-in-out infinite alternate; }
    .sway2 { transform-box: fill-box; transform-origin: 50% 100%; animation: sway 6s ease-in-out -2s infinite alternate; }
    .caret { animation: blink 1s steps(1) infinite; }
    .float { animation: float 7s ease-in-out infinite alternate; }
    @keyframes misprint {
      0%   { transform: translate(5px, 4px); }
      40%  { transform: translate(6px, 3px); }
      42%  { transform: translate(2px, 6px); }
      44%  { transform: translate(5px, 4px); }
      80%  { transform: translate(4px, 5px); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes sway { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes float { from { transform: translateY(0); } to { transform: translateY(-10px); } }
    @media (prefers-reduced-motion: reduce) {
      .misprint, .stamp, .sway, .sway2, .caret, .float { animation: none; }
    }
  </style>
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 .16  0 0 0 0 .11  0 0 0 0 .07  0 0 0 .55 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".25"/>
    </filter>
    <path id="stampPath" d="M ${-stampR},0 a ${stampR},${stampR} 0 1,1 ${stampR * 2},0 a ${stampR},${stampR} 0 1,1 ${-stampR * 2},0"/>
    <clipPath id="paperClip"><path d="${paper}"/></clipPath>
  </defs>

  <path d="${paper}" fill="${PAPER}" filter="url(#shadow)"/>
  <g clip-path="url(#paperClip)">
    <circle class="float" cx="1120" cy="40" r="120" fill="${BLUE}" opacity=".16"/>
    <circle cx="60" cy="330" r="90" fill="${GREEN}" opacity=".12"/>

    ${leaf(1170, 360, 1.1, -18, "sway", GREEN)}
    ${leaf(1130, 370, 0.8, 12, "sway2", BLUE)}
    ${leaf(28, 120, 0.55, 160, "sway2", GREEN)}

    <text class="mono" x="72" y="70" font-size="16" fill="${INK}" opacity=".7" letter-spacing="3">PORTFÓLIO Nº 04 — SALVADOR, BAHIA</text>
    <line x1="72" y1="86" x2="640" y2="86" stroke="${INK}" stroke-width="2" stroke-dasharray="2 6" opacity=".5"/>

    <g class="misprint">
      <text class="display" x="72" y="190" font-size="96" fill="${COPPER}" opacity=".85" textLength="780" lengthAdjust="spacingAndGlyphs">FABRÍCIO BRITO</text>
    </g>
    <text class="display" x="72" y="190" font-size="96" fill="${INK}" textLength="780" lengthAdjust="spacingAndGlyphs">FABRÍCIO BRITO</text>

    <text class="mono" x="72" y="262" font-size="30" fill="${INK}">&gt;</text>
    ${typingLayer({ x: 106, y: 262, size: 30 })}

    <g transform="translate(1050 165)">
      <circle r="${stampR + 22}" fill="none" stroke="${COPPER}" stroke-width="3"/>
      <circle r="${stampR - 18}" fill="none" stroke="${COPPER}" stroke-width="1.5" stroke-dasharray="3 5"/>
      <g class="stamp">
        <text class="mono" font-size="16.5" fill="${COPPER}" letter-spacing="${((2 * Math.PI * stampR) / STAMP_TEXT.length - 16.5 * 0.6).toFixed(2)}">
          <textPath href="#stampPath">${esc(STAMP_TEXT)}</textPath>
        </text>
      </g>
      <text class="display" y="16" font-size="46" text-anchor="middle" fill="${COPPER}">FB</text>
    </g>
  </g>
  <rect width="${W}" height="${H}" filter="url(#grain)" clip-path="url(#paperClip)" opacity=".35"/>
</svg>
`;
}

function footer({ display }) {
  const W = 1200, H = 120;
  const top = tornEdge(W, 22, 14, 22, 11);
  const bottom = tornEdge(W, 100, 14, 22, 23);
  const strip = `M${top.join(" L")} L${bottom.slice().reverse().join(" L")} Z`;
  const size = 34;
  const loopW = 3300; // width of one copy of the marquee text
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Stack: ${esc(MARQUEE.replace(/✶/g, "·"))}">
  <style>
    @font-face { font-family: "Bowlby One"; src: url(${display}) format("woff2"); }
    .display { font-family: "Bowlby One", "Arial Black", Impact, sans-serif; }
    .marquee { animation: marquee 40s linear infinite; }
    @keyframes marquee { to { transform: translateX(-${loopW}px); } }
    @media (prefers-reduced-motion: reduce) { .marquee { animation: none; } }
  </style>
  <defs><clipPath id="strip"><path d="${strip}"/></clipPath></defs>
  <g transform="rotate(-1.2 600 60)">
    <path d="${strip}" fill="${INK}"/>
    <g clip-path="url(#strip)">
      <g class="marquee">
        ${[0, loopW].map((dx) => `<text class="display" x="${dx}" y="${60 + size / 2.8}" font-size="${size}" fill="${PAPER}" textLength="${loopW - 30}" lengthAdjust="spacing">${esc(MARQUEE)}</text>`).join("\n        ")}
      </g>
    </g>
  </g>
</svg>
`;
}

const displayChars = uniq("FABRÍCIOBT" + MARQUEE);
const monoChars = uniq(PHRASES.join("") + STAMP_TEXT + "PORTFÓLIO Nº 04 — SALVADOR, BAHIA>");
const [display, mono] = await Promise.all([
  fontSubset("Bowlby+One", displayChars),
  fontSubset("JetBrains+Mono:wght@500", monoChars),
]);

await mkdir(new URL("../assets/", import.meta.url), { recursive: true });
await writeFile(new URL("../assets/header.svg", import.meta.url), header({ display, mono }));
await writeFile(new URL("../assets/footer.svg", import.meta.url), footer({ display }));
console.log("assets/header.svg and assets/footer.svg written");
