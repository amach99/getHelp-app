import { Timestamp } from "firebase/firestore";
import { Badge, BadgeId, UserProfile } from "./types";

interface BadgeDef {
  id: BadgeId;
  name: string;
  check: (before: UserProfile, newTotalHelps: number, newStreak: number) => boolean;
}

const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_spark",
    name: "First Spark",
    check: (b, h) => b.totalHelps === 0 && h >= 1,
  },
  {
    id: "heavy_lifter",
    name: "Heavy Lifter",
    check: (b, h) => b.totalHelps < 10 && h >= 10,
  },
  {
    id: "neighborhood_hero",
    name: "Neighborhood Hero",
    check: (b, h) => b.totalHelps < 25 && h >= 25,
  },
  {
    id: "streak_7",
    name: "Streak 7",
    check: (b, _h, s) => b.streak < 7 && s >= 7,
  },
  {
    id: "streak_30",
    name: "Streak 30",
    check: (b, _h, s) => b.streak < 30 && s >= 30,
  },
];

export function getNewBadges(
  before: UserProfile,
  newTotalHelps: number,
  newStreak: number
): Badge[] {
  const existingIds = new Set(before.badges.map((b) => b.id));
  return BADGE_DEFS.filter(
    (def) => !existingIds.has(def.id) && def.check(before, newTotalHelps, newStreak)
  ).map((def) => ({
    id: def.id,
    name: def.name,
    earnedAt: Timestamp.now(),
  }));
}

/** Returns the Monday of the current week as YYYY-MM-DD */
export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split("T")[0];
}
