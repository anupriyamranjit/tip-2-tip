"use client";

import { useState } from "react";
import { members, itinerary } from "@/lib/mock-data";

/* ------------------------------------------------------------------ */
/*  Local data for discovery & map                                     */
/* ------------------------------------------------------------------ */

type Category = "All" | "Food" | "Culture" | "Nature" | "Shopping";

interface DiscoveryPlace {
  id: string;
  name: string;
  description: string;
  category: Category;
  pinX: number;
  pinY: number;
  pinColor: string;
  gradient: string;
}

const discoveryPlaces: DiscoveryPlace[] = [
  {
    id: "d1",
    name: "Blue Grotto Boat Tour",
    description:
      "Glide through luminous sea caves on a traditional wooden boat at golden hour.",
    category: "Nature",
    pinX: 28,
    pinY: 35,
    pinColor: "#059669",
    gradient: "linear-gradient(135deg, #065f46 0%, #34d399 100%)",
  },
  {
    id: "d2",
    name: "Villa Cimbrone Gardens",
    description:
      "Wander the Terrace of Infinity with sweeping views over the coastline.",
    category: "Culture",
    pinX: 55,
    pinY: 22,
    pinColor: "#7c3aed",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #7c3aed 100%)",
  },
  {
    id: "d3",
    name: "Positano Beach Club",
    description:
      "Sun-soaked loungers, Aperol spritzes, and a soundtrack of gentle waves.",
    category: "Nature",
    pinX: 40,
    pinY: 58,
    pinColor: "#059669",
    gradient: "linear-gradient(135deg, #ea580c 0%, #fbbf24 100%)",
  },
  {
    id: "d4",
    name: "Chatuchak Market",
    description:
      "Over 15,000 stalls of street food, vintage finds, and local crafts.",
    category: "Shopping",
    pinX: 72,
    pinY: 42,
    pinColor: "#dc2626",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
  },
  {
    id: "d5",
    name: "Wat Arun Temple",
    description:
      "Khmer-style spires encrusted with porcelain mosaics, best at sunset.",
    category: "Culture",
    pinX: 65,
    pinY: 68,
    pinColor: "#7c3aed",
    gradient: "linear-gradient(135deg, #312e81 0%, #818cf8 100%)",
  },
  {
    id: "d6",
    name: "Yaowarat Night Bites",
    description:
      "Bangkok\u2019s Chinatown comes alive after dark with sizzling wok hei and fresh seafood.",
    category: "Food",
    pinX: 48,
    pinY: 78,
    pinColor: "#ea580c",
    gradient: "linear-gradient(135deg, #dc2626 0%, #fb923c 100%)",
  },
];

const categoryFilters: Category[] = [
  "All",
  "Food",
  "Culture",
  "Nature",
  "Shopping",
];

interface ShortlistItem {
  id: string;
  name: string;
  votes: number;
}

const initialShortlist: ShortlistItem[] = [
  { id: "d1", name: "Blue Grotto Boat Tour", votes: 3 },
  { id: "d5", name: "Wat Arun Temple", votes: 2 },
  { id: "d4", name: "Chatuchak Market", votes: 1 },
];

const navTabs = [
  { key: "MAP", icon: "\uD83D\uDDFA\uFE0F" },
  { key: "ITINERARY", icon: "\uD83D\uDCCB" },
  { key: "EXPENSES", icon: "\uD83D\uDCB0" },
  { key: "VAULT", icon: "\uD83D\uDCCE" },
  { key: "SETTINGS", icon: "\u2699\uFE0F" },
] as const;

/* ------------------------------------------------------------------ */
/*  Route path (SVG) connecting some pins                              */
/* ------------------------------------------------------------------ */

function routePath(places: DiscoveryPlace[]) {
  const connected = [places[0], places[2], places[5], places[4], places[1]];
  if (connected.some((p) => !p)) return "";
  const pts = connected.map((p) => `${p.pinX},${p.pinY}`);
  return `M ${pts.join(" L ")}`;
}

/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */

