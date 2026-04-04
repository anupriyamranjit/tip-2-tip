export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative flex-col justify-end p-12"
        style={{
          background:
            "linear-gradient(175deg, #E8792B 0%, #D4602A 15%, #B8451F 28%, #8B5E3C 38%, #4A7B5E 48%, #1B6B8A 58%, #0A4F7A 70%, #003FA3 82%, #071E27 100%)",
        }}
      >
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
        {/* Dark gradient at bottom for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(7,30,39,0.7) 0%, rgba(7,30,39,0.3) 30%, transparent 60%)",
          }}
        />

        <div className="relative z-10">
          <h1 className="font-display text-4xl font-extrabold tracking-editorial text-white leading-tight">
            Every great trip
            <br />
            starts with a{" "}
            <span className="text-secondary-container">plan.</span>
          </h1>
          <p className="mt-4 text-white/70 text-base leading-relaxed max-w-md">
            Collaborate with friends to build itineraries, split expenses, and
            create unforgettable memories together.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {[
              "Group Itineraries",
              "Expense Splitting",
              "Shared Vault",
              "Live Polls",
              "Interactive Maps",
            ].map((tag) => (
              <span
                key={tag}
                className="label-stamp text-[10px] px-4 py-1.5 rounded-full bg-white/10 text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 flex items-center justify-center bg-surface p-6 sm:p-12">
        {children}
      </div>
    </div>
  );
}
