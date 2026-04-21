/**
 * SeatPicker.jsx — KivraTickets Edition
 * Fully restyled & responsive. All logic preserved from original.
 */

import React, { useCallback, useMemo, useState } from "react";

// ─── helpers ──────────────────────────────────────────────────────────

function currencySymbol(code = "USD") {
  return { USD: "$", NGN: "₦", GBP: "£", EUR: "€" }[code] ?? "";
}
function rowLetter(i) {
  return String.fromCharCode(65 + i);
}
function seatId(row, col) {
  return `${rowLetter(row)}${col + 1}`;
}
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function buildSeatMapFromAvailability(rows, cols, allowedSeatIds = []) {
  const allowed = new Set(allowedSeatIds);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      allowed.has(seatId(r, c)) ? "available" : "taken",
    ),
  );
}

function buildSectionSeatMaps(sections, seatingLayout = {}) {
  const explicitBySection = seatingLayout?.availableSeatIdsBySection;
  const explicitGlobal = seatingLayout?.availableSeatIds;

  if (explicitBySection && typeof explicitBySection === "object") {
    const result = {};
    sections.forEach((sec) => {
      result[sec.id] = buildSeatMapFromAvailability(
        sec.rows,
        sec.cols,
        explicitBySection[sec.id] ?? [],
      );
    });
    return result;
  }

  if (Array.isArray(explicitGlobal) && explicitGlobal.length > 0) {
    const parsedBySection = {};
    sections.forEach((sec) => {
      parsedBySection[sec.id] = [];
    });
    explicitGlobal.forEach((fullId) => {
      if (typeof fullId !== "string") return;
      const parts = fullId.split("-");
      if (parts.length < 2) return;
      const [sectionPrefix, ...rest] = parts;
      const localSeatId = rest.join("-");
      if (parsedBySection[sectionPrefix])
        parsedBySection[sectionPrefix].push(localSeatId);
    });
    const result = {};
    sections.forEach((sec) => {
      result[sec.id] = buildSeatMapFromAvailability(
        sec.rows,
        sec.cols,
        parsedBySection[sec.id] ?? [],
      );
    });
    return result;
  }

  const totalAvailable = clamp(
    Number.isFinite(seatingLayout?.availableSeats)
      ? seatingLayout.availableSeats
      : Number.isFinite(seatingLayout?.availableSeatCount)
        ? seatingLayout.availableSeatCount
        : 10,
    0,
    sections.reduce((sum, sec) => sum + sec.rows * sec.cols, 0),
  );

  const allSeats = [];
  sections.forEach((sec) => {
    for (let r = 0; r < sec.rows; r++)
      for (let c = 0; c < sec.cols; c++)
        allSeats.push({ sectionId: sec.id, localSeatId: seatId(r, c) });
  });

  const picked = shuffle(allSeats).slice(0, totalAvailable);
  const availableBySection = {};
  sections.forEach((sec) => {
    availableBySection[sec.id] = [];
  });
  picked.forEach(({ sectionId, localSeatId }) => {
    availableBySection[sectionId].push(localSeatId);
  });

  const result = {};
  sections.forEach((sec) => {
    result[sec.id] = buildSeatMapFromAvailability(
      sec.rows,
      sec.cols,
      availableBySection[sec.id],
    );
  });
  return result;
}

// ─── Seat tier config ─────────────────────────────────────────────────

function sectionConfig(sectionName = "") {
  const s = sectionName.toLowerCase();
  if (s.includes("vip"))
    return {
      accent: "#c084fc",
      accentBg: "rgba(192,132,252,0.12)",
      accentBorder: "rgba(192,132,252,0.35)",
      selectedBg: "#9333ea",
      selectedBorder: "#c084fc",
      label: "vip",
    };
  if (s.includes("premium") || s.includes("gold"))
    return {
      accent: "#fbbf24",
      accentBg: "rgba(251,191,36,0.1)",
      accentBorder: "rgba(251,191,36,0.3)",
      selectedBg: "#d97706",
      selectedBorder: "#fbbf24",
      label: "premium",
    };
  return {
    accent: "#38bdf8",
    accentBg: "rgba(56,189,248,0.1)",
    accentBorder: "rgba(56,189,248,0.25)",
    selectedBg: "#0284c7",
    selectedBorder: "#38bdf8",
    label: "standard",
  };
}

