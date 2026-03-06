"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, LogOut, Flame, Award, Camera, Trash2 } from "lucide-react";
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
  const { user, profile, logout, loading, refreshProfile, deleteAccount } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setNeighborhood(profile.neighborhood);
    }
  }, [profile]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });
      await refreshProfile();
      toast.success("Profile picture updated!");
    } catch {
      toast.error("Failed to upload photo. Try again.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) { toast.error("Name can't be empty."); return; }
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        displayName: displayName.trim(),
        neighborhood: neighborhood.trim(),
      };

      const earningLocalWatch =
        neighborhood.trim() &&
        !profile!.neighborhood &&
        !profile!.badges.some((b) => b.id === "local_watch");

      if (earningLocalWatch) {
        updates.badges = arrayUnion({
          id: "local_watch",
          name: "Local Watch",
          earnedAt: Timestamp.now(),
        });
      }

      await updateDoc(doc(db, "users", user.uid), updates);
      await refreshProfile();
      if (earningLocalWatch) toast.success("🏅 Badge unlocked: Local Watch!");
      else toast.success("Profile updated!");
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

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace("/auth");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/requires-recent-login") {
        toast.error("Please sign out and sign back in before deleting your account.");
      } else {
        toast.error("Failed to delete account. Please try again.");
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors disabled:opacity-60"
              title="Change profile picture"
            >
              {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
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

      {/* Delete account */}
      <div className="mt-3">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl font-semibold transition-colors text-sm border border-transparent hover:border-red-100"
          >
            <Trash2 size={15} /> Delete Account
          </button>
        ) : (
          <div className="border border-red-200 bg-red-50 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-semibold text-red-700 text-center">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
