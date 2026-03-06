import { Timestamp } from "firebase/firestore";

export type Category =
  | "Moving"
  | "Rides"
  | "Pet Care"
  | "Tech Support"
  | "Errands"
  | "Skill Share"
  | "Other";

export type TicketStatus = "open" | "accepted" | "completed" | "cancelled" | "expired";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: Category;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string | null;
  helpersNeeded: number;
  acceptedHelpers: string[]; // user IDs
  location: {
    address: string;
    lat: number;
    lng: number;
    radiusMiles: number;
  };
  timeSlot: {
    date: string;     // ISO date string
    timeWindow: string; // e.g. "2:00 PM – 4:00 PM"
  };
  isUrgent: boolean;
  status: TicketStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  lastMessageAt: Timestamp | null;
  readBy: Record<string, Timestamp>;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  neighborhood: string;
  totalHelps: number;
  totalRequests: number;
  weeklyHelps: number;
  weekStartDate: string | null;
  streak: number;
  lastActiveDate: string | null;
  badges: Badge[];
  createdAt: Timestamp;
}

export type BadgeId =
  | "first_spark"
  | "local_watch"
  | "heavy_lifter"
  | "streak_7"
  | "streak_30"
  | "neighborhood_hero";

export interface Badge {
  id: BadgeId;
  name: string;
  earnedAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string;
  createdAt: Timestamp;
}

export interface Chat {
  id: string;
  ticketId: string;
  ticketTitle: string;
  participants: string[]; // user IDs
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
}
