/* ==========================================================================
   OBS Time Overlay — shared logic (script.js)
   Used by both index.html (config page) and overlay.html (the OBS overlay)
   ========================================================================== */

/* ---------- Placeholders ---------- */
const PLACEHOLDERS = [
  { key: "time",     label: "{time}" },
  { key: "hour",     label: "{hour}" },
  { key: "minute",   label: "{minute}" },
  { key: "second",   label: "{second}" },
  { key: "date",     label: "{date}" },
  { key: "day",      label: "{day}" },
  { key: "month",    label: "{month}" },
  { key: "year",     label: "{year}" },
  { key: "weekday",  label: "{weekday}" },
  { key: "timezone", label: "{timezone}" },
  { key: "offset",   label: "{offset}" },
  { key: "ampm",     label: "{ampm}" }
];

/* ---------- Style presets ---------- */
const STYLE_VALUES = ["minimal", "modern", "digital", "2lines", "3lines"];
const STYLE_LABELS = {
  minimal: "Minimal",
  modern: "Modern",
  digital: "Digital",
  "2lines": "2 Lines",
  "3lines": "3 Lines"
};

const ALIGN_VALUES = ["left", "center", "right"];
const WEIGHT_VALUES = [300, 400, 500, 600, 700, 800, 900];

/* ---------- Default config ---------- */
const DEFAULT_CONFIG = {
  tz: "Asia/Ho_Chi_Minh",
  tf: "24h",       // "12h" | "24h"
  sec: false,      // show seconds inside {time}
  date: true,      // show {date}
  wd: false,       // show {weekday}
  ampm: true,      // show AM/PM inside {time} (12h only) and {ampm}
  style: "minimal",
  lines: [
    { on: true,  txt: "{time}",    font: "Poppins", size: 48, weight: 700, color: "#ffffff", align: "center" },
    { on: true,  txt: "{date}",    font: "Poppins", size: 20, weight: 600, color: "#ffffff", align: "center" },
    { on: false, txt: "{weekday}", font: "Poppins", size: 16, weight: 500, color: "#ffffff", align: "center" }
  ]
};

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/* ---------- Timezone helpers ---------- */
function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function pad2(n) { return String(n).padStart(2, "0"); }

function getOffsetString(tz) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const part = dtf.formatToParts(new Date()).find(p => p.type === "timeZoneName");
    if (part && part.value) return part.value.replace("GMT", "UTC");
  } catch (e) { /* ignore, fall through */ }
  return "UTC";
}

/* Build a parts object for a given timezone using Intl (accurate, DST-safe) */
function getTimeParts(timezone) {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_CONFIG.tz;
  const now = new Date();

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });

  const parts = {};
  dtf.formatToParts(now).forEach(p => { parts[p.type] = p.value; });

  let h24 = parts.hour === "24" ? "00" : parts.hour; // Intl may return "24" for midnight in some locales
  let h24num = parseInt(h24, 10);
  let h12num = h24num % 12;
  if (h12num === 0) h12num = 12;
  const ampm = h24num >= 12 ? "PM" : "AM";

  return {
    h24: pad2(h24num),
    h12: pad2(h12num),
    min: parts.minute,
    sec: parts.second,
    ampm,
    dd: parts.day,
    mm: parts.month,
    yyyy: parts.year,
    weekday: parts.weekday,
    offset: getOffsetString(tz)
  };
}

/* ---------- Placeholder filling ---------- */
function buildTimeString(parts, cfg) {
  const h = cfg.tf === "12h" ? parts.h12 : parts.h24;
  let s = `${h}:${parts.min}`;
  if (cfg.sec) s += `:${parts.sec}`;
  if (cfg.tf === "12h" && cfg.ampm) s += ` ${parts.ampm}`;
  return s;
}

function fillPlaceholders(template, parts, cfg) {
  if (typeof template !== "string" || template === "") return "";
  const map = {
    time: buildTimeString(parts, cfg),
    hour: cfg.tf === "12h" ? parts.h12 : parts.h24,
    minute: parts.min,
    second: parts.sec,
    date: cfg.date ? `${parts.dd}/${parts.mm}/${parts.yyyy}` : "",
    day: parts.dd,
    month: parts.mm,
    year: parts.yyyy,
    weekday: cfg.wd ? parts.weekday : "",
    timezone: cfg.tz,
    offset: parts.offset,
    ampm: cfg.ampm ? parts.ampm : ""
  };
  return template.replace(/\{(\w+)\}/g, (m, key) => (
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : m
  ));
}

