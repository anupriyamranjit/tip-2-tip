"use client";

import { members } from "@/lib/mock-data";

const documents = [
  {
    name: "Boarding Pass YVR→BKK",
    date: "Mar 12, 2026",
    type: "PDF",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e3a5f 100%)",
    pattern: "repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.08) 18px, rgba(255,255,255,0.08) 20px)",
  },
  {
    name: "Hotel Confirmation",
    date: "Mar 10, 2026",
    type: "PDF",
    gradient: "linear-gradient(135deg, #92400e 0%, #d97706 50%, #b45309 100%)",
    pattern: "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.06) 12px, rgba(255,255,255,0.06) 14px)",
  },
  {
    name: "Travel Insurance",
    date: "Mar 8, 2026",
    type: "PDF",
    gradient: "linear-gradient(135deg, #065f46 0%, #059669 50%, #047857 100%)",
    pattern: "repeating-linear-gradient(0deg, transparent, transparent 16px, rgba(255,255,255,0.05) 16px, rgba(255,255,255,0.05) 18px)",
  },
  {
    name: "Visa Approval",
    date: "Mar 5, 2026",
    type: "IMG",
    gradient: "linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #b91c1c 100%)",
    pattern: "radial-gradient(circle at 70% 40%, rgba(255,255,255,0.1) 0%, transparent 60%)",
  },
  {
    name: "Cooking Class Booking",
    date: "Mar 14, 2026",
    type: "PDF",
    gradient: "linear-gradient(135deg, #c2410c 0%, #ea580c 50%, #d97706 100%)",
    pattern: "radial-gradient(circle at 30% 60%, rgba(255,255,255,0.08) 0%, transparent 50%)",
  },
  {
    name: "Travel Vaccinations",
    date: "Feb 28, 2026",
    type: "IMG",
    gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #0f766e 100%)",
    pattern: "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 12px)",
  },
];

const phrases = [
  {
    category: "GREETING",
    thai: "Sawasdee",
    english: "Hello",
    phonetic: "sah-wah-dee",
    color: "#2563eb",
  },
  {
    category: "FOOD SAFETY",
    thai: "Mee tua mee mai?",
    english: "Does this have peanuts?",
    phonetic: "mee too-ah mee mai",
    color: "#dc2626",
  },
  {
    category: "NAVIGATION",
    thai: "Hong nam yoo tee nai?",
    english: "Where is the bathroom?",
    phonetic: "hawng nahm yoo tee nai",
    color: "#059669",
  },
  {
    category: "EMERGENCY",
    thai: "Chuay duay!",
    english: "Help!",
    phonetic: "choo-ay doo-ay",
    color: "#ea580c",
  },
];

const emergencyNumbers = [
  { label: "Police", number: "191" },
  { label: "Ambulance", number: "1669" },
  { label: "Tourist Police", number: "1155" },
  { label: "Fire", number: "199" },
];

const offlineItems = [
  { name: "Trip Itinerary", status: "downloaded" as const },
  { name: "Phrasebook", status: "downloaded" as const },
  { name: "Map Tiles: Bangkok", status: "available" as const },
];

