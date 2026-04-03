"use client";

import { useState } from "react";
import { members, recentExpenses, debts } from "@/lib/mock-data";

const getMember = (id: string) => members.find((m) => m.id === id)!;

const categoryIcons: Record<string, string> = {
  food: "\u{1F35C}",
  transport: "\u2708\uFE0F",
  lodging: "\u{1F3E0}",
  activity: "\u{1F3AD}",
  other: "\u{1F4CB}",
};

/* Fake local currency amounts for the ledger */
const localAmounts: Record<string, { amount: string; currency: string }> = {
  e1: { amount: "\u0E3F22,350", currency: "THB" },
  e2: { amount: "\u0E3F15,840", currency: "THB" },
  e3: { amount: "\u0E3F1,150", currency: "THB" },
  e4: { amount: "$200", currency: "CAD" },
};

const spendingCategories = [
  { name: "FOOD & DRINKS", pct: 42, shade: "100%" },
  { name: "TRANSPORT", pct: 28, shade: "78%" },
  { name: "LODGING", pct: 18, shade: "56%" },
  { name: "ACTIVITIES", pct: 12, shade: "38%" },
];

export default function ExpensesPage() {
  const [search, setSearch] = useState("");

  const filteredExpenses = recentExpenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen pb-28">
      {/* ── Top Blue Banner — Trip Identity Bar ── */}
      <header className="gradient-cta px-8 py-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold italic tracking-editorial text-on-primary">
          Thailand 2026
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-on-primary/80 text-sm font-medium">
            Group Trip: Bangkok &amp; Chiang Mai
          </span>
          <div className="flex -space-x-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-primary"
                style={{ backgroundColor: m.color }}
                title={m.name}
              >
                {m.avatar}
              </div>
            ))}
          </div>
          {/* Settings icon */}
          <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-on-primary cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-6">
        {/* ── Stats Row — 3 cards in one surface ── */}
        <section className="bg-surface-lowest rounded-3xl shadow-float grid grid-cols-3 overflow-hidden">
          {/* Total Group Spend */}
          <div className="p-8">
            <span className="label-stamp text-[11px] text-on-surface-variant">
              TOTAL GROUP SPEND
            </span>
            <p className="font-display text-4xl font-extrabold tracking-editorial text-on-surface mt-3">
              $4,850.20
              <span className="text-base font-semibold text-on-surface-variant ml-1.5">
                CAD
              </span>
            </p>
            <p className="text-sm font-semibold text-secondary mt-2">
              ↑ 12% over budget
            </p>
          </div>

          {/* Your Balance — highlighted bg */}
          <div className="bg-surface-low p-8">
            <span className="label-stamp text-[11px] text-on-surface-variant">
              YOUR BALANCE
            </span>
            <p
              className="font-display text-4xl font-extrabold tracking-editorial mt-3"
              style={{ color: "var(--tertiary-container)" }}
            >
              +$245.80
            </p>
            <p className="text-sm text-on-surface-variant mt-2">
              You&apos;ve paid for more than your share. People owe you money!
            </p>
          </div>

          {/* Quick Action */}
          <div className="p-8">
            <span className="label-stamp text-[11px] text-on-surface-variant">
              QUICK ACTION
            </span>
            <p className="font-display text-lg font-extrabold tracking-editorial text-on-surface mt-3">
              Optimize Debts
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              Reduce the number of transfers needed between group members.
            </p>
            <button className="gradient-cta text-on-primary font-bold text-sm px-6 py-2.5 rounded-full mt-4 shadow-float cursor-pointer">
              Simplify All Debts
            </button>
          </div>
        </section>

        {/* ── Two-Column: Who Owes Whom + Spending by Category ── */}
        <div className="grid grid-cols-2 gap-6">
          {/* Who Owes Whom */}
          <section className="bg-surface-lowest rounded-3xl p-8 shadow-float">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface">
                Who Owes Whom
              </h2>
              <span className="text-sm font-semibold text-primary cursor-pointer">
                View Full History →
              </span>
            </div>

            <div className="space-y-3">
              {debts.map((d, i) => {
                const from = getMember(d.from);
                const to = getMember(d.to);
                const isSmall = d.amount < 100;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 bg-surface-low rounded-2xl px-5 py-4"
                  >
                    {/* From avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: from.color }}
                    >
                      {from.avatar}
                    </div>
                    <p className="text-sm text-on-surface flex-1">
                      <span className="font-semibold">{from.name}</span>
                      <span className="text-on-surface-variant"> owes </span>
                      <span className="font-semibold">{to.name}</span>
                    </p>
                    <span className="font-display font-extrabold text-sm text-on-surface min-w-[72px] text-right">
                      ${d.amount.toFixed(2)}
                    </span>
                    {isSmall ? (
                      <button
                        className="text-xs font-bold px-4 py-1.5 rounded-full cursor-pointer"
                        style={{
                          backgroundColor: "var(--tertiary-container)",
                          color: "var(--on-tertiary-container)",
                        }}
                      >
                        Settle
                      </button>
                    ) : (
                      <button className="text-xs font-bold px-4 py-1.5 rounded-full bg-secondary-container text-on-secondary-container cursor-pointer">
                        Pay Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Spending by Category */}
          <section className="bg-surface-lowest rounded-3xl p-8 shadow-float">
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface mb-6">
              Spending by Category
            </h2>

            <div className="space-y-5">
              {spendingCategories.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="label-stamp text-[11px] text-on-surface-variant">
                      {cat.name}
                    </span>
                    <span className="text-sm font-bold text-on-surface">
                      {cat.pct}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-surface-low overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cat.pct}%`,
                        backgroundColor: `var(--primary)`,
                        opacity: cat.shade,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Expense Ledger ── */}
        <section className="bg-surface-lowest rounded-3xl p-8 shadow-float">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-extrabold tracking-editorial text-on-surface">
              Expense Ledger
            </h2>
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-low rounded-2xl px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant outline-none w-64"
            />
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr] gap-4 px-5 mb-3">
            <span className="label-stamp text-[11px] text-on-surface-variant">
              ACTIVITY
            </span>
            <span className="label-stamp text-[11px] text-on-surface-variant">
              PAID BY
            </span>
            <span className="label-stamp text-[11px] text-on-surface-variant">
              AMOUNT (LOCAL)
            </span>
            <span className="label-stamp text-[11px] text-on-surface-variant">
              AMOUNT (HOME)
            </span>
            <span className="label-stamp text-[11px] text-on-surface-variant">
              SPLIT WITH
            </span>
          </div>

          {/* Rows */}
          <div className="space-y-3">
            {filteredExpenses.map((exp) => {
              const payer = getMember(exp.paidBy);
              const local = localAmounts[exp.id] ?? {
                amount: `$${exp.amount}`,
                currency: exp.currency,
              };

              return (
                <div
                  key={exp.id}
                  className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr] gap-4 items-center bg-surface-low rounded-2xl px-5 py-4"
                >
                  {/* Activity */}
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {categoryIcons[exp.category]}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {exp.description}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {new Date(exp.date).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Paid By */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: payer.color }}
                    >
                      {payer.avatar}
                    </div>
                    <span className="text-sm text-on-surface">
                      {payer.name}
                    </span>
                  </div>

                  {/* Local Amount */}
                  <span className="text-sm font-semibold text-on-surface">
                    {local.amount}
                  </span>

                  {/* Home Amount — colored badge */}
                  <span className="inline-flex items-center bg-primary/10 text-primary font-bold text-sm px-3 py-1 rounded-full w-fit">
                    ${exp.amount.toFixed(2)}
                  </span>

                  {/* Split With */}
                  <div className="flex -space-x-1.5">
                    {exp.splitBetween.map((sid) => {
                      const sm = getMember(sid);
                      return (
                        <div
                          key={sid}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-surface-lowest"
                          style={{ backgroundColor: sm.color }}
                          title={sm.name}
                        >
                          {sm.avatar}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredExpenses.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8">
                No expenses match your search.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Floating New Expense Button — bottom left ── */}
      <div className="fixed bottom-8 left-8 z-40">
        <button className="gradient-cta text-on-primary font-bold text-sm px-8 py-3.5 rounded-full shadow-float cursor-pointer flex items-center gap-2">
          <span className="text-lg leading-none">+</span>
          New Expense
        </button>
      </div>
    </div>
  );
}
