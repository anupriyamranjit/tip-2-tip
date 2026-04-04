"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardHeader() {
  const { user } = useAuth();
  const firstName = user?.name.split(" ")[0] ?? "Traveler";

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-editorial text-on-surface">
        Dashboard
      </h1>
      <p className="text-on-surface-variant text-sm mt-1">
        Welcome back, {firstName}. Your Thailand trip is coming up!
      </p>
    </div>
  );
}
