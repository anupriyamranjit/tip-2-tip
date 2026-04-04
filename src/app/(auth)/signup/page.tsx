"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function SignUpPage() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Brand */}
      <Link href="/" className="inline-block mb-10">
        <h1 className="font-display text-2xl font-extrabold tracking-editorial">
          <span className="text-primary">tip</span>
          <span className="text-on-surface-variant">2</span>
          <span className="text-primary">tip</span>
        </h1>
      </Link>

      <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-editorial text-on-surface leading-tight">
        Create your account
      </h2>
      <p className="mt-3 text-on-surface-variant text-base">
        Start planning your next adventure with friends.
      </p>

      {/* Error message */}
      {error && (
        <div className="mt-6 bg-error-container/20 text-error rounded-2xl px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {/* Full Name */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anupriyam Ranjit"
            autoComplete="name"
            className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Email */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Password */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            autoComplete="new-password"
            className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full gradient-cta text-on-primary font-semibold text-sm py-3.5 rounded-full shadow-float hover:opacity-90 transition-opacity disabled:opacity-60 mt-2"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {/* Divider */}
      <div className="mt-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-outline-variant/30" />
        <span className="label-stamp text-[10px] text-on-surface-variant">
          OR CONTINUE WITH
        </span>
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>

      {/* Social buttons */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 bg-surface-low rounded-2xl py-3 text-sm font-semibold text-on-surface hover:bg-surface-highest transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>
        <button className="flex items-center justify-center gap-2 bg-surface-low rounded-2xl py-3 text-sm font-semibold text-on-surface hover:bg-surface-highest transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Apple
        </button>
      </div>

      {/* Login link */}
      <p className="mt-8 text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
