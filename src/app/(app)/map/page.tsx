"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { members } from "@/lib/mock-data";
import type { MapPlace } from "@/components/leaflet-map";

/* ------------------------------------------------------------------ */
/*  Dynamically import Leaflet map (requires window — no SSR)          */
/* ------------------------------------------------------------------ */

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-low">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
        <p className="label-stamp text-[11px] text-on-surface-variant">
          LOADING MAP&hellip;
        </p>
      </div>
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/*  Import Leaflet CSS globally (needed for tiles & popups)            */
/* ------------------------------------------------------------------ */

import "leaflet/dist/leaflet.css";

/* ------------------------------------------------------------------ */
/*  Local data for discovery & map                                     */
/* ------------------------------------------------------------------ */

type Category = "All" | "Food" | "Culture" | "Nature" | "Shopping";

interface DiscoveryPlace {
  id: string;
  name: string;
  description: string;
  category: Category;
  lat: number;
  lng: number;
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
    lat: 13.7245,
    lng: 100.4823,
    pinColor: "#059669",
    gradient: "linear-gradient(135deg, #065f46 0%, #34d399 100%)",
  },
  {
    id: "d2",
    name: "Villa Cimbrone Gardens",
    description:
      "Wander the Terrace of Infinity with sweeping views over the coastline.",
    category: "Culture",
    lat: 13.7516,
    lng: 100.4927,
    pinColor: "#7c3aed",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #7c3aed 100%)",
  },
  {
    id: "d3",
    name: "Positano Beach Club",
    description:
      "Sun-soaked loungers, Aperol spritzes, and a soundtrack of gentle waves.",
    category: "Nature",
    lat: 13.7437,
    lng: 100.5127,
    pinColor: "#059669",
    gradient: "linear-gradient(135deg, #ea580c 0%, #fbbf24 100%)",
  },
  {
    id: "d4",
    name: "Chatuchak Market",
    description:
      "Over 15,000 stalls of street food, vintage finds, and local crafts.",
    category: "Shopping",
    lat: 13.7999,
    lng: 100.5531,
    pinColor: "#dc2626",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
  },
  {
    id: "d5",
    name: "Wat Arun Temple",
    description:
      "Khmer-style spires encrusted with porcelain mosaics, best at sunset.",
    category: "Culture",
    lat: 13.7437,
    lng: 100.4888,
    pinColor: "#7c3aed",
    gradient: "linear-gradient(135deg, #312e81 0%, #818cf8 100%)",
  },
  {
    id: "d6",
    name: "Yaowarat Night Bites",
    description:
      "Bangkok\u2019s Chinatown comes alive after dark with sizzling wok hei and fresh seafood.",
    category: "Food",
    lat: 13.7387,
    lng: 100.5098,
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

/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */

export default function MapPage() {
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

  /* Map places with callbacks */
  const mapPlaces: MapPlace[] = filtered.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    pinColor: p.pinColor,
    gradient: p.gradient,
    isShortlisted: isShortlisted(p.id),
    onAddToShortlist: () => addToShortlist(p),
    onHover: () => setExpandedPin(p.id),
  }));

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      {/* ============================================================ */}
      {/*  CENTER — LEAFLET MAP                                         */}
      {/* ============================================================ */}
      <main className="flex-1 relative overflow-hidden">
        <LeafletMap
          places={mapPlaces}
          expandedPin={expandedPin}
          onPinClick={(id) =>
            setExpandedPin((prev) => (prev === id ? "" : id))
          }
        />

        {/* ---- Member avatars (top-left) ---- */}
        <div className="absolute top-4 left-4 z-[1000] flex -space-x-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-float"
              style={{ backgroundColor: m.color, border: "2px solid white" }}
              title={m.name}
            >
              {m.avatar}
            </div>
          ))}
        </div>

        {/* ---- Location badge (bottom-left) ---- */}
        <div className="absolute bottom-4 left-4 bg-surface-lowest rounded-xl px-4 py-3 shadow-float z-[1000]">
          <p className="font-display font-bold text-on-surface text-sm tracking-editorial">
            Bangkok, Thailand
          </p>
          <p className="label-stamp text-[10px] text-on-surface-variant mt-0.5">
            13.7563&deg; N, 100.5018&deg; E
          </p>
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
                className="bg-surface-lowest rounded-2xl p-4 shadow-float cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
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

                <div className="flex items-center gap-2">
                  <span
                    className="label-stamp text-[9px] px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: place.pinColor }}
                  >
                    {place.category.toUpperCase()}
                  </span>

                  {isShortlisted(place.id) ? (
                    <span className="label-stamp text-[10px] text-on-tertiary-container bg-tertiary-container px-2.5 py-0.5 rounded-full">
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
