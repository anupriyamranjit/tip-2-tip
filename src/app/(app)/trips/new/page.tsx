"use client";

import { useState } from "react";

const steps = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Collaborators" },
  { number: 3, label: "Preferences" },
];

const travelStyles = ["Adventure", "Relaxation", "Culture", "Foodie", "Budget", "Luxury"];
const accommodationTypes = ["Hotel", "Airbnb", "Hostel", "Resort"];

const mockMembers = [
  { name: "Anupriya Ranjit", email: "anupriya@example.com", role: "ORGANIZER", avatar: "AR" },
  { name: "Maya Chen", email: "maya.chen@example.com", role: "EDITOR", avatar: "MC" },
  { name: "Liam Torres", email: "liam.t@example.com", role: "EDITOR", avatar: "LT" },
  { name: "Sofia Bergmann", email: "sofia.b@example.com", role: "EDITOR", avatar: "SB" },
];

const mockInvited = [
  { email: "sarah.k@example.com", status: "Pending" },
  { email: "james.w@example.com", status: "Pending" },
];

/* Rich photo-like gradients for cover image thumbnails */
const coverGradients = [
  /* Sunset beach — warm oranges, pinks, amber */
  "bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600",
  /* Mountain village — greens, teals, earth tones */
  "bg-gradient-to-br from-emerald-600 via-teal-500 to-amber-700",
  /* City skyline — deep blues, purples, neon hints */
  "bg-gradient-to-br from-indigo-800 via-purple-700 to-fuchsia-500",
  /* Tropical jungle — lush greens, emeralds */
  "bg-gradient-to-br from-green-700 via-emerald-500 to-lime-400",
];

