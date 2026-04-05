import { useNavigate } from "@solidjs/router";
import { onMount, createSignal, createResource, Show, For } from "solid-js";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";
import type { Trip } from "../lib/api";

export default function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = createSignal(false);

  onMount(() => {
    if (!auth.token()) {
      navigate("/login", { replace: true });
    }
  });

  const [trips, { refetch }] = createResource(
    () => auth.token(),
    async (token) => {
      if (!token) return [];
      const res = await api.getMyTrips(token);
      return res.trips;
    }
  );

  const handleLogout = () => {
    auth.logout();
    navigate("/login", { replace: true });
  };

  const upcomingTrips = () => {
    const all = trips() ?? [];
    return all.filter(
      (t) => t.status === "proposed" || t.status === "confirmed"
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return "Dates TBD";
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return `From ${formatDate(start)}`;
    return `Until ${formatDate(end)}`;
  };

  return (
    <div class="dash-layout">
      <aside class="dash-sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-brand-text">Editorial Wanderlust</span>
        </div>
        <nav class="sidebar-nav">
          <a class="sidebar-link active" href="/dashboard">
            Current Trips
          </a>
          <a class="sidebar-link" href="#">
            Past Journeys
          </a>
          <a class="sidebar-link" href="#">
            Saved Places
          </a>
          <a class="sidebar-link" href="#">
            Settings
          </a>
        </nav>
        <div class="sidebar-footer">
          <button class="sidebar-link logout-link" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>

      <main class="dash-main">
        <header class="dash-header">
          <div>
            <span class="status-label">Status: Global Explorer</span>
            <h1 class="dash-greeting">
              Hello, {auth.user()?.username ?? "Traveler"}
            </h1>
            <p class="dash-subtitle">
              Your next expedition awaits. Where to next?
            </p>
          </div>
          <button class="btn-new-trip" onClick={() => setShowModal(true)}>
            + New Adventure
          </button>
        </header>

        <section class="trips-section">
          <div class="section-header">
            <h2 class="section-label">Upcoming Journeys</h2>
          </div>

          <Show when={!trips.loading} fallback={<p class="loading-text">Loading your journeys...</p>}>
            <Show
              when={upcomingTrips().length > 0}
              fallback={
                <div class="empty-state">
                  <h3>No journeys yet</h3>
                  <p>Start planning your first adventure</p>
                  <button
                    class="btn-new-trip"
                    onClick={() => setShowModal(true)}
                  >
                    + New Adventure
                  </button>
                </div>
              }
            >
              <div class="trips-grid">
                <For each={upcomingTrips()}>
                  {(trip) => <TripCard trip={trip} formatDateRange={formatDateRange} />}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </main>

      <Show when={showModal()}>
        <CreateTripModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            refetch();
          }}
          token={auth.token()!}
        />
      </Show>
    </div>
  );
}

function TripCard(props: {
  trip: Trip;
  formatDateRange: (s: string | null, e: string | null) => string;
}) {
  const coverImages = [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80",
    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
  ];

  const coverUrl = () =>
    props.trip.cover_image_url ||
    coverImages[Math.abs(hashCode(props.trip.id)) % coverImages.length];

  return (
    <div class="trip-card">
      <div
        class="trip-card-image"
        style={{ "background-image": `url(${coverUrl()})` }}
      >
        <span class={`status-badge status-${props.trip.status}`}>
          {props.trip.status}
        </span>
      </div>
      <div class="trip-card-body">
        <h3 class="trip-card-name">{props.trip.name}</h3>
        <Show when={props.trip.destination}>
          <p class="trip-card-destination">{props.trip.destination}</p>
        </Show>
        <div class="trip-card-meta">
          <span class="trip-card-dates">
            {props.formatDateRange(props.trip.start_date, props.trip.end_date)}
          </span>
          <span class="trip-card-members">
            {props.trip.member_count}{" "}
            {props.trip.member_count === 1 ? "member" : "members"}
          </span>
        </div>
      </div>
    </div>
  );
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function CreateTripModal(props: {
  onClose: () => void;
  onCreated: () => void;
  token: string;
}) {
  const [name, setName] = createSignal("");
  const [destination, setDestination] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: api.CreateTripPayload = { name: name() };
      if (destination()) payload.destination = destination();
      if (startDate()) payload.start_date = startDate();
      if (endDate()) payload.end_date = endDate();
      if (description()) payload.description = description();

      await api.createTrip(props.token, payload);
      props.onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose();
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-label="Create a new trip">
      <div class="modal-card">
        <div class="modal-header">
          <h2>New Adventure</h2>
          <button class="modal-close" onClick={props.onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {error() && <div class="error-message">{error()}</div>}

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="trip-name">Trip Name</label>
            <input
              id="trip-name"
              type="text"
              placeholder="Swiss Alps Expedition"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-group">
            <label for="trip-dest">Destination</label>
            <input
              id="trip-dest"
              type="text"
              placeholder="Switzerland"
              value={destination()}
              onInput={(e) => setDestination(e.currentTarget.value)}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="trip-start">Start Date</label>
              <input
                id="trip-start"
                type="date"
                value={startDate()}
                onInput={(e) => setStartDate(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label for="trip-end">End Date</label>
              <input
                id="trip-end"
                type="date"
                value={endDate()}
                onInput={(e) => setEndDate(e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="form-group">
            <label for="trip-desc">Description</label>
            <textarea
              id="trip-desc"
              placeholder="A brief description of your adventure..."
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={3}
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Creating..." : "Create Adventure"}
          </button>
        </form>
      </div>
    </div>
  );
}
