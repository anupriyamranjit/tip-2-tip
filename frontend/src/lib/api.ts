const BASE = "/api/v1";

interface SignupPayload {
  email: string;
  username: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  cover_image_url: string | null;
  role: string;
  member_count: number;
  created_at: string;
}

export interface CreateTripPayload {
  name: string;
  description?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (res.status === 401) {
    // Token is invalid or user no longer exists — clear session and redirect
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data as T;
}

async function authRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  return request<T>(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyTrips(token: string): Promise<{ trips: Trip[] }> {
  return authRequest("/trips", token);
}

export function getTrip(token: string, id: string): Promise<Trip> {
  return authRequest(`/trips/${id}`, token);
}

export function createTrip(
  token: string,
  payload: CreateTripPayload
): Promise<Trip> {
  return authRequest("/trips", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ── Activity Pins ── */

export interface PinDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  download_url: string;
  created_at: string;
}

export interface PinVoteSummary {
  upvotes: number;
  downvotes: number;
  score: number;
  /** Current user's vote: 1 (up), -1 (down), or 0 (none) */
  user_vote: number;
}

export interface ActivityPin {
  id: string;
  trip_id: string;
  user_id: string;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  category: string;
  status: string;
  image_url: string | null;
  scheduled_at: string | null;
  price_cents: number | null;
  documents: PinDocument[];
  votes: PinVoteSummary;
  created_by: string;
  created_at: string;
}

export interface CreatePinPayload {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  category?: string;
  image_url?: string;
  scheduled_at?: string;
  price_cents?: number;
}

export interface UpdatePinPayload {
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  status?: string;
  image_url?: string;
  scheduled_at?: string;
  price_cents?: number;
}

export function listPins(
  token: string,
  tripId: string
): Promise<{ pins: ActivityPin[] }> {
  return authRequest(`/trips/${tripId}/pins`, token);
}

export function createPin(
  token: string,
  tripId: string,
  payload: CreatePinPayload
): Promise<ActivityPin> {
  return authRequest(`/trips/${tripId}/pins`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePin(
  token: string,
  tripId: string,
  pinId: string,
  payload: UpdatePinPayload
): Promise<ActivityPin> {
  return authRequest(`/trips/${tripId}/pins/${pinId}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePin(
  token: string,
  tripId: string,
  pinId: string
): Promise<void> {
  return authRequest(`/trips/${tripId}/pins/${pinId}`, token, {
    method: "DELETE",
  });
}

/* ── Pin Documents ── */

export async function uploadDocument(
  token: string,
  tripId: string,
  pinId: string,
  file: File
): Promise<PinDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/trips/${tripId}/pins/${pinId}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (res.status === 401) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as PinDocument;
}

export function deleteDocument(
  token: string,
  tripId: string,
  pinId: string,
  docId: string
): Promise<void> {
  return authRequest(`/trips/${tripId}/pins/${pinId}/documents/${docId}`, token, {
    method: "DELETE",
  });
}

/* ── Pin Votes ── */

export function votePin(
  token: string,
  tripId: string,
  pinId: string,
  vote: 1 | -1
): Promise<PinVoteSummary> {
  return authRequest(`/trips/${tripId}/pins/${pinId}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ vote }),
  });
}

export function deleteVote(
  token: string,
  tripId: string,
  pinId: string
): Promise<PinVoteSummary> {
  return authRequest(`/trips/${tripId}/pins/${pinId}/vote`, token, {
    method: "DELETE",
  });
}
