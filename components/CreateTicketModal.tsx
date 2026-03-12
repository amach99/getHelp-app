"use client";

import { useState } from "react";
import { X, MapPin, Clock, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Category, Ticket } from "@/lib/types";
import { CATEGORIES, CATEGORY_STYLES } from "@/lib/categories";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const TIME_WINDOWS = [
  "As soon as possible",
  "Within 1 hour",
  "This morning",
  "This afternoon",
  "This evening",
  "Tomorrow morning",
  "Tomorrow afternoon",
  "This weekend",
];

export default function CreateTicketModal({ onClose, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("Errands");
  const [address, setAddress] = useState(profile?.neighborhood || "");
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0]);
  const [helpersNeeded, setHelpersNeeded] = useState(1);
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) {
      toast.error("You must be signed in.");
      return;
    }
    if (!title.trim() || !description.trim() || !address.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      // Expiry: 24 hours from now by default
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const ticketData: Omit<Ticket, "id"> = {
        title: title.trim(),
        description: description.trim(),
        category,
        requesterId: user.uid,
        requesterName: profile.displayName,
        requesterPhoto: user.photoURL,
        helpersNeeded,
        acceptedHelpers: [],
        location: {
          address: address.trim(),
          lat: 0,
          lng: 0,
          radiusMiles: 5,
        },
        timeSlot: {
          date: new Date().toISOString().split("T")[0],
          timeWindow,
        },
        isUrgent,
        status: "open",
        createdAt: serverTimestamp() as unknown as Timestamp,
        expiresAt: Timestamp.fromDate(expiresAt),
        lastMessageAt: null,
        readBy: {},
      };

      await addDoc(collection(db, "tickets"), ticketData);
      toast.success("Help request posted! 🎉");
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to post request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 px-8 pt-8 pb-4 border-b border-slate-50 rounded-t-[2.5rem]">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-slate-800">New Help Request</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {/* Mobile drag handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-200 rounded-full md:hidden" />
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              What do you need help with? <span className="text-secondary">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Help carrying groceries up 4 flights"
              className="input-base"
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              More details <span className="text-secondary">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you need, any context, and how long it might take..."
              className="input-base resize-none h-28"
              maxLength={500}
              required
            />
            <p className="text-xs text-muted mt-1 text-right">{description.length}/500</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const s = CATEGORY_STYLES[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      category === cat
                        ? `${s.bg} ${s.text} border-current`
                        : "bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100"
                    }`}
                  >
                    {s.icon} {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <MapPin size={13} className="inline mr-1" />
                Location <span className="text-secondary">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Neighborhood or address"
                className="input-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <Clock size={13} className="inline mr-1" />
                When?
              </label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="input-base"
              >
                {TIME_WINDOWS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Helpers needed + Urgent */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <Users size={13} className="inline mr-1" />
                Helpers needed
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHelpersNeeded((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold"
                >
                  −
                </button>
                <span className="text-lg font-bold text-slate-800 w-6 text-center">{helpersNeeded}</span>
                <button
                  type="button"
                  onClick={() => setHelpersNeeded((n) => Math.min(10, n + 1))}
                  className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 font-bold"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <button
                type="button"
                onClick={() => setIsUrgent((u) => !u)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  isUrgent
                    ? "bg-secondary/10 text-secondary border-secondary/30"
                    : "bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100"
                }`}
              >
                <Zap size={14} fill={isUrgent ? "currentColor" : "none"} />
                Urgent
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Posting..." : "Post Help Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
