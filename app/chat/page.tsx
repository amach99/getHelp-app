"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket, DirectMessage } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORY_STYLES } from "@/lib/categories";
import { MessageCircle, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function ChatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [legacyTickets, setLegacyTickets] = useState<Ticket[]>([]);
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  // Watch DMs where user is a participant
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "directMessages"),
      where("participants", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DirectMessage))
        .filter((dm) => dm.status !== "declined")
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.seconds ?? a.createdAt?.seconds ?? 0;
          const bTime = b.lastMessageAt?.seconds ?? b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });
      setDms(data);
      setLoadingChats(false);
    });
    return unsub;
  }, [user]);

  // Watch legacy ticket chats (tickets without a DM)
  useEffect(() => {
    if (!user) return;
    const results: Record<string, Ticket> = {};
    const dmTicketIds = new Set(dms.map((d) => d.ticketId));

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

    function update() {
      setLegacyTickets(
        Object.values(results)
          .filter((t) => !dmTicketIds.has(t.id))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      );
    }

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach((d) => { results[d.id] = { id: d.id, ...d.data() } as Ticket; });
      update();
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach((d) => { results[d.id] = { id: d.id, ...d.data() } as Ticket; });
      update();
    });

    return () => { unsub1(); unsub2(); };
  }, [user, dms]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const pendingDms = dms.filter((d) => d.status === "pending");
  const acceptedDms = dms.filter((d) => d.status === "accepted");
  const hasAnything = dms.length > 0 || legacyTickets.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-28 md:pb-20">
      <h1 className="font-display font-bold text-3xl text-slate-800 mb-6">Chats</h1>

      {loadingChats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : !hasAnything ? (
        <div className="text-center py-20">
          <MessageCircle size={40} className="text-slate-300 mx-auto mb-4" />
          <h3 className="font-display font-bold text-xl text-slate-600 mb-2">No active chats</h3>
          <p className="text-muted text-sm mb-6">
            Click "I Can Help" on a request or post one to start a conversation.
          </p>
          <Link href="/" className="btn-primary">Browse Feed</Link>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Active accepted chats */}
          {(acceptedDms.length > 0 || legacyTickets.length > 0) && (
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                Active Chats
              </h2>
              <div className="space-y-3">
                {acceptedDms.map((dm) => {
                  const isRequester = dm.requesterId === user.uid;
                  const otherName = isRequester ? dm.helperName : dm.requesterName;
                  const style = CATEGORY_STYLES[dm.ticketCategory as keyof typeof CATEGORY_STYLES] ?? CATEGORY_STYLES["Other"];
                  const hasUnread = dm.lastMessageAt &&
                    (!dm.readBy?.[user.uid] || dm.lastMessageAt.toMillis() > dm.readBy[user.uid].toMillis());
                  return (
                    <Link key={dm.id} href={`/dm/${dm.id}`}>
                      <div className="card p-5 hover:shadow-md transition-all cursor-pointer group flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`category-badge ${style.bg} ${style.text} text-[10px]`}>{dm.ticketCategory}</span>
                            <span className="text-xs text-muted">with {otherName}</span>
                          </div>
                          <h3 className={`font-semibold truncate ${hasUnread ? "text-slate-900" : "text-slate-800"}`}>
                            {dm.ticketTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasUnread && <span className="w-2.5 h-2.5 bg-primary rounded-full" />}
                          <MessageCircle size={18} className="text-primary group-hover:scale-110 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {legacyTickets.map((ticket) => {
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
                            {formatDistanceToNow(createdAt, { addSuffix: true })}
                          </p>
                        </div>
                        <MessageCircle size={18} className="text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pending pre-acceptance DMs */}
          {pendingDms.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                <Clock size={12} /> Pending Conversations
              </h2>
              <div className="space-y-3">
                {pendingDms.map((dm) => {
                  const isRequester = dm.requesterId === user.uid;
                  const otherName = isRequester ? dm.helperName : dm.requesterName;
                  const style = CATEGORY_STYLES[dm.ticketCategory as keyof typeof CATEGORY_STYLES] ?? CATEGORY_STYLES["Other"];
                  const hasUnread = dm.lastMessageAt &&
                    (!dm.readBy?.[user.uid] || dm.lastMessageAt.toMillis() > dm.readBy[user.uid].toMillis());
                  return (
                    <Link key={dm.id} href={`/dm/${dm.id}`}>
                      <div className="card p-5 hover:shadow-md transition-all cursor-pointer group flex items-center gap-4 border border-dashed border-slate-200">
                        <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center text-xl flex-shrink-0 opacity-80`}>
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`category-badge ${style.bg} ${style.text} text-[10px]`}>{dm.ticketCategory}</span>
                            <span className="text-xs text-muted">with {otherName}</span>
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">Pending</span>
                          </div>
                          <h3 className={`font-semibold truncate ${hasUnread ? "text-slate-900" : "text-slate-700"}`}>
                            {dm.ticketTitle}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasUnread && <span className="w-2.5 h-2.5 bg-primary rounded-full" />}
                          <MessageCircle size={18} className="text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
