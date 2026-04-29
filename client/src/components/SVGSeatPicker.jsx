/**
 * SVGSeatPicker.jsx — KivraTickets Edition
 * Fully responsive, mobile-first redesign.
 * All original logic preserved.
 *
 * Breakpoints:
 *   xs  < 480px   → stacked, bottom-sheet sidebar, compact header
 *   sm  480–767px → stacked, slightly more space
 *   md  768–1023px→ sidebar slides to bottom with 2-col grid
 *   lg  ≥1024px   → side-by-side layout (original intent)
 *
 * Touch support:
 *   - Pinch-to-zoom on the SVG map
 *   - Drag/pan via touch
 *   - Bottom sheet for section details on mobile
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  ZoomIn,
  ZoomOut,
  MapPin,
} from "lucide-react";
import { STADIUM_CONFIGS, TIER_COLORS } from "./stadiumConfigs";

// ─── Helpers ──────────────────────────────────────────────────────

const findSectionGroup = (container, sectionId) =>
  container.querySelector(`[id="${sectionId}-group"]`) ||
  container.querySelector(`[data-section-id="${sectionId}"]`);

function getTierForSection(sectionId, config) {
  for (const [tier, ids] of Object.entries(config.tiers)) {
    if (ids.includes(sectionId)) return tier;
  }
  return "standard";
}

function getScoreForSection(sectionId, config) {
  const tier = getTierForSection(sectionId, config);
  return config.tierScores[tier] ?? 0.2;
}

function calcPrice(score, min, max) {
  return Math.round(min + score * (max - min));
}

function currencySymbol(code = "USD") {
  return { USD: "$", NGN: "₦", GBP: "£", EUR: "€" }[code] ?? "$";
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── useBreakpoint hook ───────────────────────────────────────────

function useBreakpoint() {
  const [w, setW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return {
    isXs: w < 480,
    isSm: w >= 480 && w < 768,
    isMd: w >= 768 && w < 1024,
    isLg: w >= 1024,
    isMobile: w < 1024,
    w,
  };
}

// ─── CSS Variables (injected once) ───────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');

  .svgsp-root * { box-sizing: border-box; }
  .svgsp-root button { font-family: inherit; }

  @keyframes svgsp-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes svgsp-fadein {
    from { opacity:0; transform: translateY(12px); }
    to   { opacity:1; transform: translateY(0); }
  }
  @keyframes svgsp-sheet-up {
    from { transform: translateY(100%); opacity:0; }
    to   { transform: translateY(0);    opacity:1; }
  }

  .svgsp-spinner {
    width:36px; height:36px;
    border:3px solid rgba(56,189,248,0.15);
    border-top:3px solid #38bdf8;
    border-radius:50%;
    animation: svgsp-spin 0.9s linear infinite;
  }

  .svgsp-confirm-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(56,189,248,0.4) !important;
  }
  .svgsp-confirm-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .svgsp-zoom-btn:hover {
    background: rgba(56,189,248,0.12) !important;
    border-color: rgba(56,189,248,0.4) !important;
    color: #38bdf8 !important;
  }

  .svgsp-legend-row:hover {
    background: rgba(56,189,248,0.06) !important;
    border-radius: 8px;
  }

  .svgsp-qty-btn:hover:not(:disabled) {
    background: rgba(56,189,248,0.15) !important;
    border-color: rgba(56,189,248,0.4) !important;
    color: #38bdf8 !important;
  }

  .svgsp-back-btn:hover {
    border-color: rgba(56,189,248,0.4) !important;
    color: #38bdf8 !important;
  }

  /* Scrollbar styling */
  .svgsp-sidebar::-webkit-scrollbar { width:4px; }
  .svgsp-sidebar::-webkit-scrollbar-track { background:transparent; }
  .svgsp-sidebar::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2); border-radius:2px; }

  /* Bottom sheet animation */
  .svgsp-sheet { animation: svgsp-sheet-up 0.3s cubic-bezier(0.34,1.26,0.64,1) both; }
  .svgsp-fadein { animation: svgsp-fadein 0.25s ease both; }

  /* Touch pan cursor */
  .svgsp-map-active { cursor: grabbing !important; }
