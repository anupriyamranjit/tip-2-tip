export interface TripMember {
  id: string;
  name: string;
  avatar: string; // initials
  color: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string; // member id
  splitBetween: string[]; // member ids
  date: string;
  category: "food" | "transport" | "lodging" | "activity" | "other";
}

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  location: string;
  category: "flight" | "hotel" | "food" | "activity" | "transport";
  notes?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverEmoji: string;
  members: TripMember[];
  totalBudget: number;
  totalSpent: number;
  currency: string;
}

export const members: TripMember[] = [
  { id: "1", name: "Anupriyam", avatar: "AR", color: "#2563eb" },
  { id: "2", name: "Sarah", avatar: "SC", color: "#7c3aed" },
  { id: "3", name: "Mike", avatar: "MK", color: "#059669" },
  { id: "4", name: "Priya", avatar: "PD", color: "#dc2626" },
];

export const currentTrip: Trip = {
  id: "trip-1",
  name: "Thailand Adventure",
  destination: "Bangkok & Chiang Mai",
  startDate: "2026-04-18",
  endDate: "2026-04-28",
  coverEmoji: "\u{1F1F9}\u{1F1ED}",
  members,
  totalBudget: 6000,
  totalSpent: 2340,
  currency: "CAD",
};

export const upcomingTrips: Trip[] = [
  currentTrip,
  {
    id: "trip-2",
    name: "Portugal Road Trip",
    destination: "Lisbon & Porto",
    startDate: "2026-07-10",
    endDate: "2026-07-20",
    coverEmoji: "\u{1F1F5}\u{1F1F9}",
    members: members.slice(0, 3),
    totalBudget: 5000,
    totalSpent: 0,
    currency: "CAD",
    },
];

export const recentExpenses: Expense[] = [
  {
    id: "e1",
    description: "Airbnb (5 nights)",
    amount: 875,
    currency: "CAD",
    paidBy: "1",
    splitBetween: ["1", "2", "3", "4"],
    date: "2026-04-01",
    category: "lodging",
  },
  {
    id: "e2",
    description: "Flight YVR \u2192 BKK",
    amount: 620,
    currency: "CAD",
    paidBy: "2",
    splitBetween: ["1", "2"],
    date: "2026-03-28",
    category: "transport",
  },
  {
    id: "e3",
    description: "Cooking Class Deposit",
    amount: 45,
    currency: "CAD",
    paidBy: "3",
    splitBetween: ["1", "2", "3", "4"],
    date: "2026-04-02",
    category: "activity",
  },
  {
    id: "e4",
    description: "Travel Insurance",
    amount: 200,
    currency: "CAD",
    paidBy: "1",
    splitBetween: ["1", "2", "3", "4"],
    date: "2026-03-25",
    category: "other",
  },
];

export const itinerary: Record<string, ItineraryItem[]> = {
  "Day 1 — Apr 18": [
    { id: "i1", time: "06:00", title: "Depart YVR", location: "Vancouver Airport", category: "flight" },
    { id: "i2", time: "18:30", title: "Arrive BKK (Suvarnabhumi)", location: "Bangkok", category: "flight" },
    { id: "i3", time: "20:00", title: "Check-in Airbnb", location: "Silom District", category: "hotel" },
    { id: "i4", time: "21:00", title: "Street Food at Yaowarat", location: "Chinatown", category: "food" },
  ],
  "Day 2 — Apr 19": [
    { id: "i5", time: "09:00", title: "Grand Palace & Wat Phra Kaew", location: "Old City", category: "activity" },
    { id: "i6", time: "12:30", title: "Lunch at Thip Samai", location: "Maha Chai Rd", category: "food" },
    { id: "i7", time: "14:00", title: "Wat Arun & Ferry", location: "Thonburi", category: "activity" },
    { id: "i8", time: "18:00", title: "Rooftop Drinks", location: "Lebua Sky Bar", category: "food" },
  ],
  "Day 3 — Apr 20": [
    { id: "i9", time: "07:00", title: "Chatuchak Weekend Market", location: "Chatuchak", category: "activity" },
    { id: "i10", time: "12:00", title: "Thai Cooking Class", location: "Silom Thai Cooking School", category: "activity" },
    { id: "i11", time: "16:00", title: "Spa & Massage", location: "Health Land Spa", category: "activity" },
  ],
};

export const debts: { from: string; to: string; amount: number }[] = [
  { from: "2", to: "1", amount: 68.75 },
  { from: "3", to: "1", amount: 143.75 },
  { from: "4", to: "1", amount: 168.75 },
  { from: "3", to: "2", amount: 55.0 },
];