export default function MapPage() {
  const [activeTab, setActiveTab] =
    useState<(typeof navTabs)[number]["key"]>("MAP");
  const [activeFilter, setActiveFilter] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [shortlist, setShortlist] =
    useState<ShortlistItem[]>(initialShortlist);
  const [expandedPin, setExpandedPin] = useState<string>("d2");

  /* derived */
  const filtered = discoveryPlaces.filter((p) => {
    const matchCat = activeFilter === "All" || p.category === activeFilter;
    const matchSearch =
      search === "" || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const isShortlisted = (id: string) => shortlist.some((s) => s.id === id);

  function addToShortlist(place: DiscoveryPlace) {
    if (isShortlisted(place.id)) return;
    setShortlist((prev) => [
      ...prev,
      { id: place.id, name: place.name, votes: 0 },
    ]);
  }

  function vote(id: string, delta: number) {
    setShortlist((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, votes: Math.max(0, s.votes + delta) } : s
      )
    );
  }

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      {/* ============================================================ */}
      {/*  LEFT NAV SIDEBAR (narrow)                                    */}
      {/* ============================================================ */}
      <aside
        className="flex flex-col items-center bg-surface-lowest shrink-0 py-6 gap-1"
        style={{ width: 200 }}
      >
        {/* Brand */}
        <p className="label-stamp text-[10px] text-on-surface-variant tracking-[0.08em] mb-6 px-4 text-center leading-tight">
          EDITORIAL
          <br />
          WANDERLUST
        </p>

        {/* Vertical nav tabs */}
        <nav className="flex flex-col gap-1 w-full px-3">
          {navTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                activeTab === t.key
                  ? "gradient-cta text-on-primary shadow-float"
                  : "text-on-surface-variant hover:bg-surface-low"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span className="label-stamp text-[10px]">{t.key}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ============================================================ */}
      {/*  CENTER — MAP AREA                                            */}
      {/* ============================================================ */}
      <main className="flex-1 relative overflow-hidden">
        {/* ---------- Illustrated Map Background ---------- */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Base water */}
          <rect width="100%" height="100%" fill="#b8d4e8" />

          {/* Deeper water zones */}
          <ellipse cx="10%" cy="85%" rx="220" ry="140" fill="#9ec5db" />
          <ellipse cx="90%" cy="15%" rx="180" ry="120" fill="#9ec5db" />
          <ellipse cx="50%" cy="95%" rx="400" ry="100" fill="#91bdd4" />

          {/* Main landmass */}
          <path
            d="M 80,60 Q 120,20 280,30 Q 400,10 550,50 Q 680,40 800,70 Q 900,90 950,150
               Q 1000,220 980,320 Q 960,400 900,460 Q 820,520 720,540
               Q 600,560 480,530 Q 380,510 300,480 Q 200,440 140,380
               Q 80,320 60,250 Q 40,180 50,120 Q 55,80 80,60 Z"
            fill="#d4e6c3"
          />
          {/* Secondary landmass */}
          <path
            d="M 700,300 Q 750,260 850,280 Q 940,290 1000,340 Q 1060,390 1040,460
               Q 1020,520 960,560 Q 880,590 800,570 Q 730,550 690,500
               Q 650,450 660,380 Q 670,330 700,300 Z"
            fill="#d4e6c3"
          />
          {/* Lighter land patches (parks/green areas) */}
          <ellipse cx="400" cy="280" rx="120" ry="80" fill="#e8f0de" />
          <ellipse cx="650" cy="400" rx="90" ry="60" fill="#e8f0de" />
          <ellipse cx="250" cy="180" rx="70" ry="50" fill="#e8f0de" />
          <ellipse cx="820" cy="370" rx="60" ry="45" fill="#dce8d0" />

          {/* River / canal */}
          <path
            d="M 300,30 Q 320,120 350,200 Q 370,280 340,360 Q 310,440 280,530"
            fill="none"
            stroke="#a8cfe0"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M 600,50 Q 580,130 590,210 Q 610,300 640,380 Q 660,450 680,540"
            fill="none"
            stroke="#a8cfe0"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Road network */}
          <g stroke="#f0f0e8" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round">
            <path d="M 100,100 Q 250,90 400,120 Q 550,150 700,140 Q 850,130 950,160" />
            <path d="M 150,200 Q 300,210 450,250 Q 600,280 750,270 Q 900,260 980,300" />
            <path d="M 120,350 Q 280,330 440,360 Q 600,390 760,380 Q 900,370 980,420" />
            <path d="M 200,450 Q 350,440 500,460 Q 650,480 800,470 Q 900,460 960,500" />
          </g>
          <g stroke="#e8e6dc" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round">
            <path d="M 250,80 L 270,200 L 300,320 L 280,440" />
            <path d="M 500,60 L 480,180 L 500,300 L 520,420 L 500,530" />
            <path d="M 750,80 L 730,190 L 760,310 L 740,430 L 760,530" />
            <path d="M 400,100 L 450,200 L 420,300 L 460,400 L 440,500" />
          </g>

          {/* Area labels */}
          <text x="300" y="180" fill="#6b8f5e" fontSize="13" fontWeight="600" opacity="0.5" transform="rotate(-8, 300, 180)" fontFamily="var(--font-body)">
            Silom
          </text>
          <text x="500" y="300" fill="#6b8f5e" fontSize="13" fontWeight="600" opacity="0.5" transform="rotate(4, 500, 300)" fontFamily="var(--font-body)">
            Chinatown
          </text>
          <text x="200" y="320" fill="#6b8f5e" fontSize="12" fontWeight="600" opacity="0.45" transform="rotate(-5, 200, 320)" fontFamily="var(--font-body)">
            Old City
          </text>
          <text x="720" y="350" fill="#6b8f5e" fontSize="12" fontWeight="600" opacity="0.45" transform="rotate(6, 720, 350)" fontFamily="var(--font-body)">
            Thonburi
          </text>
          <text x="600" y="150" fill="#6b8f5e" fontSize="11" fontWeight="600" opacity="0.4" transform="rotate(-3, 600, 150)" fontFamily="var(--font-body)">
            Chatuchak
          </text>
          <text x="140" y="250" fill="#7799aa" fontSize="10" fontWeight="600" opacity="0.4" fontFamily="var(--font-body)">
            Chao Phraya
          </text>
        </svg>

        {/* ---------- Route SVG overlay ---------- */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={routePath(discoveryPlaces)}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="0.3"
            strokeDasharray="1 0.6"
            opacity="0.55"
          />
        </svg>

        {/* ---------- Map Pins ---------- */}
        {discoveryPlaces.map((place, idx) => {
          const isExpanded = expandedPin === place.id;
          return (
            <div
              key={place.id}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `${place.pinX}%`,
                top: `${place.pinY}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              {/* Tooltip card */}
              {isExpanded && (
                <div className="bg-surface-lowest rounded-xl p-3.5 shadow-float mb-2 min-w-[190px] pointer-events-auto">
                  <h4 className="font-display font-bold text-sm text-on-surface tracking-editorial mb-1.5">
                    {place.name}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span
                      className="label-stamp text-[9px] px-2 py-0.5 rounded-full text-on-primary"
                      style={{ backgroundColor: place.pinColor }}
                    >
                      {place.category.toUpperCase()}
                    </span>
                    {isShortlisted(place.id) ? (
                      <span className="label-stamp text-[9px] bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-full">
                        SHORTLISTED
                      </span>
                    ) : (
                      <button
                        onClick={() => addToShortlist(place)}
                        className="text-primary text-[10px] font-semibold hover:underline"
                      >
                        Add to Shortlist
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Pin dot */}
              <button
                onClick={() =>
                  setExpandedPin(isExpanded ? "" : place.id)
                }
                className="w-6 h-6 rounded-full shadow-float flex items-center justify-center cursor-pointer transition-transform hover:scale-125"
                style={{ backgroundColor: place.pinColor }}
              >
                <span className="text-white text-[10px] font-bold">
                  {idx + 1}
                </span>
              </button>

              {/* Label below pin */}
              {!isExpanded && (
                <span className="label-stamp text-[8px] text-on-surface-variant mt-1 whitespace-nowrap bg-surface-lowest/80 px-1.5 py-0.5 rounded">
                  {place.name}
                </span>
              )}
            </div>
          );
        })}

        {/* ---- Member avatars (top-left) ---- */}
        <div className="absolute top-6 left-6 z-20 flex -space-x-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-float"
              style={{ backgroundColor: m.color }}
              title={m.name}
            >
              {m.avatar}
            </div>
          ))}
        </div>

        {/* ---- Filter toggle (top-right) ---- */}
        <div className="absolute top-6 right-6 z-20">
          <button className="glass rounded-xl px-4 py-2 shadow-float label-stamp text-[11px] text-on-surface flex items-center gap-2 hover:bg-surface-lowest/90 transition-colors">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            FILTER PINS
          </button>
        </div>

        {/* ---- Location badge (bottom-left) ---- */}
        <div className="absolute bottom-6 left-6 bg-surface-lowest rounded-xl px-4 py-3 shadow-float z-20">
          <p className="font-display font-bold text-on-surface text-sm tracking-editorial">
            Bangkok, Thailand
          </p>
          <p className="label-stamp text-[10px] text-on-surface-variant mt-0.5">
            13.7563&deg; N, 100.5018&deg; E
          </p>
        </div>

        {/* ---- Zoom controls (bottom-right) ---- */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
          <button className="w-10 h-10 bg-surface-lowest rounded-xl shadow-float flex items-center justify-center text-on-surface text-lg font-bold hover:bg-surface-highest transition-colors">
            +
          </button>
          <button className="w-10 h-10 bg-surface-lowest rounded-xl shadow-float flex items-center justify-center text-on-surface text-lg font-bold hover:bg-surface-highest transition-colors">
            &minus;
          </button>
        </div>
      </main>

      {/* ============================================================ */}
      {/*  RIGHT SIDEBAR — Discovery & Shortlist                        */}
      {/* ============================================================ */}
      <aside
        className="flex flex-col bg-surface-lowest shrink-0 overflow-hidden"
        style={{ width: 320 }}
      >
        {/* Discovery header */}
        <div className="px-5 pt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl font-bold tracking-editorial text-on-surface">
              Discovery
            </h2>
            <span className="label-stamp text-[10px] text-on-surface-variant">
              FILTER BY GROUP
            </span>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full bg-surface-low rounded-2xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none mb-3"
          />

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            {categoryFilters.map((c) => (
              <button
                key={c}
                onClick={() => setActiveFilter(c)}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                  activeFilter === c
                    ? "gradient-cta text-on-primary"
                    : "bg-surface-low text-on-surface-variant hover:bg-surface-highest"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* Discovery cards */}
          <div className="flex flex-col gap-3 mb-6">
            {filtered.map((place) => (
              <div
                key={place.id}
                className="bg-surface-lowest rounded-2xl p-4 shadow-float"
                onMouseEnter={() => setExpandedPin(place.id)}
              >
                {/* Image preview */}
                <div
                  className="h-20 rounded-xl mb-3"
                  style={{ background: place.gradient }}
                />

                <h3 className="font-display font-bold text-on-surface text-[15px] tracking-editorial mb-1">
                  {place.name}
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-2.5">
                  {place.description}
                </p>
                {isShortlisted(place.id) ? (
                  <span className="label-stamp text-[10px] text-on-tertiary-container bg-tertiary-container px-2.5 py-1 rounded-full">
                    SHORTLISTED &#10003;
                  </span>
                ) : (
                  <button
                    onClick={() => addToShortlist(place)}
                    className="text-primary text-xs font-semibold hover:underline"
                  >
                    Add to Shortlist
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Shortlist section */}
          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="font-display text-lg font-bold tracking-editorial text-on-surface">
                Shortlist
              </h2>
              <span className="label-stamp text-[10px] text-on-surface-variant bg-surface-low px-2 py-0.5 rounded-full">
                {shortlist.length} ITEMS
              </span>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {shortlist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-surface-low rounded-2xl px-4 py-3"
                >
                  <span className="font-display text-sm font-semibold text-on-surface tracking-editorial">
                    {item.name}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => vote(item.id, 1)}
                      className="text-primary text-xs leading-none hover:text-primary-container"
                      aria-label="Upvote"
                    >
                      &#9650;
                    </button>
                    <span className="text-xs font-bold text-on-surface min-w-[16px] text-center">
                      {item.votes}
                    </span>
                    <button
                      onClick={() => vote(item.id, -1)}
                      className="text-primary text-xs leading-none hover:text-primary-container"
                      aria-label="Downvote"
                    >
                      &#9660;
                    </button>

                    <span className="mx-1 text-surface-dim">|</span>

                    <button className="text-primary text-[11px] font-semibold hover:underline whitespace-nowrap">
                      Add to Itinerary
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky CTA at bottom */}
        <div className="px-5 pb-5 pt-2">
          <button className="w-full gradient-cta text-on-primary font-semibold text-sm py-3 rounded-full shadow-float hover:opacity-95 transition-opacity">
            Add Top Picks to Itinerary
          </button>
        </div>
      </aside>
    </div>
  );
}
