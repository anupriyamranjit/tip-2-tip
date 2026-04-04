"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";

/* ------------------------------------------------------------------ */
/*  Fix Leaflet's default icon paths (broken by webpack)               */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-require-imports
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MapPlace {
  id: string;
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  pinColor: string;
  gradient: string;
  isShortlisted: boolean;
  onAddToShortlist: () => void;
  onHover: () => void;
}

interface LeafletMapProps {
  places: MapPlace[];
  expandedPin: string;
  onPinClick: (id: string) => void;
  center?: [number, number];
  zoom?: number;
}

/* ------------------------------------------------------------------ */
/*  Custom colored circle marker icon                                  */
/* ------------------------------------------------------------------ */

function createCircleIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
        cursor: pointer;
      ">${label}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

/* ------------------------------------------------------------------ */
/*  Fit bounds helper                                                   */
/* ------------------------------------------------------------------ */

function FitBounds({ places }: { places: MapPlace[] }) {
  const map = useMap();

  useEffect(() => {
    if (places.length === 0) return;
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [map, places]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LeafletMap({
  places,
  expandedPin,
  onPinClick,
  center = [13.7563, 100.5018],
  zoom = 13,
}: LeafletMapProps) {
  /* Route polyline connecting places in order */
  const routeCoords: [number, number][] = places.map((p) => [p.lat, p.lng]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full z-0"
      zoomControl={false}
      attributionControl={false}
      style={{ background: "#b8d4e8" }}
    >
      {/* OpenStreetMap tiles */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Fit map to show all markers */}
      <FitBounds places={places} />

      {/* Route dashed polyline */}
      {routeCoords.length > 1 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: "#003FA3",
            weight: 2,
            dashArray: "8 6",
            opacity: 0.5,
          }}
        />
      )}

      {/* Markers */}
      {places.map((place, idx) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          icon={createCircleIcon(place.pinColor, String(idx + 1))}
          eventHandlers={{
            click: () => onPinClick(place.id),
            mouseover: () => place.onHover(),
          }}
        >
          {expandedPin === place.id && (
            <Popup closeButton={false} className="leaflet-popup-custom">
              <div style={{ minWidth: 180 }}>
                <h4
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 6,
                    letterSpacing: "0.02em",
                    color: "#071E27",
                  }}
                >
                  {place.name}
                </h4>
                <p
                  style={{
                    fontSize: 12,
                    color: "#5a6b73",
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {place.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      backgroundColor: place.pinColor,
                      color: "white",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      padding: "2px 8px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                    }}
                  >
                    {place.category}
                  </span>
                  {place.isShortlisted ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "#065f46",
                        backgroundColor: "#d1fae5",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      SHORTLISTED
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        place.onAddToShortlist();
                      }}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#003FA3",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      + Shortlist
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
