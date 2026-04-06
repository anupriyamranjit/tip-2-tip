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
import type { ActivityPin, PinDocument } from "../lib/api";
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

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [expandedPinId, setExpandedPinId] = createSignal<string | null>(null);
  const [editingPin, setEditingPin] = createSignal<ActivityPin | null>(null);
  const [confirmDeletePin, setConfirmDeletePin] = createSignal<ActivityPin | null>(null);
  const [wsConnected, setWsConnected] = createSignal(false);
  const [liveEditing, setLiveEditing] = createSignal(false);

  let mapContainer!: HTMLDivElement;
  let mapInstance: L.Map | undefined;
  let markersLayer: L.LayerGroup | undefined;

  onMount(() => {
    setTimeout(initMap, 100);
  });

  // ── Real-time WebSocket connection (opt-in) ──
  let wsRef: WebSocket | null = null;
  let reconnectTimerRef: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let intentionallyClosed = false;

  function connectWs() {
    const token = auth.token();
    if (!token) return;

    intentionallyClosed = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/v1/trips/${params.tripId}/ws?token=${encodeURIComponent(token)}`;

    wsRef = new WebSocket(wsUrl);

    wsRef.onopen = () => {
      setWsConnected(true);
      reconnectDelay = 1000;
    };

    wsRef.onmessage = (_event) => {
      // Any event means data changed — refetch pins
      refetchPins();
    };

    wsRef.onclose = () => {
      setWsConnected(false);
      if (!intentionallyClosed) {
        reconnectTimerRef = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          connectWs();
        }, reconnectDelay);
      }
    };

    wsRef.onerror = () => {
      wsRef?.close();
    };
  }

  function disconnectWs() {
    intentionallyClosed = true;
    if (reconnectTimerRef) clearTimeout(reconnectTimerRef);
    wsRef?.close();
    wsRef = null;
    setWsConnected(false);
    setLiveEditing(false);
  }

  function toggleLiveEditing() {
    if (liveEditing()) {
      disconnectWs();
    } else {
      setLiveEditing(true);
      connectWs();
    }
  }

  onCleanup(() => {
    disconnectWs();
  });

  function initMap() {
    if (!mapContainer || mapInstance) return;

    mapInstance = L.map(mapContainer, {
      zoomControl: false,
    }).setView([20, 0], 3);

    const isRetina = window.devicePixelRatio > 1;
    L.tileLayer(
      isRetina
        ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 20,
        tileSize: 256,
        subdomains: "abcd",
      }
    ).addTo(mapInstance);

    L.control.zoom({ position: "bottomleft" }).addTo(mapInstance);

    markersLayer = L.layerGroup().addTo(mapInstance);

    mapInstance.on("click", (e: L.LeafletMouseEvent) => {
      if (!liveEditing()) return; // Only allow adding pins when live editing
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

      const scheduledHtml = pin.scheduled_at
        ? `<div class="pin-popup-schedule">${formatScheduledAt(pin.scheduled_at)}</div>`
        : "";
      const priceHtml = pin.price_cents
        ? `<div class="pin-popup-price">${formatPrice(pin.price_cents)}</div>`
        : "";

      const popupContent = `
        <div class="pin-popup">
          <div class="pin-popup-title">${pin.title}</div>
          ${pin.description ? `<div class="pin-popup-desc">${pin.description}</div>` : ""}
          ${scheduledHtml}${priceHtml}
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
      setConfirmDeletePin(null);
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

  const handleUploadDocument = async (pinId: string, file: File) => {
    try {
      await api.uploadDocument(auth.token()!, params.tripId, pinId, file);
      refetchPins();
    } catch (err: any) {
      console.error("Failed to upload document:", err);
    }
  };

  const handleDeleteDocument = async (pinId: string, docId: string) => {
    try {
      await api.deleteDocument(auth.token()!, params.tripId, pinId, docId);
      refetchPins();
    } catch (err: any) {
      console.error("Failed to delete document:", err);
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
            <button
              class={`live-edit-toggle ${liveEditing() ? (wsConnected() ? "live-active" : "live-connecting") : "live-inactive"}`}
              onClick={toggleLiveEditing}
              title={liveEditing() ? "Leave live editing session" : "Join live editing session"}
            >
              <span class="live-edit-dot" />
              {liveEditing()
                ? wsConnected()
                  ? "Live Editing"
                  : "Connecting..."
                : "Join Live Edit"}
            </button>
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
          <span>
            {liveEditing()
              ? "Click anywhere on the map to add an activity pin"
              : "Join live editing to add or modify activity pins"}
          </span>
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
                  <div
                    class={`pin-card ${expandedPinId() === pin.id ? "pin-card-expanded" : ""}`}
                    onClick={() => panToPin(pin)}
                  >
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

                    {/* Schedule and price row */}
                    <Show when={pin.scheduled_at || pin.price_cents}>
                      <div class="pin-card-details">
                        <Show when={pin.scheduled_at}>
                          <span class="pin-detail-chip">
                            <span class="pin-detail-icon">&#x1F4C5;</span>
                            {formatScheduledAt(pin.scheduled_at!)}
                          </span>
                        </Show>
                        <Show when={pin.price_cents}>
                          <span class="pin-detail-chip pin-detail-price">
                            <span class="pin-detail-icon">&#x1F4B0;</span>
                            {formatPrice(pin.price_cents!)}
                          </span>
                        </Show>
                      </div>
                    </Show>

                    {/* Documents section */}
                    <Show when={pin.documents && pin.documents.length > 0}>
                      <div class="pin-documents-section">
                        <span class="pin-documents-label">
                          &#x1F4CE; {pin.documents.length} document{pin.documents.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          class="pin-docs-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPinId(
                              expandedPinId() === pin.id ? null : pin.id
                            );
                          }}
                        >
                          {expandedPinId() === pin.id ? "Hide" : "Show"}
                        </button>
                      </div>
                    </Show>

                    <Show when={expandedPinId() === pin.id && pin.documents}>
                      <div class="pin-documents-list">
                        <For each={pin.documents}>
                          {(doc) => (
                            <div class="pin-doc-item">
                              <a
                                class="pin-doc-name"
                                href={`/api/v1${doc.download_url}`}
                                target="_blank"
                                rel="noopener"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {doc.original_filename}
                              </a>
                              <span class="pin-doc-size">
                                {formatFileSize(doc.file_size_bytes)}
                              </span>
                              <Show when={liveEditing()}>
                                <button
                                  class="pin-doc-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDocument(pin.id, doc.id);
                                  }}
                                  title="Delete document"
                                >
                                  &times;
                                </button>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>

                    <div class="pin-card-footer">
                      <span class="pin-card-author">by {pin.created_by}</span>
                      <Show when={liveEditing()}>
                        <div class="pin-card-actions">
                          <label
                            class="pin-upload-btn"
                            title="Upload document"
                            onClick={(e) => e.stopPropagation()}
                          >
                            &#x1F4CE;
                            <input
                              type="file"
                              hidden
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0];
                                if (file) handleUploadDocument(pin.id, file);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <button
                            class="pin-edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPin(pin);
                            }}
                            title="Edit pin"
                          >
                            &#x270E;
                          </button>
                          <button
                            class="pin-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeletePin(pin);
                            }}
                            title="Delete pin"
                          >
                            &times;
                          </button>
                        </div>
                      </Show>
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

      {/* Edit Pin Modal */}
      <Show when={editingPin()}>
        <EditPinModal
          pin={editingPin()!}
          tripId={params.tripId}
          token={auth.token()!}
          onClose={() => setEditingPin(null)}
          onUpdated={() => {
            setEditingPin(null);
            refetchPins();
          }}
        />
      </Show>

      {/* Confirm Delete Modal */}
      <Show when={confirmDeletePin()}>
        <ConfirmDeleteModal
          pin={confirmDeletePin()!}
          onCancel={() => setConfirmDeletePin(null)}
          onConfirm={() => handleDeletePin(confirmDeletePin()!.id)}
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
  const [scheduledAt, setScheduledAt] = createSignal("");
  const [priceDollars, setPriceDollars] = createSignal("");
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

      // Convert local datetime to RFC3339
      if (scheduledAt()) {
        const dt = new Date(scheduledAt());
        payload.scheduled_at = dt.toISOString();
      }

      // Convert dollar amount to cents
      if (priceDollars()) {
        const cents = Math.round(parseFloat(priceDollars()) * 100);
        if (!isNaN(cents) && cents > 0) {
          payload.price_cents = cents;
        }
      }

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

          <div class="form-row">
            <div class="form-group form-group-half">
              <label for="pin-scheduled">Date & Time</label>
              <input
                id="pin-scheduled"
                type="datetime-local"
                value={scheduledAt()}
                onInput={(e) => setScheduledAt(e.currentTarget.value)}
              />
            </div>
            <div class="form-group form-group-half">
              <label for="pin-price">Price ($)</label>
              <input
                id="pin-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={priceDollars()}
                onInput={(e) => setPriceDollars(e.currentTarget.value)}
              />
            </div>
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

