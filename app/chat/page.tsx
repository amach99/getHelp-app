"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_STYLES } from "@/lib/categories";
import { MessageCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    // Tickets where user is requester with helpers, or is a helper
    const q1 = query(
      collection(db, "tickets"),
      where("requesterId", "==", user.uid),
      where("acceptedHelpers", "!=", []),
      orderBy("createdAt", "desc")
    );
    const q2 = query(
      collection(db, "tickets"),
      where("acceptedHelpers", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );

    const results: Record<string, Ticket> = {};

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach((d) => { results[d.id] = { id: d.id, ...d.data() } as Ticket; });
      setActiveTickets(Object.values(results).sort(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      ));
      setLoadingChats(false);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach((d) => { results[d.id] = { id: d.id, ...d.data() } as Ticket; });
      setActiveTickets(Object.values(results).sort(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
      ));
      setLoadingChats(false);
    });

    return () => { unsub1(); unsub2(); };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-28 md:pb-20">
      <h1 className="font-display font-bold text-3xl text-slate-800 mb-6">Chats</h1>

      {loadingChats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : activeTickets.length === 0 ? (
        <div className="text-center py-20">
          <MessageCircle size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="font-display font-bold text-xl text-slate-600 mb-2">No active chats</h3>
          <p className="text-muted text-sm mb-6">
            Accept a help request or post one to start a conversation.
          </p>
          <Link href="/" className="btn-primary">Browse Feed</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTickets.map((ticket) => {
            const style = CATEGORY_STYLES[ticket.category];
            const isOwner = ticket.requesterId === user.uid;
            const createdAt = ticket.createdAt?.toDate?.() ?? new Date();
            return (
              <Link key={ticket.id} href={`/chat/${ticket.id}`}>
                <div className="card p-5 hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`category-badge ${style.bg} ${style.text} text-[10px]`}>{ticket.category}</span>
                      <span className="text-xs text-muted">{isOwner ? "My request" : `from ${ticket.requesterName}`}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 truncate">{ticket.title}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {ticket.acceptedHelpers.length} helper{ticket.acceptedHelpers.length !== 1 ? "s" : ""} ·{" "}
                      {formatDistanceToNow(createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <MessageCircle size={18} className="text-primary group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
