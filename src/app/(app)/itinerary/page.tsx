import { itinerary, members } from "@/lib/mock-data";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const DAYS = Object.keys(itinerary);

/** Map day keys to richer display data */
const dayMeta: Record<string, { weekday: string; date: string; city: string }> = {
  "Day 1 — Apr 18": { weekday: "Friday",   date: "April 18, 2026", city: "BANGKOK" },
  "Day 2 — Apr 19": { weekday: "Saturday", date: "April 19, 2026", city: "BANGKOK — OLD CITY" },
  "Day 3 — Apr 20": { weekday: "Sunday",   date: "April 20, 2026", city: "BANGKOK — CHATUCHAK" },
};

/** Determine a status for each item (simulate confirmed vs proposed) */
function getStatus(id: string): "confirmed" | "proposed" {
  const proposedIds = new Set(["i4", "i8", "i11"]);
  return proposedIds.has(id) ? "proposed" : "confirmed";
}

/** Category icon */
function categoryIcon(cat: string) {
  switch (cat) {
    case "flight":    return "\u2708\uFE0F";
    case "hotel":     return "\u{1F3E8}";
    case "food":      return "\u{1F37C}";
    case "activity":  return "\u{1F3AF}";
    case "transport": return "\u{1F697}";
    default:          return "\u{1F4CD}";
  }
}

/** Transit cards between activities */
const transitNotes: Record<string, { mode: string; icon: string; time: string }> = {
  i1: { mode: "In-flight to Bangkok",       icon: "\u2708\uFE0F", time: "12 HR FLIGHT" },
  i2: { mode: "Taxi to Silom District",      icon: "\u{1F695}",   time: "45 MIN DRIVE" },
  i3: { mode: "Walk to Yaowarat",            icon: "\u{1F6B6}",   time: "10 MIN WALK" },
  i5: { mode: "Tuk-Tuk to Thip Samai",       icon: "\u{1F6FA}",   time: "15 MIN RIDE" },
  i6: { mode: "Ferry across the river",      icon: "\u26F4\uFE0F", time: "20 MIN FERRY" },
  i7: { mode: "Taxi to Lebua",               icon: "\u{1F695}",   time: "25 MIN DRIVE" },
  i9: { mode: "Taxi to Silom",               icon: "\u{1F695}",   time: "30 MIN DRIVE" },
  i10: { mode: "Walk to Health Land Spa",    icon: "\u{1F6B6}",   time: "8 MIN WALK" },
};

/** Attachments for some items */
const attachments: Record<string, string> = {
  i2: "Flight_Confirmation.pdf",
  i3: "Airbnb_Booking.pdf",
  i5: "Entry_Tickets.pdf",
  i10: "Cooking_Class_Receipt.pdf",
};

/** Daily budget heatmap segments */
const budgetSegments = [
  { label: "Transport",   amount: 185, color: "#003FA3" },
  { label: "Lodging",     amount: 175, color: "#0055D4" },
  { label: "Food",        amount: 95,  color: "#AC3509" },
  { label: "Activities",  amount: 45,  color: "#006A62" },
  { label: "Other",       amount: 30,  color: "#C3C6D7" },
];
const budgetTotal = budgetSegments.reduce((s, b) => s + b.amount, 0);

/** Shortlist items */
const shortlist = [
  { title: "Lumpini Park Evening Run", location: "Silom District", status: "PROPOSED" as const },
  { title: "Jim Thompson House Museum", location: "National Stadium", status: "PROPOSED" as const },
];

/* ================================================================== */
/*  TAB DATA                                                          */
/* ================================================================== */
const TABS = [
  { label: "OVERVIEW",  href: "/dashboard" },
  { label: "ITINERARY", href: "/itinerary" },
  { label: "LOGISTICS", href: "#" },
  { label: "VAULT",     href: "#" },
];

