const actions = [
  {
    icon: "➕",
    label: "Add Expense",
    description: "Log a new group expense",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: "📎",
    label: "Upload Doc",
    description: "Boarding pass, confirmation",
    accent: "bg-[#6B21A8]/10 text-[#6B21A8]",
  },
  {
    icon: "🗳️",
    label: "Create Poll",
    description: "Vote on activities",
    accent: "bg-secondary/10 text-secondary",
  },
  {
    icon: "⚠️",
    label: "Conflict Check",
    description: "Audit schedule conflicts",
    accent: "bg-tertiary-container/10 text-tertiary-container",
  },
];

export default function QuickActions() {
  return (
    <div className="glass rounded-3xl p-8 col-span-full shadow-float">
      <h3 className="font-display text-xl font-bold tracking-editorial text-on-surface mb-5">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-surface-lowest hover:bg-surface-low transition-all duration-200 cursor-pointer group"
          >
            <span
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${action.accent} group-hover:scale-110 transition-transform duration-200`}
            >
              {action.icon}
            </span>
            <span className="font-display text-sm font-bold text-on-surface">
              {action.label}
            </span>
            <span className="text-[11px] text-on-surface-variant text-center leading-tight">
              {action.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
