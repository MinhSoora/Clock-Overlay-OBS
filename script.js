/* ==========================================================================
   OBS Time Overlay — shared logic (script.js)
   Used by both index.html (config page) and overlay.html (the OBS overlay)
   ========================================================================== */

/* ---------- Defaults ---------- */
const DEFAULTS = {
  timezone: "Asia/Ho_Chi_Minh",
  layout: "horizontal",     // horizontal | 2lines
  format: "24h-date",       // see FORMATS below
  font: "Poppins",
  fontUrl: "",               // optional custom Google Fonts / webfont <link> URL
  size: "48",                 // px, main line font-size
  color: "#ffffff",
  shadow: "1",                // "1" = on, "0" = off
  separator: "•"              // divider used in horizontal layout
};

/* ---------- Available formats (easy to extend) ----------
   Each entry: { id, label, build(parts) -> { line1, line2 } }
   parts = { h12, h24, min, sec, ampm, dd, mm, yyyy, weekday }
------------------------------------------------------------ */
const FORMATS = [
  {
    id: "12h",
    label: "2:00 PM",
    build: (p) => ({ line1: `${p.h12}:${p.min} ${p.ampm}`, line2: "" })
  },
  {
    id: "24h",
    label: "14:00",
    build: (p) => ({ line1: `${p.h24}:${p.min}`, line2: "" })
  },
  {
    id: "date",
    label: "dd/mm/yyyy",
    build: (p) => ({ line1: `${p.dd}/${p.mm}/${p.yyyy}`, line2: "" })
  },
  {
    id: "12h-date",
    label: "2:00 PM dd/mm/yyyy",
    build: (p) => ({ line1: `${p.h12}:${p.min} ${p.ampm}`, line2: `${p.dd}/${p.mm}/${p.yyyy}` })
  },
  {
    id: "24h-date",
    label: "14:00 dd/mm/yyyy",
    build: (p) => ({ line1: `${p.h24}:${p.min}`, line2: `${p.dd}/${p.mm}/${p.yyyy}` })
  },
  {
    id: "date-24h",
    label: "dd/mm/yyyy - 14:00",
    build: (p) => ({ line1: `${p.dd}/${p.mm}/${p.yyyy}`, line2: `${p.h24}:${p.min}` })
  },
  {
    id: "date-12h",
    label: "dd/mm/yyyy - 2:00 PM",
    build: (p) => ({ line1: `${p.dd}/${p.mm}/${p.yyyy}`, line2: `${p.h12}:${p.min} ${p.ampm}` })
  },
  {
    id: "24h-date-sec",
    label: "14:00:05 dd/mm/yyyy",
    build: (p) => ({ line1: `${p.h24}:${p.min}:${p.sec}`, line2: `${p.dd}/${p.mm}/${p.yyyy}` })
  }
];

function getFormat(id) {
  return FORMATS.find(f => f.id === id) || FORMATS.find(f => f.id === DEFAULTS.format);
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

/* Build a parts object for a given timezone using Intl (accurate, DST-safe) */
function getTimeParts(timezone) {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULTS.timezone;
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
    weekday: parts.weekday
  };
}

/* ---------- URL query helpers ---------- */
function getQueryParams() {
  const sp = new URLSearchParams(window.location.search);
  const cfg = {};
  Object.keys(DEFAULTS).forEach(key => {
    const val = sp.get(key);
    cfg[key] = (val !== null && val !== "") ? val : DEFAULTS[key];
  });
  return cfg;
}

function buildOverlayURL(cfg, baseUrl) {
  const url = new URL(baseUrl, window.location.href);
  Object.keys(DEFAULTS).forEach(key => {
    const val = (cfg[key] === undefined || cfg[key] === null || cfg[key] === "")
      ? DEFAULTS[key]
      : cfg[key];
    // Only include if different from default to keep URLs short, EXCEPT
    // we still want the overlay to work even without params (defaults apply anyway)
    if (String(val) !== String(DEFAULTS[key])) {
      url.searchParams.set(key, val);
    }
  });
  return url.toString();
}

/* ---------- Font loading ---------- */
let injectedFontLink = null;
function applyFont(fontName, fontUrl) {
  const safeName = (fontName || DEFAULTS.font).trim();

  // Remove previously injected font link
  if (injectedFontLink && injectedFontLink.parentNode) {
    injectedFontLink.parentNode.removeChild(injectedFontLink);
    injectedFontLink = null;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  if (fontUrl && fontUrl.trim() !== "") {
    link.href = fontUrl.trim();
  } else {
    // Try to auto-load from Google Fonts by name. If the font doesn't exist
    // there, the request harmlessly fails and the CSS fallback (sans-serif) is used.
    const familyParam = encodeURIComponent(safeName).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;600;700&display=swap`;
  }
  document.head.appendChild(link);
  injectedFontLink = link;

  return `"${safeName}", "Segoe UI", Roboto, Arial, sans-serif`;
}

/* ---------- Config <-> query string sync for the overlay renderer ---------- */
function renderOverlay(cfg, els) {
  const parts = getTimeParts(cfg.timezone);
  const fmt = getFormat(cfg.format);
  const { line1, line2 } = fmt.build(parts);

  const fontStack = applyFont(cfg.font, cfg.fontUrl);

  els.root.style.setProperty("--overlay-font", fontStack);
  els.root.style.setProperty("--overlay-size", `${parseInt(cfg.size, 10) || DEFAULTS.size}px`);
  els.root.style.setProperty("--overlay-color", cfg.color || DEFAULTS.color);
  els.root.style.setProperty("--overlay-shadow", (cfg.shadow === "0") ? "none" : "0 2px 8px rgba(0,0,0,0.65)");

  els.root.classList.remove("layout-horizontal", "layout-2lines");
  els.root.classList.add(cfg.layout === "2lines" ? "layout-2lines" : "layout-horizontal");

  if (cfg.layout === "2lines") {
    els.line1.textContent = line1;
    els.line2.textContent = line2 || "";
    els.line2.style.display = line2 ? "block" : "none";
    els.sep.style.display = "none";
  } else {
    // horizontal: join line1 + line2 with separator if both exist
    els.line1.textContent = line1;
    if (line2) {
      els.line2.textContent = line2;
      els.line2.style.display = "inline";
      els.sep.style.display = "inline";
      els.sep.textContent = ` ${cfg.separator || DEFAULTS.separator} `;
    } else {
      els.line2.textContent = "";
      els.line2.style.display = "none";
      els.sep.style.display = "none";
    }
  }
}
