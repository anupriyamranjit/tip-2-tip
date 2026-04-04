import { members, currentTrip } from "@/lib/mock-data";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Countdown helper (server-rendered snapshot)                       */
/* ------------------------------------------------------------------ */
function getCountdown() {
  const departure = new Date("2026-04-18T06:00:00");
  const now = new Date();
  const diff = Math.max(0, departure.getTime() - now.getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, minutes };
}

/* ------------------------------------------------------------------ */
/*  Stat card data                                                    */
/* ------------------------------------------------------------------ */
const stats = [
  { label: "Destination", value: "Bangkok & Chiang Mai", icon: "\u{1F30F}" },
  { label: "Duration", value: "10 Days", detail: "Apr 18 \u2013 28", icon: "\u{1F4C5}" },
  { label: "Travelers", value: "4", detail: "Collaborators", icon: "\u{1F9F3}" },
  { label: "Budget", value: "$4,500 \u2013 $6,000", icon: "\u{1F4B0}" },
];

const highlights = [
  "Street Food",
  "Temples",
  "Night Markets",
  "Island Hopping",
  "Cooking Classes",
  "Tuk-Tuk Tours",
];

/* ================================================================== */
/*  LANDING PAGE                                                      */
/* ================================================================== */
export default function LandingPage() {
  const countdown = getCountdown();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* ---------------------------------------------------------- */}
      {/*  TOP NAVIGATION                                            */}
      {/* ---------------------------------------------------------- */}
      <nav className="sticky top-0 z-50 glass">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 flex items-center justify-between h-16">
          <span className="font-display text-lg font-extrabold tracking-editorial">
            Editorial Wanderlust
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-on-surface-variant">
            <a href="#story" className="hover:text-primary transition-colors">Our Story</a>
            <a href="#itinerary" className="hover:text-primary transition-colors">The Itinerary</a>
            <a href="#destinations" className="hover:text-primary transition-colors">Destinations</a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="gradient-cta text-on-primary text-sm font-semibold px-5 py-2 rounded-full shadow-float hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------------------------------------------------------- */}
      {/*  HERO                                                      */}
      {/* ---------------------------------------------------------- */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-end">
        {/* Photographic multi-layer gradient — warm sunset to ocean */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              "linear-gradient(175deg, #E8792B 0%, #D4602A 15%, #B8451F 28%, #8B5E3C 38%, #4A7B5E 48%, #1B6B8A 58%, #0A4F7A 70%, #003FA3 82%, #071E27 100%)",
            ].join(", "),
          }}
        />
        {/* Warm amber haze at top-right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 10%, rgba(254,111,66,0.4) 0%, transparent 60%)",
          }}
        />
        {/* Cool ocean glow at bottom-right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 80% 80%, rgba(0,85,212,0.35) 0%, transparent 60%)",
          }}
        />
        {/* Green coastline hint */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 30% at 30% 55%, rgba(6,120,80,0.2) 0%, transparent 50%)",
          }}
        />
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
        {/* Dark-to-transparent gradient for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top right, rgba(7,30,39,0.7) 0%, rgba(7,30,39,0.4) 30%, transparent 65%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-10 pt-28 pb-20 md:pt-36 md:pb-28 w-full">
          <span className="label-stamp inline-block text-xs px-4 py-1.5 rounded-full bg-white/15 text-white/90 mb-8">
            Exclusive Invitation
          </span>

          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-editorial text-white leading-[1.08] max-w-3xl">
            Pack your bags,{" "}
            <span className="text-secondary-container">Thailand</span> awaits.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-xl leading-relaxed font-body">
            You have been invited to a curated group adventure through the heart
            of Southeast Asia. Ten days. Four travelers. One unforgettable story.
          </p>

          {/* Countdown */}
          <div className="mt-10">
            <span className="label-stamp inline-block text-[10px] px-3 py-1 rounded-full bg-white/10 text-white/60 mb-4">
              Until Departure &mdash; April 18, 2026
            </span>
            <div className="flex items-center gap-6 sm:gap-8">
              {[
                { n: countdown.days, unit: "Days" },
                { n: countdown.hours, unit: "Hours" },
                { n: countdown.minutes, unit: "Min" },
              ].map(({ n, unit }) => (
                <div key={unit} className="text-center">
                  <span className="block font-display text-4xl sm:text-5xl font-extrabold text-white tracking-editorial">
                    {String(n).padStart(2, "0")}
                  </span>
                  <span className="label-stamp text-[10px] text-white/50 mt-1 block">
                    {unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="bg-white text-primary font-semibold px-8 py-3.5 rounded-full shadow-float hover:bg-white/90 transition-colors text-sm"
            >
              Join the Journey
            </Link>
            <a
              href="#itinerary"
              className="border border-white/25 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors text-sm"
            >
              View Itinerary
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  THE TRAVEL CIRCLE                                         */}
      {/* ---------------------------------------------------------- */}
      <section id="story" className="bg-surface-low">
        <div className="mx-auto max-w-4xl px-6 sm:px-10 py-24 md:py-32 text-center">
          <span className="label-stamp text-xs text-on-surface-variant tracking-widest">
            The Travel Circle
          </span>

          <h2 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold tracking-editorial">
            Gathered for this Escape
          </h2>

          {/* Member Avatars — large overlapping circles */}
          <div className="mt-12 flex justify-center -space-x-4">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-base font-bold shadow-float ring-4 ring-surface-low"
                style={{ backgroundColor: m.color }}
              >
                {m.avatar}
              </div>
            ))}
          </div>

          <p className="mt-8 text-on-surface-variant text-base sm:text-lg leading-relaxed max-w-md mx-auto">
            Join{" "}
            {members.map((m, i) => (
              <span key={m.id}>
                {i > 0 && i < members.length - 1 && ", "}
                {i === members.length - 1 && ", and "}
                <span className="font-semibold text-on-surface">{m.name}</span>
              </span>
            ))}{" "}
            in Thailand.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  JOURNEY AT A GLANCE                                       */}
      {/* ---------------------------------------------------------- */}
      <section id="destinations" className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 py-24 md:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Left copy with accent bar */}
            <div className="relative pl-6">
              {/* Vertical orange accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
                style={{ backgroundColor: "var(--secondary-container)" }}
              />

              <span className="label-stamp text-xs text-on-surface-variant tracking-widest">
                Journey at a Glance
              </span>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold tracking-editorial max-w-md leading-tight">
                Ten days across the Land of Smiles
              </h2>
              <p className="mt-6 text-on-surface-variant leading-relaxed max-w-lg">
                From the neon-lit streets of Bangkok to the misty temples of
                Chiang Mai, this journey weaves through markets, monasteries,
                and mountain trails. Every day has been thoughtfully curated so
                you can wander without worry.
              </p>

              {/* Highlight chips */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                {highlights.map((tag) => (
                  <span
                    key={tag}
                    className="label-stamp text-[10px] px-4 py-1.5 rounded-full bg-surface-low text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right stat grid */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-surface-lowest rounded-2xl p-6 shadow-float"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <p className="label-stamp text-[10px] text-on-surface-variant mt-4">
                    {s.label}
                  </p>
                  <p className="font-display text-lg font-bold tracking-editorial mt-1">
                    {s.value}
                  </p>
                  {s.detail && (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {s.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  ITINERARY ESSENCE                                         */}
      {/* ---------------------------------------------------------- */}
      <section id="itinerary" className="bg-surface-low">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 py-24 md:py-32">
          <span className="label-stamp text-xs text-on-surface-variant tracking-widest">
            Itinerary Essence
          </span>

          <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-editorial max-w-2xl leading-tight">
            A curated journey through bustling streets
          </h2>

          <p className="mt-6 text-on-surface-variant leading-relaxed max-w-xl">
            Each day unfolds a new chapter of discovery, from dawn temple
            visits to midnight market strolls. The itinerary is a living
            document, shaped by the group and refined by experience.
          </p>

          {/* Feature cards with rich gradients */}
          <div className="mt-14 grid md:grid-cols-2 gap-6">
            {/* Card 1 — Gourmet Dining / warm sunset gradient */}
            <div
              className="relative rounded-3xl overflow-hidden h-56 flex flex-col justify-end"
            >
              {/* Multi-layer warm gradient simulating food/sunset photo */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, #F59E0B 0%, #E8792B 25%, #D4602A 50%, #AC3509 75%, #7A2106 100%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(254,215,100,0.35) 0%, transparent 60%)",
                }}
              />
              {/* Grain */}
              <div
                className="absolute inset-0 opacity-[0.1] mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
                  backgroundSize: "128px 128px",
                }}
              />
              {/* Bottom dark overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(7,30,39,0.6) 0%, transparent 60%)",
                }}
              />
              <div className="relative p-8 sm:p-10">
                <span className="label-stamp text-[10px] text-white/70">Days 1&ndash;5</span>
                <h3 className="mt-2 font-display text-2xl font-bold text-white tracking-editorial">
                  Gourmet Dining
                </h3>
                <p className="mt-2 text-white/75 text-sm leading-relaxed max-w-sm">
                  Navigate Bangkok&apos;s Yaowarat district with a local guide.
                  Taste pad thai from the stall that earned a Michelin star and
                  discover hidden gems only locals know.
                </p>
              </div>
            </div>

            {/* Card 2 — Temple Discovery / ocean blue gradient */}
            <div
              className="relative rounded-3xl overflow-hidden h-56 flex flex-col justify-end"
            >
              {/* Multi-layer cool gradient simulating ocean/temple scene */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, #38BDF8 0%, #0EA5E9 20%, #0284C7 40%, #0055D4 60%, #003FA3 80%, #071E27 100%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 50% 40% at 20% 30%, rgba(56,189,248,0.3) 0%, transparent 60%)",
                }}
              />
              {/* Grain */}
              <div
                className="absolute inset-0 opacity-[0.1] mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
                  backgroundSize: "128px 128px",
                }}
              />
              {/* Bottom dark overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(7,30,39,0.6) 0%, transparent 60%)",
                }}
              />
              <div className="relative p-8 sm:p-10">
                <span className="label-stamp text-[10px] text-white/70">Days 6&ndash;10</span>
                <h3 className="mt-2 font-display text-2xl font-bold text-white tracking-editorial">
                  Temple Discovery
                </h3>
                <p className="mt-2 text-white/75 text-sm leading-relaxed max-w-sm">
                  From the emerald glow of Wat Phra Kaew to the towering spires
                  of Wat Arun at golden hour, explore sacred architecture that
                  has captivated travelers for centuries.
                </p>
              </div>
            </div>
          </div>

          {/* Base camp + timeline */}
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            <div className="bg-surface-lowest rounded-2xl p-6 shadow-float">
              <p className="label-stamp text-[10px] text-on-surface-variant">Base Camp</p>
              <p className="font-display text-lg font-bold tracking-editorial mt-1">
                Silom District, Bangkok
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Days 1 &ndash; 5</p>
            </div>
            <div className="bg-surface-lowest rounded-2xl p-6 shadow-float">
              <p className="label-stamp text-[10px] text-on-surface-variant">Base Camp</p>
              <p className="font-display text-lg font-bold tracking-editorial mt-1">
                Old City, Chiang Mai
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Days 6 &ndash; 10</p>
            </div>
            <div className="bg-surface-lowest rounded-2xl p-6 shadow-float">
              <p className="label-stamp text-[10px] text-on-surface-variant">Timeline</p>
              <p className="font-display text-lg font-bold tracking-editorial mt-1">
                April 18 &ndash; 28, 2026
              </p>
              <p className="text-xs text-on-surface-variant mt-1">Return to Vancouver</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  DARK CTA BANNER                                           */}
      {/* ---------------------------------------------------------- */}
      <section className="bg-surface px-6 sm:px-10 py-12">
        <div
          className="mx-auto max-w-7xl rounded-3xl px-8 sm:px-16 py-20 md:py-24 text-center"
          style={{ backgroundColor: "#071E27" }}
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-editorial text-white leading-tight max-w-2xl mx-auto">
            The world is a map.{" "}
            <span className="text-secondary-container">Shall we begin?</span>
          </h2>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="bg-white text-on-surface font-semibold px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors text-sm"
            >
              Start Planning
            </Link>
            <a
              href="#"
              className="border border-white/20 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors text-sm"
            >
              Ask a question
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      {/*  FOOTER                                                    */}
      {/* ---------------------------------------------------------- */}
      <footer className="bg-surface">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <span className="font-display font-bold text-sm text-on-surface tracking-editorial">
            Editorial Wanderlust
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Contact Support</a>
          </div>
          <span>&copy; 2026 Tip2Tip</span>
        </div>
      </footer>
    </div>
  );
}