/* ---------- Validation / sanitizing (used when reading from URL) ---------- */
function clampNumber(n, min, max, fallback) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function isValidHexColor(c) {
  return typeof c === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c);
}

function sanitizeLine(line, fallback) {
  if (!line || typeof line !== "object") line = {};
  return {
    on: typeof line.on === "boolean" ? line.on : fallback.on,
    txt: (typeof line.txt === "string" && line.txt.length <= 200) ? line.txt : fallback.txt,
    font: (typeof line.font === "string" && line.font.trim() !== "") ? line.font.trim().slice(0, 60) : fallback.font,
    size: clampNumber(line.size, 8, 300, fallback.size),
    weight: WEIGHT_VALUES.includes(Number(line.weight)) ? Number(line.weight) : fallback.weight,
    color: isValidHexColor(line.color) ? line.color : fallback.color,
    align: ALIGN_VALUES.includes(line.align) ? line.align : fallback.align
  };
}

function sanitizeConfig(raw) {
  const d = DEFAULT_CONFIG;
  if (!raw || typeof raw !== "object") raw = {};
  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  return {
    tz: isValidTimezone(raw.tz) ? raw.tz : d.tz,
    tf: raw.tf === "12h" ? "12h" : "24h",
    sec: typeof raw.sec === "boolean" ? raw.sec : d.sec,
    date: typeof raw.date === "boolean" ? raw.date : d.date,
    wd: typeof raw.wd === "boolean" ? raw.wd : d.wd,
    ampm: typeof raw.ampm === "boolean" ? raw.ampm : d.ampm,
    style: STYLE_VALUES.includes(raw.style) ? raw.style : d.style,
    lines: [0, 1, 2].map(i => sanitizeLine(rawLines[i], d.lines[i]))
  };
}

/* ---------- URL encode / decode ---------- */
function encodeConfig(cfg) {
  try {
    const json = JSON.stringify(cfg);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    return "";
  }
}

function decodeConfig(str) {
  try {
    let b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/* Read config from the current page's query string ("c" param). Missing or
   broken data safely falls back to DEFAULT_CONFIG. */
function getConfigFromURL() {
  const sp = new URLSearchParams(window.location.search);
  const raw = sp.get("c");
  if (!raw) return cloneDefaultConfig();
  const parsed = decodeConfig(raw);
  return sanitizeConfig(parsed);
}

function buildOverlayURL(cfg, baseUrl) {
  const url = new URL(baseUrl, window.location.href);
  url.search = "";
  url.searchParams.set("c", encodeConfig(cfg));
  return url.toString();
}

/* ---------- Font loading (supports multiple simultaneous fonts) ---------- */
function applyFonts(fontNames) {
  const existing = document.getElementById("dynamic-font-link");
  if (existing) existing.parentNode.removeChild(existing);

  const unique = Array.from(new Set((fontNames || []).map(f => (f || "").trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const familyParams = unique
    .map(f => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900`)
    .join("&");

  const link = document.createElement("link");
  link.id = "dynamic-font-link";
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  document.head.appendChild(link);
}

/* ---------- Render ---------- */
const ALIGN_TO_FLEX = { left: "flex-start", center: "center", right: "flex-end" };

/* els = { root, line1, line2, line3 } */
function renderOverlay(cfg, els) {
  const parts = getTimeParts(cfg.tz);

  els.root.className = "overlay-stage style-" + cfg.style;

  const fontsToLoad = [];

  cfg.lines.forEach((line, i) => {
    const el = els["line" + (i + 1)];
    if (!el) return;

    if (!line.on) {
      el.style.display = "none";
      return;
    }

    const text = fillPlaceholders(line.txt, parts, cfg);
    el.textContent = text;
    el.style.display = "block";

    const isDigital = cfg.style === "digital";
    const fontFamily = isDigital
      ? "'Courier New', 'Share Tech Mono', monospace"
      : `"${line.font}", "Segoe UI", Roboto, Arial, sans-serif`;

    if (!isDigital) fontsToLoad.push(line.font);

    el.style.fontFamily = fontFamily;
    el.style.fontSize = `${line.size}px`;
    el.style.fontWeight = String(line.weight);
    el.style.color = line.color;
    el.style.textAlign = line.align;
    el.style.alignSelf = ALIGN_TO_FLEX[line.align] || "center";
  });

  applyFonts(fontsToLoad);
}
