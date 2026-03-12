"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, onSnapshot, updateDoc, arrayUnion, getDoc, increment,
  collection, query, orderBy, addDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket, UserProfile, Offer, TicketComment } from "@/lib/types";
import { getNewBadges, getWeekStart } from "@/lib/badges";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_STYLES } from "@/lib/categories";
import {
  MapPin, Clock, Users, Zap, ArrowLeft, CheckCircle, XCircle,
  Loader2, MessageCircle, Send, HandHeart,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Load ticket
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "tickets", id), (snap) => {
      if (snap.exists()) setTicket({ id: snap.id, ...snap.data() } as Ticket);
      else setTicket(null);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  // Load offers (real-time)
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      query(collection(db, "tickets", id, "offers"), orderBy("createdAt", "asc")),
      (snap) => setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Offer)))
    );
    return unsub;
  }, [id]);

  // Load comments (real-time)
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      query(collection(db, "tickets", id, "comments"), orderBy("createdAt", "asc")),
      (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TicketComment)))
    );
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
  const isAcceptedHelper = user ? ticket.acceptedHelpers.includes(user.uid) : false;
  const myOffer = user ? offers.find((o) => o.helperId === user.uid) : null;
  const pendingOffers = offers.filter((o) => o.status === "pending");
  const createdAt = ticket.createdAt?.toDate?.() ?? new Date();

  // Submit "I can help" — creates offer + DM + auto-comment atomically
  async function handleOffer() {
    if (!user || !profile || !ticket) return;
    setOffering(true);
    try {
      const batch = writeBatch(db);

      const offerRef = doc(collection(db, "tickets", id, "offers"));
      const dmRef = doc(collection(db, "directMessages"));
      const commentRef = doc(collection(db, "tickets", id, "comments"));

      batch.set(offerRef, {
        ticketId: id,
        helperId: user.uid,
        helperName: profile.displayName,
        helperPhoto: user.photoURL ?? null,
        dmId: dmRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      batch.set(dmRef, {
        ticketId: id,
        ticketTitle: ticket.title,
        ticketCategory: ticket.category,
        participants: [ticket.requesterId, user.uid],
        requesterId: ticket.requesterId,
        requesterName: ticket.requesterName,
        helperId: user.uid,
        helperName: profile.displayName,
        helperPhoto: user.photoURL ?? null,
        offerId: offerRef.id,
        status: "pending",
        createdAt: serverTimestamp(),
        lastMessageAt: null,
        readBy: {},
      });

      batch.set(commentRef, {
        ticketId: id,
        authorId: user.uid,
        authorName: profile.displayName,
        authorPhoto: user.photoURL ?? null,
        text: `👋 ${profile.displayName} offered to help!`,
        isOfferComment: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      toast.success("Offer sent! You can message the requester now.");
      router.push(`/dm/${dmRef.id}`);
    } catch {
      toast.error("Failed to send offer. Please try again.");
    } finally {
      setOffering(false);
    }
  }

  // Requester accepts a specific offer
  async function handleAcceptOffer(offer: Offer) {
    if (!user || !ticket) return;
    setAcceptingOffer(offer.id);
    try {
      const batch = writeBatch(db);

      // Update ticket
      batch.update(doc(db, "tickets", id), {
        acceptedHelpers: [offer.helperId],
        status: "accepted",
      });

      // Promote accepted offer and DM
      batch.update(doc(db, "tickets", id, "offers", offer.id), { status: "accepted" });
      batch.update(doc(db, "directMessages", offer.dmId), { status: "accepted" });

      // Decline all other pending offers and their DMs
      for (const o of pendingOffers) {
        if (o.id === offer.id) continue;
        batch.update(doc(db, "tickets", id, "offers", o.id), { status: "declined" });
        batch.update(doc(db, "directMessages", o.dmId), { status: "declined" });
      }

      await batch.commit();
      toast.success(`${offer.helperName} accepted! 🎉`);
      router.push(`/dm/${offer.dmId}`);
    } catch {
      toast.error("Failed to accept offer.");
    } finally {
      setAcceptingOffer(null);
    }
  }

  async function handleMarkComplete() {
    if (!ticket) return;
    try {
      await updateDoc(doc(db, "tickets", id), { status: "completed" });

      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const weekStart = getWeekStart();

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

          const newTotalHelps = helperData.totalHelps + 1;
          const newWeeklyHelps =
            helperData.weekStartDate === weekStart
              ? (helperData.weeklyHelps ?? 0) + 1
              : 1;

          const newBadges = getNewBadges(helperData, newTotalHelps, newStreak);

          await updateDoc(helperRef, {
            totalHelps: increment(1),
            weeklyHelps: newWeeklyHelps,
            weekStartDate: weekStart,
            streak: newStreak,
            lastActiveDate: todayStr,
            ...(newBadges.length > 0 ? { badges: arrayUnion(...newBadges) } : {}),
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
      const batch = writeBatch(db);
      batch.update(doc(db, "tickets", id), { status: "cancelled" });
      for (const o of offers.filter((o) => o.status === "pending")) {
        batch.update(doc(db, "tickets", id, "offers", o.id), { status: "declined" });
        batch.update(doc(db, "directMessages", o.dmId), { status: "declined" });
      }
      await batch.commit();
      toast.success("Request cancelled.");
      router.push("/my-tickets");
    } catch {
      toast.error("Failed to cancel.");
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !user || !profile) return;
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, "tickets", id, "comments"), {
        ticketId: id,
        authorId: user.uid,
        authorName: profile.displayName,
        authorPhoto: user.photoURL ?? null,
        text: commentText.trim(),
        isOfferComment: false,
        createdAt: serverTimestamp(),
      });
      setCommentText("");
    } catch {
      toast.error("Failed to post comment.");
    } finally {
      setSubmittingComment(false);
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
              <Users size={14} /> <span className="text-xs font-semibold uppercase tracking-wide">Offers</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {pendingOffers.length} pending
            </p>
          </div>
        </div>

        {/* ─── Action buttons ─── */}
        <div className="flex flex-wrap gap-3">

          {/* Non-owner: offer to help */}
          {!isOwner && ticket.status === "open" && !myOffer && (
            <button
              onClick={handleOffer}
              disabled={offering}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {offering ? <Loader2 size={16} className="animate-spin" /> : <HandHeart size={16} />}
              {offering ? "Sending offer..." : "I Can Help"}
            </button>
          )}

          {/* Non-owner: offer sent, pending */}
          {!isOwner && myOffer?.status === "pending" && (
            <div className="flex items-center gap-3 px-5 py-3 bg-teal-50 border border-teal-100 rounded-2xl">
              <span className="text-teal-700 text-sm font-semibold">✓ Offer sent!</span>
              <Link href={`/dm/${myOffer.dmId}`} className="text-sm text-primary font-semibold hover:underline">
                Message requester →
              </Link>
            </div>
          )}

          {/* Non-owner: you're the accepted helper */}
          {!isOwner && (myOffer?.status === "accepted" || isAcceptedHelper) && (
            <Link
              href={myOffer ? `/dm/${myOffer.dmId}` : `/chat/${id}`}
              className="btn-primary flex items-center gap-2"
            >
              <MessageCircle size={16} /> Open Chat
            </Link>
          )}

          {/* Non-owner: offer declined */}
          {!isOwner && myOffer?.status === "declined" && (
            <p className="text-sm text-muted px-1 py-3">
              This request has been filled by another helper. Thanks for offering! 🙏
            </p>
          )}

          {/* Non-owner: ticket already accepted, no offer from this user */}
          {!isOwner && !myOffer && ticket.status === "accepted" && (
            <span className="px-5 py-3 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold">
              Already taken
            </span>
          )}

          {/* Owner: accepted — open chat + mark complete */}
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

          {/* Owner: open — mark complete + cancel */}
          {isOwner && ticket.status === "open" && (
            <>
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
        </div>
      </div>

      {/* ─── Offers list (owner only, when open) ─── */}
      {isOwner && ticket.status === "open" && (
        <div className="mt-6 card p-6">
          <h2 className="font-display font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <HandHeart size={18} className="text-primary" />
            Offers to Help
            {pendingOffers.length > 0 && (
              <span className="ml-1 w-6 h-6 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingOffers.length}
              </span>
            )}
          </h2>

          {pendingOffers.length === 0 ? (
            <p className="text-sm text-muted">No offers yet. Share your request to get help faster!</p>
          ) : (
            <div className="space-y-3">
              {pendingOffers.map((offer) => (
                <div key={offer.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {offer.helperName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{offer.helperName}</p>
                    <p className="text-xs text-muted">Offered to help</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/dm/${offer.dmId}`}
                      className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      Message
                    </Link>
                    <button
                      onClick={() => handleAcceptOffer(offer)}
                      disabled={acceptingOffer === offer.id}
                      className="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {acceptingOffer === offer.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle size={12} />
                      )}
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Public Discussion / Q&A ─── */}
      <div className="mt-6 card p-6">
        <h2 className="font-display font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
          <MessageCircle size={18} className="text-primary" />
          Discussion
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted">({comments.length})</span>
          )}
        </h2>

        {comments.length === 0 && (
          <p className="text-sm text-muted mb-4">
            No comments yet. Ask a question or let others know you can help!
          </p>
        )}

        <div className="space-y-4 mb-5">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  comment.isOfferComment
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {comment.authorName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-slate-800">{comment.authorName}</span>
                  <span className="text-[11px] text-muted">
                    {formatDistanceToNow(comment.createdAt?.toDate?.() ?? new Date(), { addSuffix: true })}
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    comment.isOfferComment ? "text-teal-700 font-medium" : "text-slate-700"
                  }`}
                >
                  {comment.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <form onSubmit={handleSubmitComment} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ask a question or leave a comment..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                {submittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </form>
        ) : (
          <Link href="/auth" className="text-sm text-primary font-semibold hover:underline">
            Sign in to comment →
          </Link>
        )}
      </div>
    </div>
  );
}
