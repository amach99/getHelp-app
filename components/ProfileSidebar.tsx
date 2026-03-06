"use client";

import { useState } from "react";
import Link from "next/link";
import { UserProfile } from "@/lib/types";
import { Flame, MapPin, Trophy } from "lucide-react";

const BADGE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  first_spark:      { icon: "⚡", color: "text-teal-600",   bg: "bg-teal-50 border-teal-100" },
  local_watch:      { icon: "📍", color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  heavy_lifter:     { icon: "🏋️", color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
  streak_7:         { icon: "🔥", color: "text-red-500",    bg: "bg-red-50 border-red-100" },
  streak_30:        { icon: "🌟", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
  neighborhood_hero:{ icon: "🦸", color: "text-blue-600",  bg: "bg-blue-50 border-blue-100" },
};

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalHelps: number;
  weeklyHelps: number;
  isCurrentUser: boolean;
}

interface Props {
  profile: UserProfile;
  leaderboard?: LeaderboardEntry[];
}

export default function ProfileSidebar({ profile, leaderboard = [] }: Props) {
  const [lbTab, setLbTab] = useState<"weekly" | "alltime">("weekly");
  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const streakPct = Math.min(100, (profile.streak % 30) * (100 / 30));

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <section className="bg-white rounded-4xl p-8 border border-slate-100 shadow-xl shadow-slate-100/60">
        <div className="text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl rotate-6" />
            <div className="relative w-full h-full bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-sm flex items-center justify-center text-xl font-bold text-slate-500 font-display">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>
          <h2 className="font-display font-bold text-xl text-slate-800">{profile.displayName}</h2>
          {profile.neighborhood && (
            <p className="text-muted text-sm flex items-center justify-center gap-1 mt-1">
              <MapPin size={12} /> {profile.neighborhood}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-primary">{profile.totalHelps}</p>
            <p className="text-xs text-muted font-medium mt-0.5">Helps Given</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-slate-700">{profile.totalRequests}</p>
            <p className="text-xs text-muted font-medium mt-0.5">Requests Made</p>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-700 text-sm">Daily Streak</span>
            <div className="flex items-center gap-1 text-secondary font-bold text-sm">
              <Flame size={14} className="animate-pulse" fill="currentColor" />
              <span>{profile.streak} day{profile.streak !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-secondary h-full rounded-full transition-all duration-700"
              style={{ width: `${streakPct}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-1.5">{30 - (profile.streak % 30)} days to next milestone</p>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Badges</h3>
            <div className="flex gap-3 flex-wrap">
              {profile.badges.map((badge) => {
                const b = BADGE_ICONS[badge.id] ?? { icon: "🏅", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" };
                return (
                  <div key={badge.id} className="group text-center">
                    <div
                      className={`w-12 h-12 ${b.bg} ${b.color} rounded-2xl flex items-center justify-center text-xl mb-1 border group-hover:scale-110 transition-transform`}
                    >
                      {b.icon}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 capitalize">
                      {badge.name.replace(/_/g, " ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Link
          href="/profile"
          className="mt-5 w-full flex items-center justify-center py-3 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          View full profile
        </Link>
      </section>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <section className="bg-slate-900 rounded-4xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              <span><span className="text-primary">Community</span> Leaderboard</span>
            </h3>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 mb-4">
            {(["weekly", "alltime"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLbTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  lbTab === tab ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {tab === "weekly" ? "This Week" : "All Time"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {leaderboard
              .slice()
              .sort((a, b) =>
                lbTab === "weekly"
                  ? b.weeklyHelps - a.weeklyHelps
                  : b.totalHelps - a.totalHelps
              )
              .slice(0, 5)
              .map((entry, i) => (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    entry.isCurrentUser
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: `hsl(${(i * 60 + 200) % 360}, 65%, 55%)` }}
                    >
                      {entry.displayName[0]}
                    </div>
                    <span className={`text-sm font-medium ${entry.isCurrentUser ? "text-primary" : "text-white"}`}>
                      {entry.isCurrentUser ? "You" : entry.displayName}
                    </span>
                  </div>
                  <span className="text-primary font-bold text-sm">
                    {lbTab === "weekly" ? entry.weeklyHelps : entry.totalHelps} helps
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