`;

function injectStyles() {
  if (document.getElementById("svgsp-styles")) return;
  const el = document.createElement("style");
  el.id = "svgsp-styles";
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}

// ─── Legend component ─────────────────────────────────────────────

function PriceLegend({ tierLegend, sym, horizontal }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        flexWrap: horizontal ? "wrap" : "nowrap",
        gap: horizontal ? "8px 20px" : 6,
      }}
    >
      {tierLegend.map(({ tier, price, colors }) => (
        <div
          key={tier}
          className="svgsp-legend-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: horizontal ? "4px 6px" : "5px 8px",
            cursor: "default",
            transition: "background 0.15s",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              flexShrink: 0,
              background: colors.fill,
              border: `2px solid ${colors.stroke}`,
              boxShadow: `0 0 6px ${colors.fill}60`,
            }}
          />
          <span
            style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 500, flex: 1 }}
          >
            {colors.label}
          </span>
          <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>
            {sym}
            {price.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section detail card (shared between sidebar & bottom sheet) ──

function SectionCard({
  selected,
  hoveredSection,
  sectionData,
  sym,
  qty,
  setQty,
  totalPrice,
  onConfirm,
  onDeselect,
  TIER_COLORS,
  compact,
}) {
  if (!selected && !hoveredSection) return null;
  const isHoverOnly = !selected && hoveredSection;
  const data = selected ? sectionData[selected] : sectionData[hoveredSection];
  if (!data) return null;
  const colors = TIER_COLORS[data.tier] ?? {};

  return (
    <div
      className="svgsp-fadein"
      style={{
        background: selected
          ? "linear-gradient(135deg,rgba(14,31,66,0.95),rgba(8,18,42,0.9))"
          : "linear-gradient(135deg,rgba(20,30,55,0.8),rgba(12,20,42,0.7))",
        border: `1px solid ${selected ? "rgba(56,189,248,0.45)" : "rgba(56,189,248,0.18)"}`,
        borderRadius: compact ? 16 : 14,
        padding: compact ? "16px 18px" : 16,
        boxShadow: selected ? "0 8px 32px rgba(56,189,248,0.15)" : "none",
      }}
    >
      {/* Tier + deselect row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#0d1829",
            background: colors.fill ?? "#38bdf8",
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          {colors.label ?? data.tier}
        </span>
        {selected && (
          <button
            onClick={onDeselect}
            style={{
              background: "rgba(30,41,59,0.8)",
              border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: 7,
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 4,
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Section name */}
      <p
        style={{
          margin: "0 0 2px",
          fontFamily: "'Syne',sans-serif",
          fontSize: compact ? 17 : 16,
          fontWeight: 800,
          color: "#f1f5f9",
        }}
      >
        Section {data.label}
      </p>

      {/* Price */}
      <p
        style={{
          margin: "0 0 12px",
          fontFamily: "'Syne',sans-serif",
          fontSize: compact ? 26 : 22,
          fontWeight: 800,
          color: "#38bdf8",
          letterSpacing: "-0.02em",
        }}
      >
        {sym}
        {data.price.toLocaleString()}
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
          {" "}
          / seat
        </span>
      </p>

      {selected && (
        <>
          {/* Qty row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(8,14,30,0.5)",
              border: "1px solid rgba(56,189,248,0.12)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 10,
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>
              Qty
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="svgsp-qty-btn"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid rgba(56,189,248,0.2)",
                  background: "rgba(15,23,42,0.8)",
                  color: "#e2e8f0",
                  fontSize: 18,
                  cursor: qty <= 1 ? "not-allowed" : "pointer",
                  opacity: qty <= 1 ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                  outline: "none",
                }}
              >
                −
              </button>
              <span
                style={{
                  minWidth: 22,
                  textAlign: "center",
                  fontFamily: "'Syne',sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#f1f5f9",
                }}
              >
                {qty}
              </span>
              <button
                className="svgsp-qty-btn"
                disabled={qty >= 10}
                onClick={() => setQty((q) => Math.min(10, q + 1))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid rgba(56,189,248,0.2)",
                  background: "rgba(15,23,42,0.8)",
                  color: "#e2e8f0",
                  fontSize: 18,
                  cursor: qty >= 10 ? "not-allowed" : "pointer",
                  opacity: qty >= 10 ? 0.35 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                  outline: "none",
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid rgba(56,189,248,0.12)",
              paddingTop: 10,
              marginBottom: 14,
            }}
          >
            <span style={{ color: "#64748b", fontSize: 13 }}>Total</span>
            <span
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#f1f5f9",
              }}
            >
              {sym}
              {totalPrice.toLocaleString()}
            </span>
          </div>

          {/* CTA */}
          <button
            className="svgsp-confirm-btn"
            onClick={onConfirm}
            style={{
              width: "100%",
              padding: "13px 0",
              background: "linear-gradient(135deg,#0284c7,#0ea5e9)",
              border: "1px solid rgba(56,189,248,0.4)",
              borderRadius: 12,
              color: "#fff",
              fontFamily: "'Syne',sans-serif",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 6px 20px rgba(56,189,248,0.3)",
              transition: "all 0.2s",
              outline: "none",
            }}
          >
            Continue to Checkout <ChevronRight size={15} />
          </button>
        </>
      )}

      {isHoverOnly && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "#475569",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={11} /> Tap to select this section
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function SVGSeatPicker({ event, onConfirm, onClose }) {
  const svgContainerRef = useRef(null);
  const svgRef = useRef(null);
  const [svgContent, setSvgContent] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [hoveredSection, setHoveredSection] = useState(null);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState(null);
  const [touchStartZoom, setTouchStartZoom] = useState(1);
  const [availableSections, setAvailableSections] = useState(new Set());
  const [sectionData, setSectionData] = useState({});
  const [svgLoaded, setSvgLoaded] = useState(false);
  const bp = useBreakpoint();

  useEffect(() => {
    injectStyles();
  }, []);

  const config = STADIUM_CONFIGS[event?.svgKey] ?? STADIUM_CONFIGS["hard-rock"];
  const priceMin = event?.price?.min ?? 50;
  const priceMax = event?.price?.max ?? 500;
  const currency = event?.price?.currency ?? "USD";
  const sym = currencySymbol(currency);

  // ── Load SVG ──────────────────────────────────────────────────
  useEffect(() => {
    const key = event?.svgKey ?? "hard-rock";
    fetch(`/stadiums/${key}.svg`)
      .then((r) => r.text())
      .then((text) => {
        setSvgContent(text);
        setSvgLoaded(true);
      })
      .catch(() => setSvgLoaded(false));
  }, [event?.svgKey]);

  // ── Parse + colour sections ───────────────────────────────────
  useEffect(() => {
    if (!svgLoaded || !svgRef.current) return;
    const container = svgRef.current;
    const allSections = container.querySelectorAll(".interactive-section");
    const ids = Array.from(allSections).map((el) => el.dataset.sectionId);
    const skipIds = new Set([
      "cat1",
      "cat2",
      "cat3",
      "cat4",
      "cat-1",
      "cat-2",
      "cat-3",
      "cat-4",
      "cat1-group",
      "tier",
    ]);
    const usableIds = ids.filter((id) => id && !skipIds.has(id));
    const count = Math.min(config.availableCount, usableIds.length);
    const available = new Set(shuffle(usableIds).slice(0, count));
    setAvailableSections(available);

    const data = {};
    usableIds.forEach((id) => {
      const tier = getTierForSection(id, config);
      const score = getScoreForSection(id, config);
      const price = calcPrice(score, priceMin, priceMax);
      data[id] = {
        id,
        tier,
        score,
        price,
        label: id.toUpperCase().replace(/-/g, " "),
        available: available.has(id),
      };
    });
    setSectionData(data);

    usableIds.forEach((id) => {
      const el = findSectionGroup(container, id);
      if (!el) return;
      const pathEl = el.querySelector(".section-path, path");
      if (!pathEl) return;
      const isAvailable = available.has(id);
      const tier = getTierForSection(id, config);
      const colors = isAvailable ? TIER_COLORS[tier] : TIER_COLORS.disabled;
      Object.assign(pathEl.style, {
        fill: colors.fill,
        stroke: colors.stroke,
        strokeWidth: "2",
        cursor: isAvailable ? "pointer" : "not-allowed",
        transition: "fill 0.15s, opacity 0.15s",
        opacity: isAvailable ? "1" : "0.35",
      });
    });
  }, [svgLoaded, config, priceMin, priceMax]);

  // ── SVG event handlers ────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !svgLoaded) return;
    const container = svgRef.current;

    const handleClick = (e) => {
      const group = e.target.closest(".interactive-section");
      if (!group) return;
      const id = group.dataset.sectionId;
      if (!id || !availableSections.has(id)) return;
      setSelectedSection(id === selectedSection ? null : id);
    };
    const handleMouseOver = (e) => {
      const group = e.target.closest(".interactive-section");
      if (!group) return;
      const id = group.dataset.sectionId;
      if (!id || !availableSections.has(id)) return;
      setHoveredSection(id);
      const p = group.querySelector(".section-path, path");
      if (p) {
        p.style.opacity = "0.8";
        p.style.filter = "brightness(1.25)";
      }
    };
    const handleMouseOut = (e) => {
      const group = e.target.closest(".interactive-section");
      if (!group) return;
      const id = group.dataset.sectionId;
      if (!id) return;
      setHoveredSection(null);
      const p = group.querySelector(".section-path, path");
      if (p) {
        p.style.opacity = availableSections.has(id) ? "1" : "0.35";
        p.style.filter = "";
      }
    };

    container.addEventListener("click", handleClick);
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [svgLoaded, availableSections, selectedSection]);

  // ── Highlight selected ────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !svgLoaded) return;
    const container = svgRef.current;
    container.querySelectorAll(".interactive-section").forEach((group) => {
      const id = group.dataset.sectionId;
      if (!id || !availableSections.has(id)) return;
      const p = group.querySelector(".section-path, path");
      if (!p) return;
      const tier = getTierForSection(id, config);
      p.style.stroke = TIER_COLORS[tier]?.stroke ?? "#555";
      p.style.strokeWidth = "2";
      p.style.filter = "";
    });
    if (selectedSection) {
      const group = findSectionGroup(container, selectedSection);
      if (group) {
        const p = group.querySelector(".section-path, path");
        if (p) {
          p.style.stroke = "#fff";
          p.style.strokeWidth = "4";
          p.style.filter = "drop-shadow(0 0 8px rgba(255,255,255,0.85))";
        }
      }
    }
  }, [selectedSection, svgLoaded, availableSections, config]);

  // ── Mouse pan/zoom ────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.4, Math.min(4, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ── Touch pan/pinch ───────────────────────────────────────────
  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        setTouchStartDist(Math.hypot(dx, dy));
        setTouchStartZoom(zoom);
      } else if (e.touches.length === 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y,
        });
      }
    },
    [zoom, pan],
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 2 && touchStartDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / touchStartDist;
        setZoom(Math.max(0.4, Math.min(4, touchStartZoom * ratio)));
      } else if (e.touches.length === 1 && isDragging) {
        setPan({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        });
      }
    },
    [touchStartDist, touchStartZoom, isDragging, dragStart],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setTouchStartDist(null);
  }, []);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Computed ──────────────────────────────────────────────────
  const selected = selectedSection ? sectionData[selectedSection] : null;
  const totalPrice = selected ? selected.price * qty : 0;

  const tierLegend = useMemo(() => {
    const seen = new Set();
    const items = [];
    Object.values(sectionData).forEach(({ tier, price, available: av }) => {
      if (!av || seen.has(tier)) return;
      seen.add(tier);
      items.push({ tier, price, colors: TIER_COLORS[tier] });
    });
    return items.sort((a, b) => b.price - a.price);
  }, [sectionData]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm({
      seats: [
        `${selected.label}-${Array.from({ length: qty }, (_, i) => i + 1).join(",")}`,
      ],
      sectionId: selected.id,
      sectionLabel: selected.label,
      category: TIER_COLORS[selected.tier]?.label ?? selected.tier,
      qty,
      pricePerSeat: selected.price,
      totalPrice,
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ── Layout constants ──────────────────────────────────────────
  const mapHeight = bp.isXs
    ? "44vh"
    : bp.isSm
      ? "46vh"
      : bp.isMd
        ? "52vh"
        : "100%";
  const sidebarOnBottom = bp.isMobile;

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div
      className="svgsp-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: bp.isXs ? 0 : bp.isSm ? 8 : 16,
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(160deg,#080e1e 0%,#0a1425 60%,#060d1a 100%)",
          border: bp.isXs ? "none" : "1px solid rgba(56,189,248,0.15)",
          borderRadius: bp.isXs ? 0 : 20,
          width: "100%",
          maxWidth: bp.isLg ? 1120 : "100%",
          height: bp.isXs ? "100%" : bp.isSm ? "98vh" : "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 90px rgba(0,0,0,0.75)",
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: bp.isXs ? "10px 14px" : "13px 20px",
            borderBottom: "1px solid rgba(56,189,248,0.12)",
            background: "rgba(4,8,20,0.9)",
            flexShrink: 0,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {/* Back */}
          <button
            className="svgsp-back-btn"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: 9,
              color: "#94a3b8",
              cursor: "pointer",
              padding: bp.isXs ? "5px 10px" : "6px 13px",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            <ChevronLeft size={15} />
            {bp.isXs ? "" : "Back"}
          </button>

          {/* Title */}
          <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "'Syne',sans-serif",
                fontSize: bp.isXs ? 14 : 16,
                fontWeight: 800,
                color: "#f1f5f9",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {config.name ?? "Stadium Map"}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#38bdf8" }}>
              {availableSections.size} sections available
            </p>
          </div>

          {/* Zoom controls */}
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {[
              {
                label: <ZoomIn size={14} />,
                action: () => setZoom((z) => Math.min(4, z * 1.2)),
              },
              {
                label: <ZoomOut size={14} />,
                action: () => setZoom((z) => Math.max(0.4, z / 1.2)),
              },
              {
                label: "⌖",
                action: resetView,
                extra: { fontSize: 16, letterSpacing: 0 },
              },
            ].map((btn, i) => (
              <button
                key={i}
                className="svgsp-zoom-btn"
                onClick={btn.action}
                style={{
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  borderRadius: 8,
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: bp.isXs ? "4px 7px" : "5px 9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  transition: "all 0.15s",
                  ...btn.extra,
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: sidebarOnBottom ? "column" : "row",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* ── SVG Map ─────────────────────────────────────────── */}
          <div
            ref={svgContainerRef}
            className={isDragging ? "svgsp-map-active" : ""}
            style={{
              flex: sidebarOnBottom ? "0 0 auto" : 1,
              height: sidebarOnBottom ? mapHeight : "100%",
              position: "relative",
              overflow: "hidden",
              background:
                "radial-gradient(ellipse at center, #0d1829 0%, #060c18 100%)",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Loading state */}
            {!svgLoaded && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="svgsp-spinner" />
                <p style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>
                  Loading stadium map…
                </p>
                {/* <p style={{ color: "#334155", fontSize: 11, marginTop: 4 }}>
                  Place your SVG at /public/stadiums/
                  {event?.svgKey ?? "hard-rock"}.svg
                </p> */}
              </div>
            )}

            {/* SVG content */}
            <div
              ref={svgRef}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.1s ease",
                userSelect: "none",
                pointerEvents: "all",
                width: "100%",
                height: "100%",
              }}
              dangerouslySetInnerHTML={
                svgContent ? { __html: svgContent } : undefined
              }
            />

            {/* Floating zoom badge */}
            {zoom !== 1 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(8,14,30,0.85)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 20,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: "#64748b",
                  backdropFilter: "blur(4px)",
                }}
              >
                {Math.round(zoom * 100)}%
              </div>
            )}

            {/* Legend overlay on map (mobile, horizontal) */}
            {sidebarOnBottom && tierLegend.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  background: "rgba(6,11,22,0.85)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <PriceLegend tierLegend={tierLegend} sym={sym} horizontal />
              </div>
            )}

            {/* Hover tooltip on desktop only */}
            {!bp.isMobile &&
              hoveredSection &&
              sectionData[hoveredSection] &&
              !selectedSection && (
                <div
                  className="svgsp-fadein"
                  style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(8,14,32,0.92)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      color: "#0d1829",
                      background:
                        TIER_COLORS[sectionData[hoveredSection].tier]?.fill,
                      padding: "2px 8px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                    }}
                  >
                    {TIER_COLORS[sectionData[hoveredSection].tier]?.label}
                  </span>
                  <span
                    style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700 }}
                  >
                    Section {sectionData[hoveredSection].label}
                  </span>
                  <span
                    style={{ color: "#38bdf8", fontSize: 15, fontWeight: 800 }}
                  >
                    {sym}
                    {sectionData[hoveredSection].price.toLocaleString()}
                  </span>
                </div>
              )}
          </div>

          {/* ── Sidebar (desktop) / Bottom panel (mobile) ───────── */}
          {sidebarOnBottom ? (
            /* MOBILE: bottom scrollable area */
            <div
              className="svgsp-sidebar"
              style={{
                flex: 1,
                overflowY: "auto",
                background: "rgba(4,8,20,0.95)",
                borderTop: "1px solid rgba(56,189,248,0.15)",
                padding: bp.isXs ? "14px 14px 24px" : "16px 20px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Hint or selected card */}
              {!selected && !hoveredSection && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "rgba(56,189,248,0.05)",
                    border: "1px solid rgba(56,189,248,0.12)",
                    borderRadius: 12,
                  }}
                >
                  <Info size={16} style={{ color: "#38bdf8", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    Tap a highlighted section on the map above
                  </p>
                </div>
              )}

              {(selected || hoveredSection) && (
                <SectionCard
                  selected={selectedSection}
                  hoveredSection={hoveredSection}
                  sectionData={sectionData}
                  sym={sym}
                  qty={qty}
                  setQty={setQty}
                  totalPrice={totalPrice}
                  onConfirm={handleConfirm}
                  onDeselect={() => setSelectedSection(null)}
                  TIER_COLORS={TIER_COLORS}
                  compact
                />
              )}
            </div>
          ) : (
            /* DESKTOP: right sidebar */
            <div
              className="svgsp-sidebar"
              style={{
                width: 270,
                flexShrink: 0,
                borderLeft: "1px solid rgba(56,189,248,0.12)",
                background:
                  "linear-gradient(180deg,rgba(6,11,22,0.98) 0%,rgba(4,8,18,1) 100%)",
                padding: 16,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Legend card */}
              <div
                style={{
                  background: "rgba(14,22,44,0.7)",
                  border: "1px solid rgba(56,189,248,0.14)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#475569",
                  }}
                >
                  Price Tiers
                </p>
                <PriceLegend tierLegend={tierLegend} sym={sym} />
              </div>

              {/* Section detail */}
              <SectionCard
                selected={selectedSection}
                hoveredSection={hoveredSection}
                sectionData={sectionData}
                sym={sym}
                qty={qty}
                setQty={setQty}
                totalPrice={totalPrice}
                onConfirm={handleConfirm}
                onDeselect={() => setSelectedSection(null)}
                TIER_COLORS={TIER_COLORS}
              />

              {/* Empty state */}
              {!selected && !hoveredSection && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "24px 12px",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "rgba(56,189,248,0.06)",
                      border: "1px solid rgba(56,189,248,0.14)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapPin size={18} style={{ color: "#334155" }} />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#475569",
                      textAlign: "center",
                      lineHeight: 1.6,
                    }}
                  >
                    Click a highlighted section on the map to choose your seats
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
