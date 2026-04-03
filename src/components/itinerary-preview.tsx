import { itinerary } from "@/lib/mock-data";

const categoryStyles: Record<string, string> = {
  flight: "bg-primary/10 text-primary",
  hotel: "bg-[#6B21A8]/10 text-[#6B21A8]",
  food: "bg-secondary/10 text-secondary",
  activity: "bg-tertiary-container/10 text-tertiary-container",
  transport: "bg-primary-container/10 text-primary-container",
};

const categoryIcons: Record<string, string> = {
  flight: "✈️",
  hotel: "🏨",
  food: "🍜",
  activity: "🎯",
  transport: "🚕",
};

export default function ItineraryPreview() {
  const firstDay = Object.entries(itinerary)[0];

  return (
    <div className="bg-surface-lowest rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl font-bold tracking-editorial text-on-surface">
          Itinerary
        </h3>
        <button className="text-xs text-primary font-semibold hover:text-primary-container transition-colors cursor-pointer">
          View Full Plan →
        </button>
      </div>

      <p className="label-stamp text-[10px] text-on-surface-variant mb-5">
        {firstDay[0]}
      </p>

      <div className="relative">
        {/* Dashed timeline */}
        <div
          className="absolute left-[52px] top-2 bottom-2 w-[2px]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #C3C6D7 0px, #C3C6D7 6px, transparent 6px, transparent 12px)",
          }}
        />

        <div className="space-y-6">
          {firstDay[1].map((item) => (
            <div key={item.id} className="flex gap-4 items-start relative">
              {/* Time */}
              <span className="font-body text-xs text-on-surface-variant font-mono w-11 text-right pt-3 shrink-0">
                {item.time}
              </span>

              {/* Node dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-primary mt-4 shrink-0 relative z-10 ring-4 ring-surface-lowest" />

              {/* Card */}
              <div className="flex-1 bg-surface-low rounded-2xl p-4 hover:bg-surface-highest/60 transition-all duration-200">
                <span
                  className={`label-stamp text-[9px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${categoryStyles[item.category]}`}
                >
                  {categoryIcons[item.category]} {item.category}
                </span>
                <p className="font-display text-sm font-bold text-on-surface mt-2">
                  {item.title}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {item.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* More days */}
      <div className="mt-6 bg-surface-low rounded-2xl py-3 text-center">
        <p className="text-xs text-on-surface-variant">
          +{Object.keys(itinerary).length - 1} more days planned
        </p>
      </div>
    </div>
  );
}
