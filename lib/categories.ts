import { Category } from "./types";

export const CATEGORIES: Category[] = [
  "Moving",
  "Rides",
  "Pet Care",
  "Tech Support",
  "Errands",
  "Skill Share",
  "Other",
];

export const CATEGORY_STYLES: Record<Category, { bg: string; text: string; icon: string }> = {
  Moving:       { bg: "bg-orange-50",  text: "text-orange-600",  icon: "📦" },
  Rides:        { bg: "bg-blue-50",    text: "text-blue-600",    icon: "🚗" },
  "Pet Care":   { bg: "bg-amber-50",   text: "text-amber-600",   icon: "🐾" },
  "Tech Support": { bg: "bg-indigo-50", text: "text-indigo-600", icon: "💻" },
  Errands:      { bg: "bg-teal-50",    text: "text-teal-600",    icon: "🛍️" },
  "Skill Share": { bg: "bg-purple-50", text: "text-purple-600",  icon: "✨" },
  Other:        { bg: "bg-slate-100",  text: "text-slate-600",   icon: "💬" },
};
