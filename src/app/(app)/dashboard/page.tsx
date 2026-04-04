import { members, currentTrip, recentExpenses, itinerary, debts } from "@/lib/mock-data";
import Link from "next/link";
import DashboardHeader from "@/components/dashboard-header";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function getMember(id: string) {
  return members.find((m) => m.id === id);
}

function getDaysToGo() {
  const departure = new Date(currentTrip.startDate);
  const now = new Date();
  return Math.max(0, Math.ceil((departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function getNights() {
  const start = new Date(currentTrip.startDate);
  const end = new Date(currentTrip.endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const budgetPercent = Math.round((currentTrip.totalSpent / currentTrip.totalBudget) * 100);

const categoryIcons: Record<string, string> = {
  food: "\uD83C\uDF5C",
  transport: "\u2708\uFE0F",
  lodging: "\uD83C\uDFE8",
  activity: "\uD83C\uDFAF",
  other: "\uD83D\uDCCB",
  flight: "\u2708\uFE0F",
  hotel: "\uD83C\uDFE8",
};

const categoryColors: Record<string, string> = {
  food: "bg-amber-100 text-amber-800",
  transport: "bg-blue-100 text-blue-800",
  lodging: "bg-purple-100 text-purple-800",
  activity: "bg-emerald-100 text-emerald-800",
  other: "bg-gray-100 text-gray-700",
  flight: "bg-blue-100 text-blue-800",
  hotel: "bg-purple-100 text-purple-800",
};

const quickActions = [
  {
    icon: "\uD83D\uDCB8",
    label: "Add Expense",
    description: "Log a new shared cost",
    bg: "bg-blue-100",
  },
  {
    icon: "\uD83D\uDCF7",
    label: "Upload Doc",
    description: "Receipts, tickets, visas",
    bg: "bg-amber-100",
  },
  {
    icon: "\uD83D\uDCCA",
    label: "Create Poll",
    description: "Vote on group decisions",
    bg: "bg-emerald-100",
  },
  {
    icon: "\u26A0\uFE0F",
    label: "Conflict Check",
    description: "Detect scheduling issues",
    bg: "bg-red-100",
  },
];

/* ------------------------------------------------------------------ */
/*  Budget Ring SVG                                                   */
/* ------------------------------------------------------------------ */
function BudgetRing({ percent }: { percent: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--surface-container-low)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#budgetGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="budgetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-container)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold tracking-editorial text-on-surface">
          {percent}%
        </span>
        <span className="label-stamp text-[9px] text-on-surface-variant">of budget</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  DASHBOARD PAGE                                                    */
/* ================================================================== */
export default function DashboardPage() {
  const daysToGo = getDaysToGo();
  const nights = getNights();
  const totalExpenses = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const day1Key = Object.keys(itinerary)[0];
  const day1Items = itinerary[day1Key];
  const remainingDays = Object.keys(itinerary).length - 1;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* ---------------------------------------------------------- */}
      {/*  STICKY HEADER                                             */}
      {/* ---------------------------------------------------------- */}
      <header className="sticky top-0 z-50 glass shadow-float">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 flex items-center justify-between h-20">
          <DashboardHeader />

          <div className="flex items-center gap-5">
            {/* Notification bell */}
            <button className="relative p-2 rounded-2xl bg-surface-lowest hover:bg-surface-low transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
            </button>

            {/* User avatar */}
            <div className="w-10 h-10 rounded-full gradient-cta flex items-center justify-center text-white text-sm font-bold shadow-float">
              AR
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 sm:px-10 py-8 space-y-8">
        {/* ---------------------------------------------------------- */}
        {/*  TRIP OVERVIEW CARD                                        */}
        {/* ---------------------------------------------------------- */}
        <section className="bg-surface-lowest rounded-3xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Trip info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{currentTrip.coverEmoji}</span>
                <div>
                  <h2 className="font-display text-3xl font-extrabold tracking-editorial">
                    {currentTrip.name}
                  </h2>
                  <p className="text-on-surface-variant text-sm font-body mt-0.5">
                    {currentTrip.destination}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-8 flex flex-wrap gap-8">
                <div>
                  <span className="font-display text-4xl font-extrabold tracking-editorial text-primary">
                    {daysToGo}
                  </span>
                  <span className="label-stamp block text-[10px] text-on-surface-variant mt-1">
                    Days to Go
                  </span>
                </div>
                <div>
                  <span className="font-display text-4xl font-extrabold tracking-editorial">
                    {currentTrip.members.length}
                  </span>
                  <span className="label-stamp block text-[10px] text-on-surface-variant mt-1">
                    Travelers
                  </span>
                </div>
                <div>
                  <span className="font-display text-4xl font-extrabold tracking-editorial">
                    {nights}
                  </span>
                  <span className="label-stamp block text-[10px] text-on-surface-variant mt-1">
                    Nights
                  </span>
                </div>
              </div>

              {/* Member avatars */}
              <div className="mt-6 flex items-center -space-x-2">
                {currentTrip.members.map((m) => (
                  <div
                    key={m.id}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ring-4 ring-surface-lowest"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.avatar}
                  </div>
                ))}
                <button className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-on-surface-variant text-lg font-medium ring-4 ring-surface-lowest hover:bg-surface-highest transition-colors">
                  +
                </button>
              </div>
            </div>

            {/* Budget ring */}
            <div className="flex flex-col items-center gap-2">
              <BudgetRing percent={budgetPercent} />
              <p className="text-sm text-on-surface-variant font-body">
                <span className="font-semibold text-on-surface">
                  ${currentTrip.totalSpent.toLocaleString()}
                </span>{" "}
                of ${currentTrip.totalBudget.toLocaleString()} {currentTrip.currency}
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  QUICK ACTIONS                                             */}
        {/* ---------------------------------------------------------- */}
        <section className="glass shadow-float rounded-3xl p-8">
          <h3 className="font-display text-xl font-extrabold tracking-editorial mb-6">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="bg-surface-lowest hover:bg-surface-low transition-colors rounded-2xl p-5 text-left group"
              >
                <div className={`w-12 h-12 ${action.bg} rounded-2xl flex items-center justify-center text-2xl mb-4`}>
                  {action.icon}
                </div>
                <p className="font-display font-bold text-sm tracking-editorial">
                  {action.label}
                </p>
                <p className="text-xs text-on-surface-variant font-body mt-1">
                  {action.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/*  TWO-COLUMN GRID                                           */}
        {/* ---------------------------------------------------------- */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* ------ ITINERARY PREVIEW ------ */}
          <section className="bg-surface-lowest rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-extrabold tracking-editorial">
                Itinerary
              </h3>
              <Link
                href="/itinerary"
                className="text-sm font-semibold text-primary hover:text-primary-container transition-colors"
              >
                View Full Plan &rarr;
              </Link>
            </div>

            <span className="label-stamp inline-block text-[10px] text-on-surface-variant mb-5">
              {day1Key.toUpperCase()}
            </span>

            {/* Timeline */}
            <div className="relative pl-8">
              {/* Dashed line */}
              <div
                className="absolute left-[11px] top-2 bottom-2 w-0"
                style={{ borderLeft: "2px dashed var(--outline-variant)" }}
              />

              <div className="space-y-5">
                {day1Items.map((item) => (
                  <div key={item.id} className="relative flex gap-4">
                    {/* Dot node */}
                    <div className="absolute -left-8 top-3 w-[22px] h-[22px] rounded-full bg-primary ring-4 ring-surface-lowest flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>

                    {/* Time */}
                    <span className="font-mono text-xs text-on-surface-variant pt-3 w-12 flex-shrink-0">
                      {item.time}
                    </span>

                    {/* Card */}
                    <div className="flex-1 bg-surface-low rounded-2xl p-4">
                      <span className={`label-stamp inline-block text-[9px] px-2.5 py-0.5 rounded-full ${categoryColors[item.category]} mb-2`}>
                        {item.category}
                      </span>
                      <p className="font-display font-bold text-sm tracking-editorial">
                        {item.title}
                      </p>
                      <p className="text-xs text-on-surface-variant font-body mt-0.5">
                        {item.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            {remainingDays > 0 && (
              <div className="mt-6 bg-surface-low rounded-2xl py-3 px-4 text-center">
                <span className="text-sm text-on-surface-variant font-body">
                  +{remainingDays} more day{remainingDays > 1 ? "s" : ""} planned
                </span>
              </div>
            )}
          </section>

          {/* ------ RECENT EXPENSES ------ */}
          <section className="bg-surface-lowest rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-extrabold tracking-editorial">
                Recent Expenses
              </h3>
              <Link
                href="/expenses"
                className="text-sm font-semibold text-primary hover:text-primary-container transition-colors"
              >
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {recentExpenses.map((expense) => {
                const payer = getMember(expense.paidBy);
                return (
                  <div
                    key={expense.id}
                    className="bg-surface-low rounded-2xl p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-surface-highest flex items-center justify-center text-lg flex-shrink-0">
                      {categoryIcons[expense.category] || "\uD83D\uDCCB"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm tracking-editorial truncate">
                        {expense.description}
                      </p>
                      <p className="text-xs text-on-surface-variant font-body mt-0.5">
                        Paid by {payer?.name} &middot; split {expense.splitBetween.length} ways
                      </p>
                    </div>
                    <span className="font-display font-extrabold text-sm tracking-editorial flex-shrink-0">
                      ${expense.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total footer */}
            <div className="mt-4 bg-surface-low rounded-2xl py-3 px-4 flex items-center justify-between">
              <span className="label-stamp text-[10px] text-on-surface-variant">
                Total Tracked
              </span>
              <span className="font-display font-extrabold text-base tracking-editorial">
                ${totalExpenses.toFixed(2)}
              </span>
            </div>
          </section>

          {/* ------ SETTLE UP ------ */}
          <section className="bg-surface-lowest rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-extrabold tracking-editorial">
                Settle Up
              </h3>
              <span className="label-stamp text-[10px] px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container">
                {debts.length} Pending
              </span>
            </div>

            <div className="space-y-3">
              {debts.map((debt, i) => {
                const from = getMember(debt.from);
                const to = getMember(debt.to);
                return (
                  <div
                    key={i}
                    className="bg-surface-low rounded-2xl p-4 flex items-center gap-3"
                  >
                    {/* From avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: from?.color }}
                    >
                      {from?.avatar}
                    </div>

                    {/* Arrow */}
                    <svg width="24" height="12" viewBox="0 0 24 12" className="text-on-surface-variant flex-shrink-0">
                      <path d="M0 6h20M16 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* To avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: to?.color }}
                    >
                      {to?.avatar}
                    </div>

                    {/* Names & amount */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body">
                        <span className="font-semibold">{from?.name}</span>
                        <span className="text-on-surface-variant"> owes </span>
                        <span className="font-semibold">{to?.name}</span>
                      </p>
                    </div>
                    <span className="font-display font-extrabold text-sm tracking-editorial text-primary flex-shrink-0">
                      ${debt.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Simplify button */}
            <button className="mt-6 w-full gradient-cta text-on-primary font-semibold py-3.5 rounded-full shadow-float hover:opacity-90 transition-opacity text-sm">
              Simplify Debts
            </button>
          </section>

          {/* ------ MAP VIEW PLACEHOLDER ------ */}
          <section className="bg-surface-lowest rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
            <span className="text-5xl mb-4">{"\uD83D\uDDFA\uFE0F"}</span>
            <h3 className="font-display text-xl font-extrabold tracking-editorial">
              Map View
            </h3>
            <p className="text-sm text-on-surface-variant font-body mt-2 max-w-xs">
              Visualize your full itinerary on an interactive map with route
              planning and local recommendations.
            </p>
            <span className="label-stamp inline-block text-[10px] px-4 py-1.5 rounded-full bg-surface-low text-on-surface-variant mt-5">
              Coming Soon
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}
