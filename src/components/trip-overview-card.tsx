import { currentTrip } from "@/lib/mock-data";

export default function TripOverviewCard() {
  const daysUntil = Math.ceil(
    (new Date(currentTrip.startDate).getTime() -
      new Date("2026-04-03").getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const budgetPercent = Math.round(
    (currentTrip.totalSpent / currentTrip.totalBudget) * 100
  );

  return (
    <div className="bg-surface-lowest rounded-3xl p-8 col-span-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{currentTrip.coverEmoji}</span>
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-editorial text-on-surface">
                {currentTrip.name}
              </h2>
              <p className="text-on-surface-variant text-sm mt-0.5">
                {currentTrip.destination}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-end gap-10 mt-8">
            <div>
              <p className="font-display text-4xl font-extrabold tracking-editorial text-primary">
                {daysUntil}
              </p>
              <p className="label-stamp text-[10px] text-on-surface-variant mt-1">
                Days to go
              </p>
            </div>
            <div>
              <p className="font-display text-4xl font-extrabold tracking-editorial text-on-surface">
                {currentTrip.members.length}
              </p>
              <p className="label-stamp text-[10px] text-on-surface-variant mt-1">
                Travelers
              </p>
            </div>
            <div>
              <p className="font-display text-4xl font-extrabold tracking-editorial text-on-surface">
                10
              </p>
              <p className="label-stamp text-[10px] text-on-surface-variant mt-1">
                Nights
              </p>
            </div>
          </div>
        </div>

        {/* Budget Ring */}
        <div className="text-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#E6F6FF"
                strokeWidth="7"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#budgetGradient)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${budgetPercent * 2.64} 264`}
              />
              <defs>
                <linearGradient
                  id="budgetGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#003FA3" />
                  <stop offset="100%" stopColor="#0055D4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-xl font-extrabold text-on-surface">
                {budgetPercent}%
              </span>
              <span className="label-stamp text-[9px] text-on-surface-variant">
                Budget
              </span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-3">
            ${currentTrip.totalSpent.toLocaleString()}{" "}
            <span className="text-on-surface font-semibold">
              / ${currentTrip.totalBudget.toLocaleString()}
            </span>{" "}
            {currentTrip.currency}
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="flex items-center gap-2.5 mt-8">
        {currentTrip.members.map((m) => (
          <div
            key={m.id}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-float"
            style={{ backgroundColor: m.color }}
            title={m.name}
          >
            {m.avatar}
          </div>
        ))}
        <button className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-on-surface-variant text-lg hover:bg-surface-highest hover:text-primary transition-all duration-200 cursor-pointer">
          +
        </button>
      </div>
    </div>
  );
}
