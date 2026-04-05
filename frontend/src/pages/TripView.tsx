import { useParams, useNavigate } from "@solidjs/router";
import {
  onMount,
  onCleanup,
  createSignal,
  createResource,
  createEffect,
  Show,
  For,
} from "solid-js";
import { useAuth } from "../lib/auth";
import * as api from "../lib/api";
import type { ActivityPin } from "../lib/api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths broken by bundlers
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "\uD83C\uDF74",
  activity: "\u26F7\uFE0F",
  lodging: "\uD83C\uDFE8",
  transport: "\u2708\uFE0F",
  sightseeing: "\uD83C\uDFDB\uFE0F",
  general: "\uD83D\uDCCD",
};

export default function TripView() {
  const params = useParams<{ tripId: string }>();
  const auth = useAuth();
  const navigate = useNavigate();

  onMount(() => {
    if (!auth.token()) {
      navigate("/login", { replace: true });
    }
  });

  const [trip] = createResource(
    () => (auth.token() ? params.tripId : undefined),
    (id) => api.getTrip(auth.token()!, id)
  );

  const [pins, { refetch: refetchPins }] = createResource(
    () => (auth.token() ? params.tripId : undefined),
    (id) => api.listPins(auth.token()!, id).then((r) => r.pins)
  );

  const [showAddModal, setShowAddModal] = createSignal(false);
  const [clickedLatLng, setClickedLatLng] = createSignal<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activeTab, setActiveTab] = createSignal("map");

  let mapContainer!: HTMLDivElement;
  let mapInstance: L.Map | undefined;
  let markersLayer: L.LayerGroup | undefined;

  onMount(() => {
    // Small delay to ensure container is rendered
    setTimeout(initMap, 100);
  });

  function initMap() {
    if (!mapContainer || mapInstance) return;

    mapInstance = L.map(mapContainer, {
      zoomControl: false,
    }).setView([20, 0], 3);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance);

    L.control.zoom({ position: "bottomleft" }).addTo(mapInstance);

    markersLayer = L.layerGroup().addTo(mapInstance);

    mapInstance.on("click", (e: L.LeafletMouseEvent) => {
      setClickedLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
      setShowAddModal(true);
    });
  }

  // Update markers when pins change
  createEffect(() => {
    const pinData = pins();
    if (!markersLayer || !mapInstance) return;

    markersLayer.clearLayers();

    if (!pinData || pinData.length === 0) return;

    const bounds: L.LatLngExpression[] = [];

    for (const pin of pinData) {
      const emoji = CATEGORY_ICONS[pin.category] || CATEGORY_ICONS.general;
      const statusClass =
        pin.status === "confirmed" ? "pin-confirmed" : "pin-proposed";

      const icon = L.divIcon({
        className: "map-pin-wrapper",
        html: `<div class="map-pin-icon ${statusClass}">
          <span class="pin-emoji">${emoji}</span>
          <span class="pin-label">${pin.title}</span>
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pin.latitude, pin.longitude], { icon });

      const popupContent = `
        <div class="pin-popup">
          <div class="pin-popup-title">${pin.title}</div>
          ${pin.description ? `<div class="pin-popup-desc">${pin.description}</div>` : ""}
          <div class="pin-popup-meta">
            <span class="pin-popup-category">${pin.category.toUpperCase()}</span>
            <span class="pin-popup-status status-badge status-${pin.status}">${pin.status}</span>
          </div>
          <div class="pin-popup-author">Added by ${pin.created_by}</div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: "pin-popup-container",
        maxWidth: 250,
      });

      marker.addTo(markersLayer!);
      bounds.push([pin.latitude, pin.longitude]);
    }

    if (bounds.length > 0) {
      mapInstance.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
    }
  });

  onCleanup(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = undefined;
    }
  });

  const panToPin = (pin: ActivityPin) => {
    if (mapInstance) {
      mapInstance.setView([pin.latitude, pin.longitude], 15, {
        animate: true,
      });
    }
  };

  const handleDeletePin = async (pinId: string) => {
    try {
      await api.deletePin(auth.token()!, params.tripId, pinId);
      refetchPins();
    } catch (err: any) {
      console.error("Failed to delete pin:", err);
    }
  };

  const handleToggleStatus = async (pin: ActivityPin) => {
    const newStatus = pin.status === "proposed" ? "confirmed" : "proposed";
    try {
      await api.updatePin(auth.token()!, params.tripId, pin.id, {
        status: newStatus,
      });
      refetchPins();
    } catch (err: any) {
      console.error("Failed to update pin:", err);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div class="trip-view-layout">
      {/* Left sidebar nav */}
      <aside class="trip-nav-sidebar">
        <div class="sidebar-brand">
          <span
            class="sidebar-brand-text"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/dashboard")}
          >
            Editorial Wanderlust
          </span>
        </div>
        <nav class="sidebar-nav">
          <button
            class={`sidebar-link trip-nav-link ${activeTab() === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            <span class="nav-icon">&#x1F5FA;</span> Map
          </button>
          <button
            class="sidebar-link trip-nav-link disabled-link"
            disabled
          >
            <span class="nav-icon">&#x1F4CD;</span> Itinerary
          </button>
          <button
            class="sidebar-link trip-nav-link disabled-link"
            disabled
          >
            <span class="nav-icon">&#x1F4B0;</span> Expenses
          </button>
          <button
            class="sidebar-link trip-nav-link disabled-link"
            disabled
          >
            <span class="nav-icon">&#x1F512;</span> Vault
          </button>
          <button
            class="sidebar-link trip-nav-link disabled-link"
            disabled
          >
            <span class="nav-icon">&#x2699;</span> Settings
          </button>
        </nav>

        {/* Trip info card at bottom */}
        <div class="trip-info-card">
          <Show when={trip()}>
            <h4 class="trip-info-name">{trip()!.name}</h4>
            <Show when={trip()!.start_date || trip()!.end_date}>
              <p class="trip-info-dates">
                {formatDate(trip()!.start_date)} - {formatDate(trip()!.end_date)}
              </p>
            </Show>
          </Show>
        </div>
      </aside>

      {/* Main content: map area */}
      <div class="trip-main-content">
        {/* Trip header */}
        <header class="trip-header">
          <div>
            <Show when={trip()} fallback={<h2>Loading...</h2>}>
              <h2 class="trip-header-title">{trip()!.name}</h2>
              <Show when={trip()!.start_date}>
                <span class="trip-header-dates">
                  {formatDate(trip()!.start_date)} - {formatDate(trip()!.end_date)}
                </span>
              </Show>
            </Show>
          </div>
          <div class="trip-header-actions">
            <span class="trip-member-count">
              {trip()?.member_count ?? 0}{" "}
              {(trip()?.member_count ?? 0) === 1 ? "member" : "members"}
            </span>
          </div>
        </header>

        {/* Map container */}
        <div class="map-container" ref={mapContainer!} />

        {/* Click-to-add hint */}
        <div class="map-hint">
          <span>Click anywhere on the map to add an activity pin</span>
        </div>
      </div>

      {/* Right panel: pin list */}
      <aside class="pin-list-panel">
        <div class="pin-panel-header">
          <h3 class="pin-panel-title">Activity Pins</h3>
          <span class="pin-count-badge">{(pins() ?? []).length} pins</span>
        </div>

        <Show
          when={!pins.loading}
          fallback={<p class="loading-text">Loading pins...</p>}
        >
          <Show
            when={(pins() ?? []).length > 0}
            fallback={
              <div class="pin-empty-state">
                <p>No pins yet</p>
                <p class="pin-empty-hint">
                  Click on the map to add your first activity
                </p>
              </div>
            }
          >
            <div class="pin-list">
              <For each={pins()}>
                {(pin) => (
                  <div class="pin-card" onClick={() => panToPin(pin)}>
                    <div class="pin-card-header">
                      <span class="pin-card-emoji">
                        {CATEGORY_ICONS[pin.category] || CATEGORY_ICONS.general}
                      </span>
                      <div class="pin-card-title-group">
                        <h4 class="pin-card-title">{pin.title}</h4>
                        <span class="pin-card-category">
                          {pin.category.toUpperCase()}
                        </span>
                      </div>
                      <span
                        class={`status-badge status-${pin.status}`}
                        style={{ cursor: "pointer", "font-size": "0.55rem" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(pin);
                        }}
                        title="Click to toggle status"
                      >
                        {pin.status}
                      </span>
                    </div>
                    <Show when={pin.description}>
                      <p class="pin-card-desc">{pin.description}</p>
                    </Show>
                    <div class="pin-card-footer">
                      <span class="pin-card-author">by {pin.created_by}</span>
                      <button
                        class="pin-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePin(pin.id);
                        }}
                        title="Delete pin"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </aside>

      {/* Add Pin Modal */}
      <Show when={showAddModal() && clickedLatLng()}>
        <AddPinModal
          latLng={clickedLatLng()!}
          tripId={params.tripId}
          token={auth.token()!}
          onClose={() => {
            setShowAddModal(false);
            setClickedLatLng(null);
          }}
          onCreated={() => {
            setShowAddModal(false);
            setClickedLatLng(null);
            refetchPins();
          }}
        />
      </Show>
    </div>
  );
}

function AddPinModal(props: {
  latLng: { lat: number; lng: number };
  tripId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("general");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: api.CreatePinPayload = {
        title: title(),
        latitude: props.latLng.lat,
        longitude: props.latLng.lng,
        category: category(),
      };
      if (description()) payload.description = description();

      await api.createPin(props.token, props.tripId, payload);
      props.onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create pin");
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onClose();
  };

  return (
    <div
      class="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="Add activity pin"
    >
      <div class="modal-card">
        <div class="modal-header">
          <h2>Add Activity</h2>
          <button
            class="modal-close"
            onClick={props.onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error() && <div class="error-message">{error()}</div>}

        <div class="pin-latlng-display">
          <span>
            {props.latLng.lat.toFixed(4)}, {props.latLng.lng.toFixed(4)}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="pin-title">Activity Name</label>
            <input
              id="pin-title"
              type="text"
              placeholder="Blue Grotto Boat Tour"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-group">
            <label for="pin-category">Category</label>
            <select
              id="pin-category"
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              <option value="general">General</option>
              <option value="restaurant">Restaurant</option>
              <option value="activity">Activity</option>
              <option value="lodging">Lodging</option>
              <option value="transport">Transport</option>
              <option value="sightseeing">Sightseeing</option>
            </select>
          </div>

          <div class="form-group">
            <label for="pin-desc">Description</label>
            <textarea
              id="pin-desc"
              placeholder="What makes this place special?"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={3}
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Adding..." : "Add to Map"}
          </button>
        </form>
      </div>
    </div>
  );
}