export default function NewTripPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedAccommodation, setSelectedAccommodation] = useState<string[]>([]);
  const [selectedCover, setSelectedCover] = useState<number | null>(null);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const toggleAccommodation = (type: string) => {
    setSelectedAccommodation((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="flex h-full min-h-screen">
      {/* ─── Left Sidebar ─── */}
      <aside className="w-[260px] shrink-0 bg-surface-lowest p-8 flex flex-col">
        <div className="mb-12">
          <h2 className="font-display text-xl font-extrabold tracking-editorial text-on-surface">
            New Journey
          </h2>
          <span className="label-stamp text-[10px] text-on-surface-variant mt-2 block">
            STEP {currentStep} OF 3
          </span>
        </div>

        <nav className="flex flex-col relative">
          {steps.map((step, idx) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;
            const isLast = idx === steps.length - 1;

            return (
              <div key={step.number} className="flex items-start gap-3 relative">
                {/* Circle + dashed connector */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setCurrentStep(step.number)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                      isActive
                        ? "gradient-cta text-on-primary shadow-float"
                        : isCompleted
                        ? "gradient-cta/80 text-on-primary"
                        : "bg-surface-variant text-on-surface-variant"
                    }`}
                  >
                    {isCompleted ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 7L5.5 10.5L12 3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </button>
                  {!isLast && (
                    <div className="w-0 h-10 border-l-2 border-dashed border-outline-variant my-1" />
                  )}
                </div>

                {/* Label */}
                <div className="pt-2">
                  <span
                    className={`text-sm font-semibold transition-colors ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                        ? "text-on-surface"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-8">
          <p className="text-xs text-on-surface-variant/60 leading-relaxed">
            Your progress is saved automatically.
          </p>
        </div>
      </aside>

      {/* ─── Right Content Area ─── */}
      <div className="flex-1 flex flex-col bg-surface overflow-y-auto">
        <div className="flex-1 px-12 py-10">
          {currentStep === 1 && (
            <StepBasicInfo
              selectedCover={selectedCover}
              setSelectedCover={setSelectedCover}
            />
          )}
          {currentStep === 2 && <StepCollaborators />}
          {currentStep === 3 && (
            <StepPreferences
              selectedStyles={selectedStyles}
              toggleStyle={toggleStyle}
              selectedAccommodation={selectedAccommodation}
              toggleAccommodation={toggleAccommodation}
            />
          )}
        </div>

        {/* ─── Bottom Bar ─── */}
        <div className="glass sticky bottom-0 px-12 py-4 flex items-center justify-between shadow-float">
          <p className="text-xs text-on-surface-variant/50">
            Your progress is saved automatically
          </p>

          <div className="flex items-center gap-5">
            {currentStep === 1 && (
              <>
                <a
                  href="/dashboard"
                  className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  Cancel
                </a>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="gradient-cta text-on-primary font-semibold text-sm px-8 py-3 rounded-full shadow-float hover:opacity-90 transition-opacity"
                >
                  Next Step &rarr;
                </button>
              </>
            )}

            {currentStep === 2 && (
              <>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  &larr; Back to Basic Info
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="gradient-cta text-on-primary font-semibold text-sm px-8 py-3 rounded-full shadow-float hover:opacity-90 transition-opacity"
                >
                  Next Step: Preferences &rarr;
                </button>
              </>
            )}

            {currentStep === 3 && (
              <>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  &larr; Back
                </button>
                <button className="gradient-cta text-on-primary font-semibold text-sm px-8 py-3 rounded-full shadow-float hover:opacity-90 transition-opacity">
                  Create Trip &rarr;
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step 1: Basic Info
   ───────────────────────────────────────────────────────────────────────────── */
function StepBasicInfo({
  selectedCover,
  setSelectedCover,
}: {
  selectedCover: number | null;
  setSelectedCover: (i: number) => void;
}) {
  return (
    <div className="relative max-w-2xl">
      <h1 className="font-display text-5xl font-extrabold tracking-editorial text-on-surface leading-tight">
        Where does the story begin?
      </h1>
      <p className="mt-5 text-on-surface-variant text-base leading-relaxed max-w-lg">
        Every great itinerary starts with a name and a destination. Let&apos;s frame your next chapter.
      </p>

      <div className="mt-12 space-y-8">
        {/* Trip Name */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Trip Name
          </label>
          <input
            type="text"
            placeholder="e.g., Amalfi Coast Adventure"
            className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Destination */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Destination
          </label>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Country"
              className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
            <input
              type="text"
              placeholder="Region / City"
              className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
        </div>

        {/* Travel Dates */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Travel Dates
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="date"
                className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
              <span className="text-[10px] text-on-surface-variant/60 mt-1 block pl-1">
                Start Date
              </span>
            </div>
            <div>
              <input
                type="date"
                className="w-full bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
              <span className="text-[10px] text-on-surface-variant/60 mt-1 block pl-1">
                End Date
              </span>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
            Cover Image
          </label>
          <div className="grid grid-cols-4 gap-3">
            {coverGradients.map((gradient, i) => (
              <button
                key={i}
                onClick={() => setSelectedCover(i)}
                className={`${gradient} rounded-2xl h-24 flex items-center justify-center transition hover:scale-[1.03] relative overflow-hidden ${
                  selectedCover === i
                    ? "ring-3 ring-primary ring-offset-2 ring-offset-surface"
                    : ""
                }`}
              >
                {/* Texture overlay to make gradient feel photo-like */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white/50 relative z-10"
                >
                  <path
                    d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TIP watermark */}
      <div className="absolute bottom-0 right-0 select-none pointer-events-none">
        <span className="font-display text-[120px] font-extrabold tracking-editorial text-on-surface/[0.03] leading-none">
          TIP
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step 2: Collaborators
   ───────────────────────────────────────────────────────────────────────────── */
function StepCollaborators() {
  return (
    <div className="flex gap-12">
      {/* ─── Left Column (~55%) ─── */}
      <div className="flex-[55] min-w-0">
        <span className="label-stamp text-[11px] text-on-surface-variant mb-4 block">
          Collaboration
        </span>
        <h1 className="font-display text-5xl font-extrabold tracking-editorial text-on-surface leading-tight">
          Plan together,
          <br />
          <span className="italic text-tertiary-container">travel better.</span>
        </h1>
        <p className="mt-5 text-on-surface-variant text-base leading-relaxed max-w-md">
          A journey is best measured in friends, rather than miles. Bring your travel
          companions into the fold to build your dream itinerary together.
        </p>

        <div className="mt-10 space-y-8">
          {/* Invite by Email */}
          <div>
            <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
              Invite by Email
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="colleague@example.com"
                className="flex-1 bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
              <button className="gradient-cta text-on-primary font-semibold text-sm px-6 py-3.5 rounded-full shadow-float hover:opacity-90 transition-opacity shrink-0">
                Send &rarr;
              </button>
            </div>
          </div>

          {/* Share Via Link */}
          <div>
            <label className="label-stamp text-[11px] text-on-surface-variant mb-2 block">
              Share Via Link
            </label>
            <div className="flex gap-3">
              <div className="flex-1 bg-surface-low rounded-2xl px-5 py-3.5 text-on-surface-variant text-sm truncate flex items-center">
                https://tip2tip.app/invite/aXk3mNq9z
              </div>
              <button className="bg-surface-low rounded-2xl px-6 py-3.5 text-sm font-semibold text-primary hover:bg-surface-highest transition-colors shrink-0">
                Copy
              </button>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-2 pl-1">
              Invite links expire in 48 hours for security.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Right Column (~45%) ─── */}
      <div className="flex-[45] min-w-0">
        {/* Trip Planners */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-display text-lg font-bold tracking-editorial text-on-surface">
              Trip Planners
            </h3>
            <span className="label-stamp text-[10px] text-on-surface-variant bg-surface-low rounded-full px-2.5 py-0.5">
              {mockMembers.length}
            </span>
          </div>
          <div className="space-y-3">
            {mockMembers.map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-4 bg-surface-lowest rounded-2xl px-5 py-4 shadow-float"
              >
                <div className="w-10 h-10 rounded-full gradient-cta text-on-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {member.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {member.name}
                  </p>
                </div>
                <span
                  className={`label-stamp text-[10px] px-3 py-1 rounded-full ${
                    member.role === "ORGANIZER"
                      ? "gradient-cta text-on-primary"
                      : "bg-surface-low text-on-surface-variant"
                  }`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Invited Members */}
        <div className="mt-8">
          <h3 className="font-display text-lg font-bold tracking-editorial text-on-surface mb-4">
            Invited Members
          </h3>
          <div className="space-y-3">
            {mockInvited.map((invite) => (
              <div
                key={invite.email}
                className="flex items-center gap-4 bg-surface-low rounded-2xl px-5 py-4"
              >
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-on-surface-variant"
                  >
                    <path
                      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{invite.email}</p>
                </div>
                <span className="label-stamp text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant">
                  PENDING
                </span>
                <button className="text-xs font-semibold text-primary hover:text-primary-container transition-colors">
                  Resend
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step 3: Preferences
   ───────────────────────────────────────────────────────────────────────────── */
function StepPreferences({
  selectedStyles,
  toggleStyle,
  selectedAccommodation,
  toggleAccommodation,
}: {
  selectedStyles: string[];
  toggleStyle: (s: string) => void;
  selectedAccommodation: string[];
  toggleAccommodation: (t: string) => void;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-5xl font-extrabold tracking-editorial text-on-surface leading-tight">
        Set the mood.
      </h1>
      <p className="mt-5 text-on-surface-variant text-base leading-relaxed max-w-lg">
        Help us tailor recommendations by telling us your travel style and preferences.
      </p>

      <div className="mt-12 space-y-10">
        {/* Budget Range */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-3 block">
            Budget Range
          </label>
          <div className="bg-surface-low rounded-2xl p-6">
            <div className="flex justify-between text-sm text-on-surface-variant mb-4">
              <span>$500</span>
              <span className="font-semibold text-primary">$2,500</span>
              <span>$10,000+</span>
            </div>
            {/* Visual range (styled, not functional) */}
            <div className="relative h-2 bg-surface-highest rounded-full">
              <div className="absolute left-[10%] right-[55%] h-full gradient-cta rounded-full" />
              <div className="absolute left-[10%] top-1/2 -translate-y-1/2 w-4 h-4 bg-surface-lowest rounded-full shadow-float ring-4 ring-primary/20" />
              <div className="absolute left-[45%] top-1/2 -translate-y-1/2 w-4 h-4 bg-surface-lowest rounded-full shadow-float ring-4 ring-primary/20" />
            </div>
          </div>
        </div>

        {/* Travel Style */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-3 block">
            Travel Style
          </label>
          <div className="flex flex-wrap gap-3">
            {travelStyles.map((style) => {
              const isSelected = selectedStyles.includes(style);
              return (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    isSelected
                      ? "gradient-cta text-on-primary shadow-float"
                      : "bg-surface-low text-on-surface hover:bg-surface-highest"
                  }`}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accommodation */}
        <div>
          <label className="label-stamp text-[11px] text-on-surface-variant mb-3 block">
            Accommodation Preference
          </label>
          <div className="flex flex-wrap gap-3">
            {accommodationTypes.map((type) => {
              const isSelected = selectedAccommodation.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleAccommodation(type)}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    isSelected
                      ? "gradient-cta text-on-primary shadow-float"
                      : "bg-surface-low text-on-surface hover:bg-surface-highest"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
