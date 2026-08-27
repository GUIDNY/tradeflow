import React from "react";
import { cn } from "@/lib/utils";

// The catalog ships without photography, so every product gets a generated
// illustration built from its own palette. Same viewBox everywhere keeps the
// grid perfectly aligned.
const uid = (id, suffix) => `art-${id}-${suffix}`;

const NfcWaves = ({ x, y, color, scale = 1, opacity = 0.9 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} fill="none" stroke={color} strokeLinecap="round">
    <path d="M0 -6 A 9 9 0 0 1 0 6" strokeWidth="2.4" />
    <path d="M5 -12 A 16 16 0 0 1 5 12" strokeWidth="2.4" opacity="0.75" />
    <path d="M10 -18 A 23 23 0 0 1 10 18" strokeWidth="2.4" opacity="0.5" />
  </g>
);

const shapes = {
  card: (id, [deep, mid, glow]) => (
    <>
      <g transform="rotate(-9 200 150)">
        <rect x="72" y="86" width="256" height="150" rx="16" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
        <rect x="72" y="86" width="256" height="150" rx="16" fill={`url(#${uid(id, "sheen")})`} />
        <rect x="96" y="112" width="72" height="10" rx="5" fill={glow} opacity="0.9" />
        <rect x="96" y="132" width="120" height="7" rx="3.5" fill="#fff" opacity="0.35" />
        <rect x="96" y="148" width="94" height="7" rx="3.5" fill="#fff" opacity="0.2" />
        <rect x="96" y="186" width="46" height="30" rx="6" fill={glow} opacity="0.18" stroke={glow} strokeOpacity="0.5" />
        <path d="M104 200h10M104 208h18M114 192v20" stroke={glow} strokeWidth="2" opacity="0.8" />
        <NfcWaves x={272} y={196} color={glow} scale={1.15} />
      </g>
      <circle cx="322" cy="78" r="34" fill={glow} opacity="0.12" />
    </>
  ),
  stand: (id, [deep, mid, glow]) => (
    <>
      <path d="M126 244h148l-14 26H140z" fill={mid} opacity="0.65" />
      <rect x="118" y="46" width="164" height="200" rx="14" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
      <rect x="118" y="46" width="164" height="200" rx="14" fill={`url(#${uid(id, "sheen")})`} />
      <g transform="translate(200 108)">
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            transform={`translate(${(i - 2) * 26} 0)`}
            d="M0 -11l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L0 6.4l-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z"
            fill={glow}
            opacity={0.95 - i * 0.02}
          />
        ))}
      </g>
      <rect x="150" y="140" width="100" height="8" rx="4" fill="#fff" opacity="0.3" />
      <rect x="166" y="158" width="68" height="8" rx="4" fill="#fff" opacity="0.18" />
      <circle cx="200" cy="204" r="27" fill={glow} opacity="0.14" stroke={glow} strokeOpacity="0.45" />
      <NfcWaves x={188} y={204} color={glow} scale={1} />
    </>
  ),
  tag: (id, [deep, mid, glow]) => (
    <>
      <circle cx="200" cy="156" r="86" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.4" />
      <circle cx="200" cy="156" r="86" fill={`url(#${uid(id, "sheen")})`} />
      <circle cx="200" cy="156" r="66" fill="none" stroke={glow} strokeOpacity="0.35" strokeDasharray="5 9" />
      <circle cx="200" cy="76" r="14" fill="none" stroke={glow} strokeWidth="7" strokeOpacity="0.8" />
      <NfcWaves x={182} y={156} color={glow} scale={1.7} />
      <circle cx="296" cy="88" r="30" fill={glow} opacity="0.12" />
    </>
  ),
  sticker: (id, [deep, mid, glow]) => (
    <>
      {[
        { x: 108, y: 118, r: -14 },
        { x: 178, y: 96, r: 6 },
        { x: 244, y: 132, r: 18 },
      ].map((c, i) => (
        <g key={i} transform={`rotate(${c.r} ${c.x + 48} ${c.y + 48})`}>
          <circle cx={c.x + 48} cy={c.y + 48} r="52" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.4" />
          <circle cx={c.x + 48} cy={c.y + 48} r="52" fill={`url(#${uid(id, "sheen")})`} />
          <circle cx={c.x + 48} cy={c.y + 48} r="38" fill="none" stroke={glow} strokeOpacity="0.3" strokeDasharray="4 7" />
          <NfcWaves x={c.x + 34} y={c.y + 48} color={glow} scale={1.1} opacity={0.85} />
        </g>
      ))}
    </>
  ),
  poster: (id, [deep, mid, glow]) => (
    <>
      <rect x="118" y="40" width="164" height="216" rx="8" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
      <rect x="118" y="40" width="164" height="216" rx="8" fill={`url(#${uid(id, "sheen")})`} />
      <rect x="140" y="66" width="88" height="14" rx="7" fill={glow} opacity="0.85" />
      <rect x="140" y="92" width="120" height="8" rx="4" fill="#fff" opacity="0.28" />
      <rect x="140" y="108" width="96" height="8" rx="4" fill="#fff" opacity="0.18" />
      <rect x="140" y="140" width="120" height="66" rx="8" fill={glow} opacity="0.12" stroke={glow} strokeOpacity="0.3" />
      <NfcWaves x={176} y={173} color={glow} scale={1.4} />
      <circle cx="262" cy="228" r="14" fill={glow} opacity="0.25" />
    </>
  ),
  ring: (id, [deep, mid, glow]) => (
    <>
      <ellipse cx="200" cy="156" rx="88" ry="88" fill={`url(#${uid(id, "body")})`} />
      <ellipse cx="200" cy="156" rx="88" ry="88" fill={`url(#${uid(id, "sheen")})`} />
      <ellipse cx="200" cy="156" rx="54" ry="54" fill="#0b0f19" />
      <ellipse cx="200" cy="150" rx="54" ry="54" fill="none" stroke={glow} strokeOpacity="0.3" strokeWidth="2" />
      <path d="M200 68a88 88 0 0 1 74 40" stroke={glow} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
      <NfcWaves x={296} y={92} color={glow} scale={1.1} />
    </>
  ),
  wristband: (id, [deep, mid, glow]) => (
    <>
      <path
        d="M112 96c0-16 40-28 88-28s88 12 88 28v112c0 16-40 28-88 28s-88-12-88-28z"
        fill={`url(#${uid(id, "body")})`}
        stroke={glow}
        strokeOpacity="0.35"
      />
      <path d="M112 96c0-16 40-28 88-28s88 12 88 28v112c0 16-40 28-88 28s-88-12-88-28z" fill={`url(#${uid(id, "sheen")})`} />
      <ellipse cx="200" cy="96" rx="88" ry="28" fill="#0b0f19" opacity="0.55" />
      <ellipse cx="200" cy="96" rx="62" ry="19" fill={deep} />
      <rect x="164" y="150" width="72" height="46" rx="10" fill={glow} opacity="0.16" stroke={glow} strokeOpacity="0.45" />
      <NfcWaves x={186} y={173} color={glow} scale={1.05} />
    </>
  ),
  keychain: (id, [deep, mid, glow]) => (
    <>
      <circle cx="152" cy="84" r="22" fill="none" stroke={mid} strokeWidth="8" />
      <path d="M168 100l22 22" stroke={mid} strokeWidth="8" strokeLinecap="round" />
      <rect x="150" y="112" width="140" height="140" rx="26" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
      <rect x="150" y="112" width="140" height="140" rx="26" fill={`url(#${uid(id, "sheen")})`} />
      <rect x="174" y="140" width="60" height="9" rx="4.5" fill={glow} opacity="0.85" />
      <rect x="174" y="158" width="88" height="7" rx="3.5" fill="#fff" opacity="0.22" />
      <NfcWaves x={206} y={206} color={glow} scale={1.35} />
    </>
  ),
  phonestand: (id, [deep, mid, glow]) => (
    <>
      <path d="M112 252h176l-10-18H122z" fill={mid} opacity="0.7" />
      <path d="M140 234L196 62h30l-56 172z" fill={mid} opacity="0.45" />
      <g transform="rotate(10 210 150)">
        <rect x="152" y="52" width="118" height="184" rx="18" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.4" />
        <rect x="152" y="52" width="118" height="184" rx="18" fill={`url(#${uid(id, "sheen")})`} />
        <rect x="166" y="74" width="90" height="140" rx="10" fill="#050914" opacity="0.6" />
        <rect x="196" y="60" width="30" height="6" rx="3" fill={glow} opacity="0.4" />
        <NfcWaves x={198} y={146} color={glow} scale={1.5} />
      </g>
      <circle cx="112" cy="94" r="30" fill={glow} opacity="0.12" />
    </>
  ),
  reader: (id, [deep, mid, glow]) => (
    <>
      <rect x="96" y="112" width="208" height="128" rx="20" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
      <rect x="96" y="112" width="208" height="128" rx="20" fill={`url(#${uid(id, "sheen")})`} />
      <rect x="128" y="140" width="144" height="72" rx="14" fill={glow} opacity="0.12" stroke={glow} strokeOpacity="0.35" />
      <NfcWaves x={182} y={176} color={glow} scale={1.6} />
      <circle cx="120" cy="228" r="5" fill={glow} />
      <path d="M304 152h34a12 12 0 0 1 12 12v14" stroke={mid} strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="336" y="176" width="30" height="18" rx="4" fill={mid} />
      <g transform="rotate(-16 168 92)">
        <rect x="126" y="66" width="120" height="72" rx="10" fill={deep} stroke={glow} strokeOpacity="0.5" />
        <rect x="140" y="82" width="44" height="7" rx="3.5" fill={glow} opacity="0.7" />
        <rect x="140" y="96" width="66" height="6" rx="3" fill="#fff" opacity="0.2" />
      </g>
    </>
  ),
  bundle: (id, [deep, mid, glow]) => (
    <>
      <rect x="86" y="128" width="228" height="122" rx="18" fill={`url(#${uid(id, "body")})`} stroke={glow} strokeOpacity="0.35" />
      <rect x="86" y="128" width="228" height="122" rx="18" fill={`url(#${uid(id, "sheen")})`} />
      <path d="M86 168h228" stroke={glow} strokeOpacity="0.3" />
      <path d="M200 128v122" stroke={glow} strokeOpacity="0.3" />
      <g transform="rotate(-12 150 96)">
        <rect x="104" y="66" width="104" height="62" rx="10" fill={deep} stroke={glow} strokeOpacity="0.5" />
        <rect x="118" y="82" width="40" height="7" rx="3.5" fill={glow} opacity="0.8" />
        <rect x="118" y="96" width="60" height="6" rx="3" fill="#fff" opacity="0.22" />
      </g>
      <g transform="rotate(14 262 100)">
        <rect x="222" y="72" width="80" height="56" rx="10" fill={mid} stroke={glow} strokeOpacity="0.4" />
        <NfcWaves x={250} y={100} color={glow} scale={0.9} />
      </g>
      <NfcWaves x={186} y={210} color={glow} scale={1.2} />
    </>
  ),
};

export default function ProductArt({ product, className }) {
  const palette = product.palette || ["#0f172a", "#334155", "#22d3ee"];
  const [deep, mid, glow] = palette;
  const draw = shapes[product.art] || shapes.card;

  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label={product.name}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={uid(product.id, "bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={deep} />
          <stop offset="100%" stopColor="#05070f" />
        </linearGradient>
        <linearGradient id={uid(product.id, "body")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={mid} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
        <linearGradient id={uid(product.id, "sheen")} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id={uid(product.id, "halo")} cx="0.7" cy="0.25" r="0.75">
          <stop offset="0%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${uid(product.id, "bg")})`} />
      <rect width="400" height="300" fill={`url(#${uid(product.id, "halo")})`} />
      {draw(product.id, palette)}
    </svg>
  );
}
