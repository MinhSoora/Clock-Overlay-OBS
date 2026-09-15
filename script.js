/* ==========================================================================
   OBS Time Overlay — shared logic (script.js)
   Used by both index.html (config page) and overlay.html (the OBS overlay)
   ========================================================================== */

/* ---------- Placeholders ---------- */
const PLACEHOLDERS = [
  { key: "time",     label: "{time}",     hint: "Giờ hoàn chỉnh" },
  { key: "hour",     label: "{hour}",     hint: "Giờ" },
  { key: "minute",   label: "{minute}",   hint: "Phút" },
  { key: "second",   label: "{second}",   hint: "Giây" },
  { key: "ms",       label: "{ms}",       hint: "Mili giây" },
  { key: "date",     label: "{date}",     hint: "Ngày tháng năm" },
  { key: "day",      label: "{day}",      hint: "Ngày" },
  { key: "month",    label: "{month}",    hint: "Tháng" },
  { key: "year",     label: "{year}",     hint: "Năm" },
  { key: "weekday",  label: "{weekday}",  hint: "Thứ" },
  { key: "timezone", label: "{timezone}", hint: "Tên timezone" },
  { key: "tz",       label: "{tz}",       hint: "Timezone viết tắt" },
  { key: "offset",   label: "{offset}",   hint: "UTC offset" },
  { key: "ampm",     label: "{ampm}",     hint: "AM/PM" },
  { key: "unix",     label: "{unix}",     hint: "Unix timestamp" }
];

/* ---------- Style presets ---------- */
const STYLE_VALUES = [
  "minimal", "modern", "digital", "clean", "compact",
  "glass", "neon", "horizontal", "2lines", "3lines"
];

const STYLE_LABELS = {
  minimal: "Minimal",
  modern: "Modern",
  digital: "Digital",
  clean: "Clean",
  compact: "Compact",
  glass: "Glass",
  neon: "Neon",
  horizontal: "Horizontal",
  "2lines": "2 Lines",
  "3lines": "3 Lines"
};

const ALIGN_VALUES = ["left", "center", "right"];
const WEIGHT_VALUES = [300, 400, 500, 600, 700, 800, 900];

/* ---------- Default config ---------- */
const DEFAULT_CONFIG = {
  tz: "Asia/Ho_Chi_Minh",
  tf: "24h",        // "12h" | "24h"
  showH: true,       // show hour component inside {time}
  showMin: true,     // show minute component inside {time}
  showSec: false,    // show second component inside {time}
  showMs: false,     // show millisecond component inside {time}
  date: true,        // enable {date}
  wd: false,         // enable {weekday}
  ampm: true,        // enable AM/PM inside {time} (12h) and {ampm}
  stable: true,      // fixed-width digits so surrounding text never shifts
  style: "minimal",
  lines: [
    { on: true,  txt: "{time}",    font: "Poppins", size: 48, weight: 700, italic: false, spacing: 0, lineHeight: 1.2, align: "center", opacity: 1,    color: "#ffffff", shadow: true, gap: 4 },
    { on: true,  txt: "{date}",    font: "Poppins", size: 20, weight: 600, italic: false, spacing: 0, lineHeight: 1.2, align: "center", opacity: 0.92, color: "#ffffff", shadow: true, gap: 4 },
    { on: false, txt: "{weekday}", font: "Poppins", size: 16, weight: 500, italic: false, spacing: 0, lineHeight: 1.2, align: "center", opacity: 0.85, color: "#ffffff", shadow: true, gap: 0 }
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
function pad3(n) { return String(n).padStart(3, "0"); }

function getOffsetString(tz) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const part = dtf.formatToParts(new Date()).find(p => p.type === "timeZoneName");
    if (part && part.value) return part.value.replace("GMT", "UTC");
  } catch (e) { /* ignore, fall through */ }
  return "UTC";
}

function getTzAbbr(tz) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const part = dtf.formatToParts(new Date()).find(p => p.type === "timeZoneName");
    if (part && part.value) return part.value;
  } catch (e) { /* ignore */ }
  return getOffsetString(tz);
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
    ms: pad3(now.getMilliseconds()),
    ampm,
    dd: parts.day,
    mm: parts.month,
    yyyy: parts.year,
    weekday: parts.weekday,
    offset: getOffsetString(tz),
    tzAbbr: getTzAbbr(tz),
    unix: Math.floor(now.getTime() / 1000)
  };
}

/* ---------- Placeholder filling ---------- */
function buildTimeString(parts, cfg) {
  const h = cfg.tf === "12h" ? parts.h12 : parts.h24;
  const segments = [];
  if (cfg.showH) segments.push(h);
  if (cfg.showMin) segments.push(parts.min);
  if (cfg.showSec) segments.push(parts.sec);

  let s = segments.join(":");
  if (cfg.showMs) s += (s ? "." : "") + parts.ms;
  if (cfg.tf === "12h" && cfg.ampm && cfg.showH) s += (s ? " " : "") + parts.ampm;
  return s;
}

