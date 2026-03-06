"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, LogOut, Flame, Award } from "lucide-react";
import toast from "react-hot-toast";

const BADGE_ICONS: Record<string, string> = {
  first_spark: "⚡",
  local_watch: "📍",
  heavy_lifter: "🏋️",
  streak_7: "🔥",
  streak_30: "🌟",
  neighborhood_hero: "🦸",
};

export default function ProfilePage() {
  const { user, profile, logout, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setNeighborhood(profile.neighborhood);
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) { toast.error("Name can't be empty."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim(),
        neighborhood: neighborhood.trim(),
      });
      await refreshProfile();
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/auth");
  }

  if (loading || !user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-28 md:pb-20">
      <h1 className="font-display font-bold text-3xl text-slate-800 mb-8">Profile</h1>

      {/* Avatar & Stats */}
      <div className="card p-8 mb-6 shadow-xl shadow-slate-100/60">
        <div className="flex items-start gap-6 mb-8">
          <div className="relative">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-2xl font-bold text-primary font-display border-4 border-white shadow-md overflow-hidden">
              {profile.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-slate-800">{profile.displayName}</h2>
            <p className="text-muted text-sm">{profile.email}</p>
            {profile.neighborhood && (
              <p className="text-sm text-slate-600 mt-1">📍 {profile.neighborhood}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-3xl text-primary">{profile.totalHelps}</p>
            <p className="text-xs text-muted font-medium mt-1">Helps Given</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <p className="font-display font-bold text-3xl text-slate-700">{profile.totalRequests}</p>
            <p className="text-xs text-muted font-medium mt-1">Requests Made</p>
          </div>
          <div className="bg-secondary/5 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame size={20} className="text-secondary" fill="currentColor" />
              <p className="font-display font-bold text-3xl text-secondary">{profile.streak}</p>
            </div>
            <p className="text-xs text-muted font-medium mt-1">Day Streak</p>
          </div>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="mb-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              <Award size={14} /> Badges Earned
            </h3>
            <div className="flex flex-wrap gap-3">
              {profile.badges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-100">
                  <span className="text-xl">{BADGE_ICONS[badge.id] ?? "🏅"}</span>
                  <span className="text-sm font-semibold text-slate-700 capitalize">
                    {badge.name.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit form */}
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Edit Profile</h3>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-base"
              placeholder="Your name"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Neighborhood</label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="input-base"
              placeholder="e.g. Mission District, SF"
              maxLength={100}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-4 border border-red-100 text-secondary hover:bg-red-50 rounded-2xl font-semibold transition-colors text-sm"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
