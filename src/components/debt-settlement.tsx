import { debts, members } from "@/lib/mock-data";

function getMember(id: string) {
  return members.find((m) => m.id === id);
}

export default function DebtSettlement() {
  return (
    <div className="bg-surface-lowest rounded-3xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl font-bold tracking-editorial text-on-surface">
          Settle Up
        </h3>
        <span className="label-stamp text-[9px] px-3 py-1.5 rounded-full bg-secondary-container/15 text-secondary">
          {debts.length} pending
        </span>
      </div>

      <div className="space-y-3">
        {debts.map((debt, idx) => {
          const from = getMember(debt.from);
          const to = getMember(debt.to);
          return (
            <div
              key={idx}
              className="flex items-center gap-3 p-4 bg-surface-low rounded-2xl hover:bg-surface-highest/60 transition-all duration-200"
            >
              {/* From avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: from?.color }}
              >
                {from?.avatar}
              </div>

              {/* Names & arrow */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm text-on-surface font-medium truncate">
                  {from?.name}
                </span>
                <span className="text-on-surface-variant text-xs">→</span>
                <span className="text-sm text-on-surface font-medium truncate">
                  {to?.name}
                </span>
              </div>

              {/* To avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: to?.color }}
              >
                {to?.avatar}
              </div>

              {/* Amount */}
              <p className="font-display text-sm font-bold tabular-nums text-primary ml-1">
                ${debt.amount.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      <button className="mt-6 w-full py-3.5 gradient-cta text-on-primary text-sm font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer shadow-float">
        Simplify Debts
      </button>
    </div>
  );
}