/* ── Edit Pin Modal ── */

function isoToLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditPinModal(props: {
  pin: ActivityPin;
  tripId: string;
  token: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = createSignal(props.pin.title);
  const [description, setDescription] = createSignal(props.pin.description || "");
  const [category, setCategory] = createSignal(props.pin.category);
  const [scheduledAt, setScheduledAt] = createSignal(
    props.pin.scheduled_at ? isoToLocalDatetime(props.pin.scheduled_at) : ""
  );
  const [priceDollars, setPriceDollars] = createSignal(
    props.pin.price_cents ? (props.pin.price_cents / 100).toFixed(2) : ""
  );
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: api.UpdatePinPayload = {};

      if (title() !== props.pin.title) payload.title = title();
      if (description() !== (props.pin.description || ""))
        payload.description = description();
      if (category() !== props.pin.category) payload.category = category();

      // Always send scheduled_at so it can be updated or cleared
      if (scheduledAt()) {
        const dt = new Date(scheduledAt());
        payload.scheduled_at = dt.toISOString();
      } else if (props.pin.scheduled_at) {
        // User cleared the field — send empty string to clear
        // Backend handles this via the CASE WHEN pattern
        payload.scheduled_at = new Date(0).toISOString();
      }

      if (priceDollars()) {
        const cents = Math.round(parseFloat(priceDollars()) * 100);
        if (!isNaN(cents) && cents >= 0) payload.price_cents = cents;
      }

      await api.updatePin(props.token, props.tripId, props.pin.id, payload);
      props.onUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to update pin");
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
      aria-label="Edit activity pin"
    >
      <div class="modal-card">
        <div class="modal-header">
          <h2>Edit Activity</h2>
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
            {props.pin.latitude.toFixed(4)}, {props.pin.longitude.toFixed(4)}
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="edit-pin-title">Activity Name</label>
            <input
              id="edit-pin-title"
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              required
            />
          </div>

          <div class="form-group">
            <label for="edit-pin-category">Category</label>
            <select
              id="edit-pin-category"
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

          <div class="form-row">
            <div class="form-group form-group-half">
              <label for="edit-pin-scheduled">Date & Time</label>
              <input
                id="edit-pin-scheduled"
                type="datetime-local"
                value={scheduledAt()}
                onInput={(e) => setScheduledAt(e.currentTarget.value)}
              />
            </div>
            <div class="form-group form-group-half">
              <label for="edit-pin-price">Price ($)</label>
              <input
                id="edit-pin-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={priceDollars()}
                onInput={(e) => setPriceDollars(e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="form-group">
            <label for="edit-pin-desc">Description</label>
            <textarea
              id="edit-pin-desc"
              placeholder="What makes this place special?"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={3}
            />
          </div>

          <button type="submit" class="btn-primary" disabled={loading()}>
            {loading() ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ── */

function ConfirmDeleteModal(props: {
  pin: ActivityPin;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) props.onCancel();
  };

  return (
    <div
      class="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="Confirm delete"
    >
      <div class="modal-card confirm-delete-modal">
        <div class="modal-header">
          <h2>Delete Activity</h2>
          <button
            class="modal-close"
            onClick={props.onCancel}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <p class="confirm-delete-text">
          Are you sure you want to delete <strong>{props.pin.title}</strong>?
          This will also remove all attached documents. This action cannot be
          undone.
        </p>

        <div class="confirm-delete-actions">
          <button class="btn-secondary" onClick={props.onCancel}>
            Cancel
          </button>
          <button class="btn-danger" onClick={props.onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
