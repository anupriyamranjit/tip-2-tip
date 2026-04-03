import { recentExpenses, members } from "@/lib/mock-data";

const categoryIcons: Record<string, string> = {
  food: "🍜",
  transport: "✈️",
  lodging: "🏨",
  activity: "🎯",
  other: "📦",
};

function getMember(id: string) {
  return members.find((m) => m.id === id);
}

export default function ExpenseSummary() {
  const total = recentExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="bg-surface-lowest rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl font-bold tracking-editorial text-on-surface">
          Recent Expenses
        </h3>
        <button className="text-xs text-primary font-semibold hover:text-primary-container transition-colors cursor-pointer">
          View All →
        </button>
      </div>

      <div className="space-y-3">
        {recentExpenses.map((expense) => {
          const payer = getMember(expense.paidBy);
          return (
            <div
              key={expense.id}
              className="flex items-center gap-4 p-4 bg-surface-low rounded-2xl hover:bg-surface-highest/60 transition-all duration-200"
            >
              <span className="text-xl w-9 text-center">
                {categoryIcons[expense.category]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm font-bold text-on-surface truncate">
                  {expense.description}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Paid by{" "}
                  <span className="font-semibold" style={{ color: payer?.color }}>
                    {payer?.name}
                  </span>{" "}
                  · split {expense.splitBetween.length} ways
                </p>
              </div>
              <p className="font-display text-sm font-bold tabular-nums text-on-surface">
                ${expense.amount.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-5 bg-surface-low rounded-2xl px-5 py-4 flex justify-between items-center">
        <span className="text-sm text-on-surface-variant">Total tracked</span>
        <span className="font-display text-2xl font-extrabold tracking-editorial text-on-surface">
          ${total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