// ─── CSS-in-JS base styles ─────────────────────────────────────────────

const css = {
  card: {
    background: "linear-gradient(160deg,#0b1120 0%,#0d1829 60%,#0a1520 100%)",
    border: "1px solid rgba(56,189,248,0.14)",
    borderRadius: 24,
    padding: "clamp(16px,4vw,28px)",
    boxShadow:
      "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.06) inset",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    color: "#e2e8f0",
    width: "100%",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  sectionBlock: {
    background: "rgba(13,22,44,0.7)",
    border: "1px solid rgba(56,189,248,0.1)",
    backdropFilter: "blur(6px)",
  },
};

// ─── Legend ───────────────────────────────────────────────────────────

function Legend({ showSection }) {
  const items = [
    {
      color: "rgba(56,189,248,0.15)",
      border: "rgba(56,189,248,0.4)",
      label: "Available",
    },
    { color: "#0284c7", border: "#38bdf8", label: "Selected" },
    { color: "#111827", border: "#1f2937", label: "Taken", dim: true },
  ];
  if (showSection) {
    items.push({
      color: "rgba(192,132,252,0.15)",
      border: "rgba(192,132,252,0.4)",
      label: "VIP",
    });
    items.push({
      color: "rgba(251,191,36,0.12)",
      border: "rgba(251,191,36,0.35)",
      label: "Premium",
    });
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px 20px",
        marginTop: 20,
      }}
    >
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            color: "#94a3b8",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: it.color,
              border: `1px solid ${it.border}`,
              opacity: it.dim ? 0.45 : 1,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────

function SummaryBar({ label, total, symbol, onConfirm, disabled }) {
  return (
    <div
      style={{
        marginTop: 20,
        background: "rgba(8,14,30,0.9)",
        border: "1px solid rgba(56,189,248,0.18)",
        borderRadius: 18,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Selection
        </p>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 13,
            fontWeight: 600,
            color: "#e2e8f0",
          }}
        >
          {label}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {total > 0 && (
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Total
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 15,
                fontWeight: 700,
                color: "#38bdf8",
              }}
            >
              {symbol}
              {total.toLocaleString()}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          style={{
            background: disabled
              ? "rgba(2,132,199,0.2)"
              : "linear-gradient(135deg,#0284c7,#0ea5e9)",
            border: "none",
            borderRadius: 12,
            color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 22px",
            cursor: disabled ? "not-allowed" : "pointer",
            letterSpacing: "0.04em",
            boxShadow: disabled ? "none" : "0 4px 20px rgba(14,165,233,0.35)",
            transition: "all 0.2s",
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Seat button ──────────────────────────────────────────────────────

function SeatBtn({ id, status, isSelected, onToggle, section }) {
  const cfg = sectionConfig(section);
  const isTaken = status === "taken";

  let bg, border, cursor, opacity;
  if (isTaken) {
    bg = "#111827";
    border = "#1f2937";
    cursor = "not-allowed";
    opacity = 0.4;
  } else if (isSelected) {
    bg = cfg.selectedBg;
    border = cfg.selectedBorder;
    cursor = "pointer";
    opacity = 1;
  } else {
    bg = cfg.accentBg;
    border = cfg.accentBorder;
    cursor = "pointer";
    opacity = 1;
  }

  return (
    <button
      type="button"
      title={isTaken ? "Unavailable" : id}
      disabled={isTaken}
      onClick={() => !isTaken && onToggle(id)}
      style={{
        width: "clamp(14px,2.2vw,20px)",
        height: "clamp(13px,2vw,18px)",
        borderRadius: 3,
        border: `1px solid ${border}`,
        background: bg,
        cursor,
        opacity,
        fontSize: 6,
        color: "transparent",
        flexShrink: 0,
        transition: "all 0.15s",
        padding: 0,
        outline: "none",
      }}
    />
  );
}

function SeatRow({ rowIndex, cols, seatMap, selected, onToggle, section }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "clamp(2px,0.4vw,3px)",
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: "#334155",
          width: 14,
          textAlign: "right",
          flexShrink: 0,
          fontFamily: "monospace",
        }}
      >
        {rowLetter(rowIndex)}
      </span>
      {Array.from({ length: cols }).map((_, c) => {
        const id = seatId(rowIndex, c);
        const status = seatMap?.[rowIndex]?.[c] ?? "taken";
        return (
          <SeatBtn
            key={id}
            id={id}
            status={status}
            isSelected={selected.includes(id)}
            onToggle={onToggle}
            section={section}
          />
        );
      })}
    </div>
  );
}

// ─── Stadium sections ─────────────────────────────────────────────────

const STADIUM_SECTIONS = [
  {
    id: "north",
    prefix: "N",
    label: "North Stand",
    rows: 6,
    cols: 20,
    section: "Standard",
  },
  {
    id: "south",
    prefix: "S",
    label: "South Stand",
    rows: 6,
    cols: 20,
    section: "Premium",
  },
  {
    id: "east",
    prefix: "E",
    label: "East End",
    rows: 5,
    cols: 10,
    section: "Standard",
  },
  {
    id: "west",
    prefix: "W",
    label: "West End",
    rows: 5,
    cols: 10,
    section: "VIP",
  },
];

function SectionLabel({ text, color = "#38bdf8" }) {
  return (
    <p
      style={{
        textAlign: "center",
        fontSize: 9,
        color,
        marginBottom: 4,
        marginTop: 0,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        fontWeight: 700,
      }}
    >
      {text}
    </p>
  );
}

function StadiumPicker({ event, selected, onToggle }) {
  const seatMaps = useMemo(
    () => buildSectionSeatMaps(STADIUM_SECTIONS, event?.seatingLayout ?? {}),
    [event],
  );

  const blockRadius = (tl = 0, tr = 0, br = 0, bl = 0) => ({
    ...css.sectionBlock,
    borderTopLeftRadius: tl,
    borderTopRightRadius: tr,
    borderBottomRightRadius: br,
    borderBottomLeftRadius: bl,
    padding: "10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "center",
    overflowX: "auto",
  });

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ margin: "0 auto", minWidth: 280, maxWidth: 560 }}>
        {/* North */}
        <div style={{ marginBottom: 4 }}>
          <SectionLabel text="North Stand · Standard" />
          <div
            style={{
              ...blockRadius(52, 52, 0, 0),
              width: "fit-content",
              margin: "0 auto",
            }}
          >
            {Array.from({ length: 6 }).map((_, r) => (
              <SeatRow
                key={r}
                rowIndex={r}
                cols={20}
                seatMap={seatMaps.north}
                selected={selected}
                onToggle={(id) => onToggle(`N-${id}`)}
                section="Standard"
              />
            ))}
          </div>
        </div>

        {/* Middle */}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* West VIP */}
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="W · VIP" color="#c084fc" />
            <div
              style={{
                ...css.sectionBlock,
                border: "1px solid rgba(192,132,252,0.2)",
                borderTopLeftRadius: 36,
                borderBottomLeftRadius: 36,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 5 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.west}
                  selected={selected}
                  onToggle={(id) => onToggle(`W-${id}`)}
                  section="VIP"
                />
              ))}
            </div>
          </div>

          {/* Pitch */}
          <div
            style={{
              flex: 1,
              minWidth: 70,
              maxWidth: 110,
              aspectRatio: "1",
              borderRadius: "50%",
              background:
                "radial-gradient(circle,rgba(21,128,61,0.18) 0%,rgba(21,128,61,0.05) 100%)",
              border: "1px solid rgba(21,128,61,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: "rgba(74,222,128,0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontWeight: 700,
              }}
            >
              Pitch
            </span>
          </div>

          {/* East */}
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="E · Standard" />
            <div
              style={{
                ...css.sectionBlock,
                borderTopRightRadius: 36,
                borderBottomRightRadius: 36,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 5 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.east}
                  selected={selected}
                  onToggle={(id) => onToggle(`E-${id}`)}
                  section="Standard"
                />
              ))}
            </div>
          </div>
        </div>

        {/* South */}
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              ...blockRadius(0, 0, 52, 52),
              width: "fit-content",
              margin: "0 auto",
              border: "1px solid rgba(251,191,36,0.15)",
            }}
          >
            {Array.from({ length: 6 }).map((_, r) => (
              <SeatRow
                key={r}
                rowIndex={r}
                cols={20}
                seatMap={seatMaps.south}
                selected={selected}
                onToggle={(id) => onToggle(`S-${id}`)}
                section="Premium"
              />
            ))}
          </div>
          <SectionLabel text="South Stand · Premium" color="#fbbf24" />
        </div>
      </div>
    </div>
  );
}