export default function VaultPage() {
  return (
    <div className="relative min-h-screen pb-28">
      {/* ── Sticky Glass Header ── */}
      <header className="sticky top-0 z-30 glass shadow-float px-8 py-5 flex items-center justify-between">
        <div>
          <span className="label-stamp text-[10px] text-on-surface-variant">
            EDITORIAL WANDERLUST
          </span>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-display text-2xl font-extrabold tracking-editorial text-on-surface">
              Thailand Adventure
            </h1>
            <span className="label-stamp text-[10px] bg-surface-low text-on-surface-variant px-2.5 py-1 rounded-full">
              DOCUMENT VAULT &amp; TOOLBOX
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-surface"
                style={{ backgroundColor: m.color }}
                title={m.name}
              >
                {m.avatar}
              </div>
            ))}
          </div>
          <div className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {/* ── Hero: Two-Part Layout ── */}
        <section className="bg-surface-lowest rounded-3xl overflow-hidden flex">
          {/* Red accent bar */}
          <div className="w-1 bg-secondary shrink-0" />

          {/* LEFT side */}
          <div className="flex-1 p-8 flex flex-col justify-center" style={{ flexBasis: "55%" }}>
            <span className="label-stamp text-[10px] text-on-surface-variant bg-surface-low px-2.5 py-1 rounded-full w-fit">
              ESSENTIAL TOOLS
            </span>
            <h2 className="font-display text-3xl font-extrabold tracking-editorial text-on-surface mt-4">
              Digital Vault &amp; Essential Survival Tools.
            </h2>
            <button className="mt-6 gradient-cta text-on-primary font-bold text-sm px-6 py-2.5 rounded-full shadow-float cursor-pointer w-fit">
              Upload New Document
            </button>
          </div>

          {/* RIGHT side: Emergency Hub card */}
          <div className="p-6 flex items-center" style={{ flexBasis: "45%" }}>
            <div className="bg-tertiary-container rounded-2xl p-6 w-full shadow-float flex flex-col gap-3">
              <h3 className="font-display text-lg font-extrabold text-on-primary">
                Emergency Hub
              </h3>
              <p className="text-sm text-on-primary/80 leading-relaxed">
                Quick access to emergency contacts, local authorities, and embassy
                information for your trip.
              </p>
              <div className="mt-auto flex items-center gap-2">
                <span className="label-stamp text-[11px] bg-white/20 text-on-primary px-3 py-1 rounded-full">
                  CALL LOCAL POLICE
                </span>
                <span className="text-sm font-bold text-on-primary">191</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Travel Document Vault ── */}
        <section className="bg-surface-lowest rounded-3xl p-8">
          <div className="mb-6">
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface">
              Travel Document Vault
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Securely OCR-indexed storage for all trip-critical documents
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.name}
                className="bg-surface-low rounded-2xl overflow-hidden"
              >
                <div
                  className="h-32 relative"
                  style={{
                    background: doc.gradient,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: doc.pattern }}
                  />
                </div>
                <div className="p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display font-bold text-sm text-on-surface">
                      {doc.name}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {doc.date}
                    </p>
                  </div>
                  <span className="label-stamp text-[10px] bg-surface-highest text-on-surface-variant px-2 py-0.5 rounded-full shrink-0">
                    {doc.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Thai Survival Phrases ── */}
        <section className="bg-surface-lowest rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface">
              Thai Survival Phrases
            </h2>
            <span className="label-stamp text-xs text-primary cursor-pointer">
              VIEW ALL 24 PHRASES
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {phrases.map((p) => (
              <div
                key={p.thai}
                className="bg-surface-low rounded-2xl p-5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="label-stamp text-[10px] text-on-surface-variant">
                    {p.category}
                  </span>
                </div>
                <p className="font-display font-bold text-on-surface mt-3 text-lg tracking-editorial">
                  {p.thai}
                </p>
                <p className="text-sm text-on-surface-variant italic mt-1.5">
                  {p.english}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {p.phonetic}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Nearest Embassy ── */}
        <section className="bg-surface-lowest rounded-3xl overflow-hidden flex">
          {/* Map-like preview */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: "40%",
              background: "linear-gradient(135deg, var(--surface-container-low) 0%, var(--surface-dim) 100%)",
            }}
          >
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-surface-highest flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span className="label-stamp text-[10px] text-on-surface-variant">
                MAP PREVIEW
              </span>
              {/* Decorative grid lines */}
              <div className="mt-4 space-y-2">
                <div className="h-px bg-surface-highest" />
                <div className="flex gap-2">
                  <div className="flex-1 h-px bg-surface-highest" />
                  <div className="flex-1 h-px bg-surface-highest" />
                </div>
                <div className="h-px bg-surface-highest" />
              </div>
            </div>
          </div>

          {/* Embassy details */}
          <div className="flex-1 p-8">
            <span className="label-stamp text-[10px] text-on-surface-variant bg-surface-low px-2.5 py-1 rounded-full">
              NEAREST EMBASSY
            </span>
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface mt-3">
              Canadian Embassy, Bangkok
            </h2>
            <p className="text-sm text-on-surface-variant mt-3 leading-relaxed">
              15th Floor, Abdulrahim Place, 990 Rama IV Road, Bangrak, Bangkok
              10500
            </p>
            <div className="flex items-center gap-2 mt-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="text-sm font-semibold text-on-surface">
                +66 2 636 0540
              </span>
            </div>
          </div>
        </section>

        {/* ── Emergency Numbers ── */}
        <section className="bg-surface-lowest rounded-3xl p-8">
          <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface mb-6">
            Emergency Numbers
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {emergencyNumbers.map((e) => (
              <div
                key={e.label}
                className="bg-surface-low rounded-2xl p-5 flex flex-col items-center text-center"
              >
                <span className="label-stamp text-[11px] text-on-surface-variant">
                  {e.label}
                </span>
                <span className="font-display text-4xl font-extrabold tracking-editorial text-on-surface mt-3">
                  {e.number}
                </span>
                <div className="mt-3 w-10 h-10 rounded-full bg-surface-highest flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Offline Continuity ── */}
        <section className="bg-surface-lowest rounded-3xl p-8">
          <div className="mb-6">
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface">
              Offline Continuity
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Download essential trip data for offline access. Stay prepared even
              without internet connectivity.
            </p>
          </div>

          <div className="space-y-3">
            {offlineItems.map((item) => (
              <div
                key={item.name}
                className="bg-surface-low rounded-2xl px-5 py-4 flex items-center justify-between"
              >
                <span className="text-sm font-semibold text-on-surface">
                  {item.name}
                </span>
                {item.status === "downloaded" ? (
                  <span
                    className="label-stamp text-xs px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: "var(--tertiary-container)",
                      color: "var(--on-tertiary-container)",
                    }}
                  >
                    ✓ Downloaded
                  </span>
                ) : (
                  <button className="label-stamp text-xs text-primary bg-surface-highest px-3 py-1 rounded-full cursor-pointer">
                    Download
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Storage bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-on-surface-variant">Storage Used</span>
              <span className="text-xs font-semibold text-on-surface-variant">24 MB / 100 MB</span>
            </div>
            <div className="h-2 bg-surface-low rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: "24%",
                  background: "linear-gradient(90deg, var(--primary) 0%, var(--primary-container) 100%)",
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
