"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import TicketCard from "@/components/TicketCard";
import CreateTicketModal from "@/components/CreateTicketModal";
import { Loader2, Plus, Inbox } from "lucide-react";
import { CATEGORY_STYLES } from "@/lib/categories";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Tab = "requests" | "helps";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700",
  accepted: "bg-blue-50 text-blue-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-50 text-red-500",
  expired: "bg-slate-100 text-slate-400",
};

export default function MyTicketsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requests");
  const [myRequests, setMyRequests] = useState<Ticket[]>([]);
  const [myHelps, setMyHelps] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    // My requests (tickets I created)
    const reqQ = query(
      collection(db, "tickets"),
      where("requesterId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubReq = onSnapshot(reqQ, (snap) => {
      setMyRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
    });

    // Tickets I've accepted as a helper
    const helpQ = query(
      collection(db, "tickets"),
      where("acceptedHelpers", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubHelp = onSnapshot(helpQ, (snap) => {
      setMyHelps(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
      setLoadingTickets(false);
    });

    return () => { unsubReq(); unsubHelp(); };
  }, [user]);

  const tickets = tab === "requests" ? myRequests : myHelps;

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-28 md:pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-3xl text-slate-800">My Tickets</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-6">
        <button
          onClick={() => setTab("requests")}
          className={`px-5 py-3 text-sm font-semibold transition-colors ${
            tab === "requests"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-slate-700"
          }`}
        >
          My Requests{" "}
          <span className="ml-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
            {myRequests.length}
          </span>
        </button>
        <button
          onClick={() => setTab("helps")}
          className={`px-5 py-3 text-sm font-semibold transition-colors ${
            tab === "helps"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-slate-700"
          }`}
        >
          My Helps{" "}
          <span className="ml-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
            {myHelps.length}
          </span>
        </button>
      </div>

      {loadingTickets ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <Inbox size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="font-display font-bold text-xl text-slate-600 mb-2">
            {tab === "requests" ? "No requests yet" : "No helps yet"}
          </h3>
          <p className="text-muted text-sm mb-6">
            {tab === "requests"
              ? "Post your first help request and let neighbors know."
              : "Browse the feed and tap 'I Can Help' on a nearby request."}
          </p>
          {tab === "requests" ? (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Post a Request
            </button>
          ) : (
            <Link href="/" className="btn-primary">Browse Feed</Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const style = CATEGORY_STYLES[ticket.category];
            const createdAt = ticket.createdAt?.toDate?.() ?? new Date();
            return (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                <div className="card p-5 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`category-badge ${style.bg} ${style.text}`}>{ticket.category}</span>
                          <span className={`category-badge ${STATUS_STYLES[ticket.status] ?? "bg-slate-100 text-slate-500"} capitalize`}>
                            {ticket.status}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-lg text-slate-800 truncate">{ticket.title}</h3>
                        <p className="text-sm text-muted mt-0.5">
                          {ticket.location.address} · {formatDistanceToNow(createdAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <span className="text-primary font-bold text-sm group-hover:translate-x-1 transition-transform flex-shrink-0 mt-1">
                      →
                    </span>
                  </div>
                  {/* Helper count */}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      👥 {ticket.acceptedHelpers.length}/{ticket.helpersNeeded} helper{ticket.helpersNeeded !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>⏰ {ticket.timeSlot.timeWindow}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreateTicketModal onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
