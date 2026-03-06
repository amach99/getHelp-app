"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, arrayUnion, getDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket, UserProfile } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_STYLES } from "@/lib/categories";
import { MapPin, Clock, Users, Zap, ArrowLeft, CheckCircle, XCircle, Loader2, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "tickets", id), (snap) => {
      if (snap.exists()) {
        setTicket({ id: snap.id, ...snap.data() } as Ticket);
      } else {
        setTicket(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-20 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-display font-bold text-2xl text-slate-700 mb-2">Ticket not found</h2>
        <p className="text-muted mb-6">This request may have expired or been removed.</p>
        <Link href="/" className="btn-primary">Back to Feed</Link>
      </div>
    );
  }

  const style = CATEGORY_STYLES[ticket.category];
  const isOwner = user?.uid === ticket.requesterId;
  const isHelper = user ? ticket.acceptedHelpers.includes(user.uid) : false;
  const isFull = ticket.acceptedHelpers.length >= ticket.helpersNeeded;
  const spotsLeft = ticket.helpersNeeded - ticket.acceptedHelpers.length;
  const createdAt = ticket.createdAt?.toDate?.() ?? new Date();

  async function handleAccept() {
    if (!user || !profile) return;
    setAccepting(true);
    try {
      await updateDoc(doc(db, "tickets", id), {
        acceptedHelpers: arrayUnion(user.uid),
        ...(ticket!.acceptedHelpers.length + 1 >= ticket!.helpersNeeded ? { status: "accepted" } : {}),
      });
      toast.success("You accepted this request! 🙌");
      router.push(`/chat/${id}`);
    } catch {
      toast.error("Failed to accept. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleMarkComplete() {
    if (!ticket) return;
    try {
      await updateDoc(doc(db, "tickets", id), { status: "completed" });

      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      await Promise.all(
        ticket.acceptedHelpers.map(async (helperUid) => {
          const helperRef = doc(db, "users", helperUid);
          const helperSnap = await getDoc(helperRef);
          if (!helperSnap.exists()) return;
          const helperData = helperSnap.data() as UserProfile;
          const lastActive = helperData.lastActiveDate;

          let newStreak: number;
          if (lastActive === todayStr) {
            newStreak = helperData.streak;
          } else if (lastActive === yesterdayStr) {
            newStreak = helperData.streak + 1;
          } else {
            newStreak = 1;
          }

          await updateDoc(helperRef, {
            totalHelps: increment(1),
            streak: newStreak,
            lastActiveDate: todayStr,
          });
        })
      );

      toast.success("Task marked as complete! 🎉");
      router.push("/my-tickets");
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    try {
      await updateDoc(doc(db, "tickets", id), { status: "cancelled" });
      toast.success("Request cancelled.");
      router.push("/my-tickets");
    } catch {
      toast.error("Failed to cancel.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-28 md:pb-20">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors mb-6 font-medium"
      >
        <ArrowLeft size={16} /> Back to feed
      </button>

      {/* Status banner */}
      {ticket.status !== "open" && (
        <div
          className={`mb-4 px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 ${
            ticket.status === "completed"
              ? "bg-emerald-50 text-emerald-700"
              : ticket.status === "cancelled"
              ? "bg-red-50 text-red-600"
              : ticket.status === "accepted"
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {ticket.status === "completed" && <CheckCircle size={15} />}
          {ticket.status === "cancelled" && <XCircle size={15} />}
          This request is <strong className="capitalize">{ticket.status}</strong>
        </div>
      )}

      <div className="card p-8 shadow-xl shadow-slate-100/60">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-16 h-16 rounded-3xl ${style.bg} flex items-center justify-center text-3xl flex-shrink-0`}>
            {style.icon}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`category-badge ${style.bg} ${style.text}`}>{ticket.category}</span>
              {ticket.isUrgent && (
                <span className="category-badge bg-secondary/10 text-secondary flex items-center gap-1">
                  <Zap size={10} fill="currentColor" /> Urgent
                </span>
              )}
            </div>
            <h1 className="font-display font-bold text-3xl text-slate-800 leading-tight">{ticket.title}</h1>
            <p className="text-sm text-muted mt-1">
              Posted by <span className="font-semibold text-slate-700">{ticket.requesterName}</span> ·{" "}
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Details</h2>
          <p className="text-slate-700 leading-relaxed">{ticket.description}</p>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted mb-1">
              <MapPin size={14} /> <span className="text-xs font-semibold uppercase tracking-wide">Location</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">{ticket.location.address}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted mb-1">
              <Clock size={14} /> <span className="text-xs font-semibold uppercase tracking-wide">When</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">{ticket.timeSlot.timeWindow}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-muted mb-1">
              <Users size={14} /> <span className="text-xs font-semibold uppercase tracking-wide">Helpers</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {ticket.acceptedHelpers.length}/{ticket.helpersNeeded} ({spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left)
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Helper: accept */}
          {!isOwner && ticket.status === "open" && !isHelper && !isFull && (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {accepting ? <Loader2 size={16} className="animate-spin" /> : "🙌"}
              {accepting ? "Accepting..." : "I Can Help"}
            </button>
          )}

          {/* Helper: already accepted – go to chat */}
          {isHelper && (
            <Link href={`/chat/${id}`} className="btn-primary flex items-center gap-2">
              <MessageCircle size={16} /> Open Chat
            </Link>
          )}

          {/* Full */}
          {!isOwner && !isHelper && isFull && ticket.status === "open" && (
            <span className="px-5 py-3 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold">
              All spots filled
            </span>
          )}

          {/* Owner actions */}
          {isOwner && ticket.status === "open" && (
            <>
              {ticket.acceptedHelpers.length > 0 && (
                <Link href={`/chat/${id}`} className="btn-primary flex items-center gap-2">
                  <MessageCircle size={16} /> Chat with Helper
                </Link>
              )}
              <button
                onClick={handleMarkComplete}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle size={15} /> Mark Complete
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <XCircle size={15} /> Cancel
              </button>
            </>
          )}

          {isOwner && ticket.status === "accepted" && (
            <>
              <Link href={`/chat/${id}`} className="btn-primary flex items-center gap-2">
                <MessageCircle size={16} /> Open Chat
              </Link>
              <button
                onClick={handleMarkComplete}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle size={15} /> Mark Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