/* ================================================================== */
/*  PAGE                                                              */
/* ================================================================== */
export default function ItineraryPage() {
  const activeDayKey = DAYS[0];
  const dayItems = itinerary[activeDayKey];
  const meta = dayMeta[activeDayKey] ?? { weekday: "Friday", date: "April 18, 2026", city: "BANGKOK" };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* ---------------------------------------------------------- */}
      {/*  TOP BAR — clean, not sticky glass                         */}
      {/* ---------------------------------------------------------- */}
      <header className="bg-surface-lowest">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 flex items-center justify-between h-16">
          {/* Brand */}
          <span className="font-display text-lg font-extrabold tracking-editorial text-primary">
            Editorial Wanderlust
          </span>

          {/* Tab navigation */}
          <nav className="hidden md:flex items-center gap-10">
            {TABS.map((tab) => (
              <a
                key={tab.label}
                href={tab.href}
                className={`label-stamp text-xs py-5 transition-colors ${
                  tab.label === "ITINERARY"
                    ? "text-primary border-b-2 border-primary font-extrabold"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {tab.label}
              </a>
            ))}
          </nav>

          {/* Collaborator avatar stack */}
          <div className="flex -space-x-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-surface-lowest"
                style={{ backgroundColor: m.color }}
                title={m.name}
              >
                {m.avatar}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/*  DAY PILLS (navigation)                                    */}
      {/* ---------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-8 pb-2 flex items-center gap-3">
        {/* Arrow left */}
        <button className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center text-on-surface-variant hover:bg-surface-highest transition-colors shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>

        {DAYS.map((dayKey, i) => (
          <button
            key={dayKey}
            className={`label-stamp text-[11px] px-5 py-2 rounded-full transition-colors ${
              i === 0
                ? "gradient-cta text-on-primary shadow-float"
                : "bg-surface-low text-on-surface-variant hover:bg-surface-highest"
            }`}
          >
            Day {i + 1}
          </button>
        ))}
        {/* Placeholder future days */}
        {[4, 5, 6].map((d) => (
          <button
            key={d}
            className="label-stamp text-[11px] px-5 py-2 rounded-full bg-surface-low text-on-surface-variant/50 cursor-not-allowed"
          >
            Day {d}
          </button>
        ))}

        {/* Arrow right */}
        <button className="w-9 h-9 rounded-full bg-surface-low flex items-center justify-center text-on-surface-variant hover:bg-surface-highest transition-colors shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ---------------------------------------------------------- */}
      {/*  DAY HEADER — hero display                                 */}
      {/* ---------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 pt-10 pb-10">
        {/* Massive weekday name */}
        <h1 className="font-display text-8xl sm:text-9xl font-extrabold tracking-editorial text-on-surface leading-[0.9]">
          {meta.weekday}
        </h1>

        {/* Date + location pill */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <span className="text-on-surface-variant text-base">{meta.date}</span>
          <span className="label-stamp text-[10px] px-4 py-1.5 rounded-full bg-surface-low text-on-surface-variant">
            {meta.city}
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button className="label-stamp text-xs px-5 py-2.5 rounded-full bg-transparent text-on-surface hover:bg-ghost-border transition-colors">
            Check Conflicts
          </button>
          <button className="label-stamp text-xs px-6 py-2.5 rounded-full gradient-cta text-on-primary shadow-float hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            Add Activity
          </button>
          <button className="label-stamp text-xs px-5 py-2.5 rounded-full bg-surface-low text-on-surface-variant hover:bg-surface-highest transition-colors">
            Invite Friends
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  TIMELINE                                                  */}
      {/* ---------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 pb-16">
        <div className="relative">
          {dayItems.map((item, idx) => {
            const status = getStatus(item.id);
            const transit = transitNotes[item.id];
            const attachment = attachments[item.id];
            const isLast = idx === dayItems.length - 1;

            return (
              <div key={item.id}>
                {/* Activity row */}
                <div className="flex gap-6 sm:gap-8">
                  {/* Time column + dashed line */}
                  <div className="flex flex-col items-end w-20 shrink-0">
                    <span className="font-mono text-sm text-on-surface-variant font-medium text-right">
                      {item.time}
                    </span>
                    {/* Dot */}
                    <div className="flex flex-col items-center w-full mt-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: status === "confirmed"
                            ? "var(--tertiary-container)"
                            : "var(--surface-variant)",
                        }}
                      />
                      {/* Dashed line */}
                      {!isLast && (
                        <div
                          className="flex-1 w-[2px] mt-1"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(to bottom, var(--outline-variant) 0px, var(--outline-variant) 6px, transparent 6px, transparent 12px)",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Content card */}
                  <div className="flex-1 pb-6">
                    <div className="bg-surface-lowest rounded-2xl p-5 sm:p-6 shadow-float">
                      {/* Status badge */}
                      <span
                        className={`label-stamp inline-block text-[10px] px-3 py-1 rounded-full ${
                          status === "confirmed"
                            ? "bg-tertiary-container text-on-tertiary-container"
                            : "bg-surface-variant text-on-surface-variant"
                        }`}
                      >
                        {status === "confirmed" ? "CONFIRMED" : "PROPOSED"}
                      </span>

                      {/* Title */}
                      <h3 className="mt-3 font-display text-lg font-bold tracking-editorial">
                        <span className="mr-2">{categoryIcon(item.category)}</span>
                        {item.title}
                      </h3>

                      {/* Notes */}
                      {item.notes && (
                        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                          {item.notes}
                        </p>
                      )}

                      {/* Location */}
                      <div className="mt-3 flex items-center gap-1.5 text-sm text-on-surface-variant">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-primary">
                          <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.274 1.765 11.928 11.928 0 00.757.433c.11.057.2.104.281.14l.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        {item.location}
                      </div>

                      {/* Attachment chip */}
                      {attachment && (
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-xl bg-surface-low text-on-surface-variant">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                              <path fillRule="evenodd" d="M4 2a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 004 14h8a1.5 1.5 0 001.5-1.5V6.621a1.5 1.5 0 00-.44-1.06L9.94 2.439A1.5 1.5 0 008.878 2H4zm4 3.5a.75.75 0 01.75.75v2.69l.72-.72a.75.75 0 111.06 1.06l-2 2a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06l.72.72V6.25A.75.75 0 018 5.5z" clipRule="evenodd" />
                            </svg>
                            {attachment}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transit card (between activities) */}
                {transit && !isLast && (
                  <div className="flex gap-6 sm:gap-8">
                    {/* Spacer for time column — dashed line continues */}
                    <div className="flex flex-col items-center w-20 shrink-0">
                      <div
                        className="flex-1 w-[2px]"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(to bottom, var(--outline-variant) 0px, var(--outline-variant) 6px, transparent 6px, transparent 12px)",
                        }}
                      />
                    </div>

                    {/* Transit content */}
                    <div className="flex-1 pb-4">
                      <div className="bg-surface-low rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-base">{transit.icon}</span>
                        <span className="text-sm text-on-surface-variant">{transit.mode}</span>
                        <span className="ml-auto label-stamp text-[10px] text-on-surface-variant">
                          {transit.time}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  DAILY BUDGET HEATMAP                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-6 sm:px-10 pb-16">
        <h2 className="label-stamp text-xs text-on-surface-variant tracking-widest mb-4">
          Daily Spend Breakdown
        </h2>

        <div className="bg-surface-lowest rounded-2xl p-6 shadow-float">
          {/* Heatmap bar */}
          <div className="flex rounded-xl overflow-hidden h-8">
            {budgetSegments.map((seg) => (
              <div
                key={seg.label}
                className="flex items-center justify-center text-[10px] text-white font-bold transition-all"
                style={{
                  width: `${(seg.amount / budgetTotal) * 100}%`,
                  backgroundColor: seg.color,
                }}
                title={`${seg.label}: $${seg.amount}`}
              >
                {seg.amount >= 60 ? `$${seg.amount}` : ""}
              </div>
            ))}
          </div>

          {/* Labels */}
          <div className="mt-4 flex flex-wrap gap-5">
            {budgetSegments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-xs text-on-surface-variant">
                  {seg.label}
                </span>
                <span className="text-xs font-semibold text-on-surface">${seg.amount}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-right">
            <span className="label-stamp text-[10px] text-on-surface-variant">Total</span>
            <span className="ml-2 font-display text-lg font-bold tracking-editorial">${budgetTotal} CAD</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  SHORTLIST                                                 */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-surface-low">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 py-14">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="label-stamp text-xs text-on-surface-variant tracking-widest">
              Shortlist
            </h2>
            <span className="label-stamp text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant">
              {shortlist.length} PROPOSED
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {shortlist.map((item) => (
              <div
                key={item.title}
                className="bg-surface-lowest rounded-2xl p-5 shadow-float"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="label-stamp inline-block text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant">
                    SHORTLISTED
                  </span>
                  <span className="label-stamp inline-block text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant">
                    {item.status}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold tracking-editorial">
                  {item.title}
                </h3>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-primary">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.274 1.765 11.928 11.928 0 00.757.433c.11.057.2.104.281.14l.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                  </svg>
                  {item.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
