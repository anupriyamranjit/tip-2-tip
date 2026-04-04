"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "📊", label: "Dashboard", href: "/dashboard" },
  { icon: "🗓️", label: "Itinerary", href: "/itinerary" },
  { icon: "💰", label: "Expenses", href: "/expenses" },
  { icon: "📎", label: "Vault", href: "/vault" },
  { icon: "🗺️", label: "Map", href: "/map" },
  { icon: "🗳️", label: "Polls", href: "/dashboard" },
  { icon: "🧰", label: "Toolkit", href: "/dashboard" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] bg-surface-lowest flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-8 pt-8 pb-6">
        <Link href="/">
          <h1 className="font-display text-2xl font-extrabold tracking-editorial">
            <span className="text-primary">tip</span>
            <span className="text-on-surface-variant">2</span>
            <span className="text-primary">tip</span>
          </h1>
        </Link>
        <p className="label-stamp text-[11px] text-on-surface-variant mt-1">
          Group Trip Planner
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-5 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-surface-low text-primary font-semibold"
                  : "text-on-surface-variant hover:bg-surface-low/60 hover:text-on-surface"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Trip Selector */}
      <div className="px-5 pb-6">
        <div className="bg-surface-low rounded-2xl p-4">
          <p className="label-stamp text-[10px] text-on-surface-variant">
            Current Trip
          </p>
          <p className="font-display text-sm font-bold mt-1.5 text-on-surface">
            🇹🇭 Thailand Adventure
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Apr 18 – 28, 2026
          </p>
        </div>
      </div>
    </aside>
  );
}