function fillPlaceholders(template, parts, cfg) {
  if (typeof template !== "string" || template === "") return "";
  const map = {
    time: buildTimeString(parts, cfg),
    hour: cfg.tf === "12h" ? parts.h12 : parts.h24,
    minute: parts.min,
    second: parts.sec,
    ms: parts.ms,
    date: cfg.date ? `${parts.dd}/${parts.mm}/${parts.yyyy}` : "",
    day: parts.dd,
    month: parts.mm,
    year: parts.yyyy,
    weekday: cfg.wd ? parts.weekday : "",
    timezone: cfg.tz,
    tz: parts.tzAbbr,
    offset: parts.offset,
    ampm: cfg.ampm ? parts.ampm : "",
    unix: String(parts.unix)
  };
  return template.replace(/\{(\w+)\}/g, (m, key) => (
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : m
  ));
}

/* Does the current config need sub-second ticking? (any visible line uses {ms}) */
function needsMsTicking(cfg) {
  return cfg.lines.some(l => l.on && typeof l.txt === "string" && l.txt.indexOf("{ms}") !== -1);
}

/* ---------- Validation / sanitizing (used when reading from URL) ---------- */
function clampNumber(n, min, max, fallback) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
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
    italic: typeof line.italic === "boolean" ? line.italic : fallback.italic,
    spacing: clampNumber(line.spacing, -10, 50, fallback.spacing),
    lineHeight: clampNumber(line.lineHeight, 0.8, 3, fallback.lineHeight),
    color: isValidHexColor(line.color) ? line.color : fallback.color,
    align: ALIGN_VALUES.includes(line.align) ? line.align : fallback.align,
    opacity: clampNumber(line.opacity, 0, 1, fallback.opacity),
    shadow: typeof line.shadow === "boolean" ? line.shadow : fallback.shadow,
    gap: clampNumber(line.gap, 0, 80, fallback.gap)
  };
}

function sanitizeConfig(raw) {
  const d = DEFAULT_CONFIG;
  if (!raw || typeof raw !== "object") raw = {};
  const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
  return {
    tz: isValidTimezone(raw.tz) ? raw.tz : d.tz,
    tf: raw.tf === "12h" ? "12h" : "24h",
    showH: typeof raw.showH === "boolean" ? raw.showH : d.showH,
    showMin: typeof raw.showMin === "boolean" ? raw.showMin : d.showMin,
    showSec: typeof raw.showSec === "boolean" ? raw.showSec : d.showSec,
    showMs: typeof raw.showMs === "boolean" ? raw.showMs : d.showMs,
    date: typeof raw.date === "boolean" ? raw.date : d.date,
    wd: typeof raw.wd === "boolean" ? raw.wd : d.wd,
    ampm: typeof raw.ampm === "boolean" ? raw.ampm : d.ampm,
    stable: typeof raw.stable === "boolean" ? raw.stable : d.stable,
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

function shadowFor(style, enabled) {
  if (!enabled) return "none";
  if (style === "neon" || style === "digital") {
    return "0 0 6px currentColor, 0 0 14px currentColor";
  }
  return "0 2px 8px rgba(0,0,0,0.6)";
}

/* els = { root, line1, line2, line3 } */
function renderOverlay(cfg, els) {
  const parts = getTimeParts(cfg.tz);

  els.root.className = "overlay-stage style-" + cfg.style;

  const isHorizontal = cfg.style === "horizontal";
  const fontsToLoad = [];
  const lastIndex = (() => {
    for (let i = 2; i >= 0; i--) if (cfg.lines[i].on) return i;
    return -1;
  })();

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
    el.style.fontStyle = line.italic ? "italic" : "normal";
    el.style.letterSpacing = `${line.spacing}px`;
    el.style.lineHeight = String(line.lineHeight);
    el.style.color = line.color;
    el.style.opacity = String(line.opacity);
    el.style.textAlign = line.align;
    el.style.alignSelf = ALIGN_TO_FLEX[line.align] || "center";
    el.style.textShadow = shadowFor(cfg.style, line.shadow);
    el.style.fontVariantNumeric = cfg.stable ? "tabular-nums" : "normal";

    if (isHorizontal) {
      el.style.marginBottom = "0px";
      el.style.marginRight = (i === lastIndex) ? "0px" : `${line.gap}px`;
    } else {
      el.style.marginRight = "0px";
      el.style.marginBottom = (i === lastIndex) ? "0px" : `${line.gap}px`;
    }
  });

  applyFonts(fontsToLoad);
}