// ─── Concert sections ──────────────────────────────────────────────────

const CONCERT_SECTIONS = [
  { id: "left", label: "Left Block", rows: 8, cols: 10, section: "Standard" },
  {
    id: "centre",
    label: "Centre Block",
    rows: 10,
    cols: 16,
    section: "Premium",
  },
  { id: "right", label: "Right Block", rows: 8, cols: 10, section: "Standard" },
  {
    id: "left_bal",
    label: "Left Balcony",
    rows: 4,
    cols: 10,
    section: "Standard",
  },
  {
    id: "right_bal",
    label: "Right Balcony",
    rows: 4,
    cols: 10,
    section: "Standard",
  },
  {
    id: "floor",
    label: "Floor (GA)",
    rows: 0,
    cols: 0,
    section: "VIP",
    isGA: true,
    totalSpots: 80,
  },
];

function ConcertPicker({ event, selected, onToggle }) {
  const seatedSections = useMemo(
    () => CONCERT_SECTIONS.filter((s) => !s.isGA),
    [],
  );
  const seatMaps = useMemo(
    () => buildSectionSeatMaps(seatedSections, event?.seatingLayout ?? {}),
    [event, seatedSections],
  );

  const floorSelected = selected.filter((s) => s.startsWith("FLOOR-")).length;
  const floorTotalSpots = event?.seatingLayout?.floorAvailableSpots ?? 80;
  const canAddFloorSpot = floorSelected < floorTotalSpots;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ margin: "0 auto", minWidth: 300, maxWidth: 680 }}>
        {/* Stage */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: "8px 36px",
              background: "rgba(30,64,175,0.15)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 10,
              fontSize: 11,
              color: "rgba(147,197,253,0.8)",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 700,
            }}
          >
            Stage
          </div>
        </div>

        {/* Floor GA */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            disabled={!canAddFloorSpot}
            onClick={() => {
              if (!canAddFloorSpot) return;
              onToggle(`FLOOR-${floorSelected + 1}`);
            }}
            style={{
              background: "rgba(109,40,217,0.1)",
              border: "1px solid rgba(192,132,252,0.3)",
              borderRadius: 14,
              padding: "10px 20px",
              cursor: canAddFloorSpot ? "pointer" : "not-allowed",
              opacity: canAddFloorSpot ? 1 : 0.4,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#d8b4fe",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                fontWeight: 700,
              }}
            >
              Floor · VIP GA
            </p>
            <p
              style={{
                margin: "4px 0 6px",
                fontSize: 11,
                color: "rgba(196,181,253,0.6)",
              }}
            >
              {floorSelected} / {floorTotalSpots} spots
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                justifyContent: "center",
                maxWidth: 200,
              }}
            >
              {Array.from({ length: Math.min(floorSelected, 20) }).map(
                (_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#a855f7",
                      display: "inline-block",
                    }}
                  />
                ),
              )}
              {Array.from({
                length: Math.min(
                  Math.max(floorTotalSpots - floorSelected, 0),
                  20,
                ),
              }).map((_, i) => (
                <span
                  key={`e-${i}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#1a1f2e",
                    border: "1px solid #2d2a45",
                    display: "inline-block",
                  }}
                />
              ))}
            </div>
          </button>
        </div>

        {/* Main seating */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Left */}
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="Left" />
            <div
              style={{
                ...css.sectionBlock,
                borderTopLeftRadius: 32,
                borderBottomLeftRadius: 32,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 8 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.left}
                  selected={selected}
                  onToggle={(id) => onToggle(`L-${id}`)}
                  section="Standard"
                />
              ))}
            </div>
          </div>
          {/* Centre */}
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="Centre · Premium" color="#fbbf24" />
            <div
              style={{
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.18)",
                borderRadius: 10,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 10 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={16}
                  seatMap={seatMaps.centre}
                  selected={selected}
                  onToggle={(id) => onToggle(`C-${id}`)}
                  section="Premium"
                />
              ))}
            </div>
          </div>
          {/* Right */}
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="Right" />
            <div
              style={{
                ...css.sectionBlock,
                borderTopRightRadius: 32,
                borderBottomRightRadius: 32,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 8 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.right}
                  selected={selected}
                  onToggle={(id) => onToggle(`R-${id}`)}
                  section="Standard"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Balcony */}
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="Left Balcony" />
            <div
              style={{
                ...css.sectionBlock,
                borderBottomLeftRadius: 32,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 4 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.left_bal}
                  selected={selected}
                  onToggle={(id) => onToggle(`LB-${id}`)}
                  section="Standard"
                />
              ))}
            </div>
          </div>
          <div style={{ width: "clamp(60px,25vw,380px)" }} />
          <div style={{ flexShrink: 0 }}>
            <SectionLabel text="Right Balcony" />
            <div
              style={{
                ...css.sectionBlock,
                borderBottomRightRadius: 32,
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {Array.from({ length: 4 }).map((_, r) => (
                <SeatRow
                  key={r}
                  rowIndex={r}
                  cols={10}
                  seatMap={seatMaps.right_bal}
                  selected={selected}
                  onToggle={(id) => onToggle(`RB-${id}`)}
                  section="Standard"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GA picker ────────────────────────────────────────────────────────

function GAPicker({ event, gaSelections, onChangeGA }) {
  const types = event?.ticketTypes ?? [
    {
      id: "standard",
      label: "Standard Entry",
      price: event?.price?.min ?? 30,
      available: event?.availableTickets ?? 10,
    },
    {
      id: "vip",
      label: "VIP Access",
      price: event?.price?.max ?? 80,
      available: 20,
    },
  ];
  const sym = currencySymbol(event?.price?.currency);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {types.map((t) => {
        const qty = gaSelections[t.id] ?? 0;
        const soldOut = t.available === 0;
        const isSelected = qty > 0;
        return (
          <div
            key={t.id}
            style={{
              borderRadius: 18,
              border: `1px solid ${isSelected ? "rgba(56,189,248,0.45)" : soldOut ? "#1e293b" : "#1e293b"}`,
              background: isSelected
                ? "rgba(56,189,248,0.07)"
                : soldOut
                  ? "rgba(15,23,42,0.3)"
                  : "rgba(15,23,42,0.5)",
              padding: "clamp(12px,3vw,18px) clamp(14px,4vw,22px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              opacity: soldOut ? 0.45 : 1,
              transition: "all 0.2s",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(13px,3vw,15px)",
                  fontWeight: 700,
                  color: "#f1f5f9",
                }}
              >
                {t.label}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                {sym}
                {t.price.toLocaleString()} per ticket
                {!soldOut && (
                  <span style={{ marginLeft: 8, color: "#38bdf8" }}>
                    · {t.available} left
                  </span>
                )}
                {soldOut && (
                  <span style={{ marginLeft: 8, color: "#475569" }}>
                    · Sold out
                  </span>
                )}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
              }}
            >
              {[
                [-1, "−"],
                [+1, "+"],
              ].map(([delta, label], i) =>
                i === 0 ? (
                  <button
                    key={label}
                    type="button"
                    disabled={qty === 0 || soldOut}
                    onClick={() => onChangeGA(t.id, -1, t.available)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #1e293b",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 18,
                      cursor: qty === 0 || soldOut ? "not-allowed" : "pointer",
                      opacity: qty === 0 || soldOut ? 0.3 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      outline: "none",
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <button
                    key={label}
                    type="button"
                    disabled={qty >= t.available || soldOut}
                    onClick={() => onChangeGA(t.id, +1, t.available)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #1e293b",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 18,
                      cursor:
                        qty >= t.available || soldOut
                          ? "not-allowed"
                          : "pointer",
                      opacity: qty >= t.available || soldOut ? 0.3 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      outline: "none",
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
              <span
                style={{
                  minWidth: 22,
                  textAlign: "center",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#f1f5f9",
                }}
              >
                {qty}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────

export default function SeatPicker({ event, onConfirm }) {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [gaSelections, setGaSelections] = useState({});

  const venueType = useMemo(() => {
    if (event?.venueType) return event.venueType;
    const cat = (event?.category ?? "").toLowerCase();
    if (
      cat.includes("sport") ||
      cat.includes("football") ||
      cat.includes("soccer") ||
      cat.includes("rugby") ||
      cat.includes("athletics") ||
      cat.includes("cricket")
    )
      return "stadium";
    if (
      cat.includes("concert") ||
      cat.includes("music") ||
      cat.includes("show") ||
      cat.includes("theatre") ||
      cat.includes("theater")
    )
      return "concert";
    return "ga";
  }, [event]);

  const hasSeats = venueType === "stadium" || venueType === "concert";
  const pricePerSeat = event?.price?.min ?? event?.price?.max ?? 0;
  const sym = currencySymbol(event?.price?.currency);

  const toggleSeat = useCallback((id) => {
    setSelectedSeats((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }, []);

  const changeGA = useCallback((typeId, delta, max) => {
    setGaSelections((prev) => ({
      ...prev,
      [typeId]: Math.max(0, Math.min(max, (prev[typeId] ?? 0) + delta)),
    }));
  }, []);

  const seatsTotal = selectedSeats.length * pricePerSeat;

  const effectiveTypes = event?.ticketTypes ?? [
    {
      id: "standard",
      label: "Standard Entry",
      price: event?.price?.min ?? 30,
      available: event?.availableTickets ?? 10,
    },
    {
      id: "vip",
      label: "VIP Access",
      price: event?.price?.max ?? 80,
      available: 20,
    },
  ];

  const gaTotal = effectiveTypes.reduce(
    (acc, t) => acc + (gaSelections[t.id] ?? 0) * t.price,
    0,
  );
  const gaTotalQty = Object.values(gaSelections).reduce((a, b) => a + b, 0);

  const seatedAvailableCount = useMemo(() => {
    if (!hasSeats) return 0;
    const sections =
      venueType === "stadium"
        ? STADIUM_SECTIONS
        : CONCERT_SECTIONS.filter((s) => !s.isGA);
    const maps = buildSectionSeatMaps(sections, event?.seatingLayout ?? {});
    return Object.values(maps).reduce(
      (sum, map) => sum + map.flat().filter((s) => s === "available").length,
      0,
    );
  }, [event, hasSeats, venueType]);

  const summaryLabel = hasSeats
    ? selectedSeats.length === 0
      ? "No seats selected"
      : `${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} — ${selectedSeats.slice(0, 4).join(", ")}${selectedSeats.length > 4 ? "…" : ""}`
    : gaTotalQty === 0
      ? "No tickets selected"
      : `${gaTotalQty} ticket${gaTotalQty > 1 ? "s" : ""} selected`;

  const confirmDisabled = hasSeats
    ? selectedSeats.length === 0
    : gaTotalQty === 0;

  const handleConfirm = () => {
    if (hasSeats) {
      onConfirm?.({
        seats: selectedSeats,
        totalPrice: seatsTotal,
        currency: event?.price?.currency ?? "USD",
      });
    } else {
      onConfirm?.({
        tickets: effectiveTypes
          .filter((t) => (gaSelections[t.id] ?? 0) > 0)
          .map((t) => ({
            typeId: t.id,
            label: t.label,
            qty: gaSelections[t.id],
            price: t.price,
          })),
        totalPrice: gaTotal,
        currency: event?.price?.currency ?? "USD",
      });
    }
  };

  const venueLabel = {
    stadium: "Stadium seating",
    concert: "Concert / arena",
    ga: "General admission",
  }[venueType];

  // Tier badge
  const tierBadges = {
    stadium: [
      { label: "Standard", color: "#38bdf8" },
      { label: "Premium", color: "#fbbf24" },
      { label: "VIP", color: "#c084fc" },
    ],
    concert: [
      { label: "Standard", color: "#38bdf8" },
      { label: "Premium", color: "#fbbf24" },
      { label: "VIP Floor", color: "#c084fc" },
    ],
    ga: [],
  };

  return (
    <div style={css.card}>
      {/* Header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: "#38bdf8",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 700,
            }}
          >
            KivraTickets
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "clamp(15px,4vw,20px)",
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.02em",
            }}
          >
            {event?.name ?? "Choose Your Seats"}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
            {venueLabel}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tierBadges[venueType]?.map((b) => (
            <span
              key={b.label}
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                padding: "4px 10px",
                borderRadius: 20,
                background: b.color + "18",
                border: `1px solid ${b.color}50`,
                color: b.color,
                textTransform: "uppercase",
              }}
            >
              {b.label}
            </span>
          ))}
          {hasSeats && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 20,
                background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(56,189,248,0.2)",
                color: "#94a3b8",
              }}
            >
              {seatedAvailableCount} available
              {pricePerSeat > 0 && (
                <>
                  {" "}
                  · from{" "}
                  <span style={{ color: "#38bdf8" }}>
                    {sym}
                    {pricePerSeat.toLocaleString()}
                  </span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg,transparent,rgba(56,189,248,0.2) 30%,rgba(56,189,248,0.2) 70%,transparent)",
          marginBottom: 20,
        }}
      />

      {/* Picker */}
      {venueType === "stadium" && (
        <StadiumPicker
          event={event}
          selected={selectedSeats}
          onToggle={toggleSeat}
        />
      )}
      {venueType === "concert" && (
        <ConcertPicker
          event={event}
          selected={selectedSeats}
          onToggle={toggleSeat}
        />
      )}
      {venueType === "ga" && (
        <GAPicker
          event={event}
          gaSelections={gaSelections}
          onChangeGA={changeGA}
        />
      )}

      {hasSeats && <Legend showSection />}
      <SummaryBar
        label={summaryLabel}
        total={hasSeats ? seatsTotal : gaTotal}
        symbol={sym}
        onConfirm={handleConfirm}
        disabled={confirmDisabled}
      />
    </div>
  );
}
