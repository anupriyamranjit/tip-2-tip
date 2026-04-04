"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

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
  const { user, logout } = useAuth();

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
      <div className="px-5 pb-4">
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

      {/* User + New Trip + Logout */}
      <div className="px-5 pb-6 space-y-3">
        <Link
          href="/trips/new"
          className="flex items-center justify-center gap-2 w-full gradient-cta text-on-primary font-semibold text-sm py-2.5 rounded-full shadow-float hover:opacity-90 transition-opacity"
        >
          <span className="text-base">+</span>
          New Trip
        </Link>

        {user && (
          <div className="flex items-center gap-3 bg-surface-low rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-full gradient-cta text-on-primary flex items-center justify-center text-xs font-bold shrink-0">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-on-surface-variant truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
