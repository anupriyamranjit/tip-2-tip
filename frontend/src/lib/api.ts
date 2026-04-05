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
}

export interface UpdatePinPayload {
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  status?: string;
  image_url?: string;
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
