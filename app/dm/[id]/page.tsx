"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc,
  query, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DirectMessage, ChatMessage } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Loader2, Info, CheckCircle } from "lucide-react";
import { CATEGORY_STYLES } from "@/lib/categories";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";

export default function DMPage() {
  const { id: dmId } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [dm, setDm] = useState<DirectMessage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load DM doc
  useEffect(() => {
    if (!dmId) return;
    const unsub = onSnapshot(doc(db, "directMessages", dmId), (snap) => {
      if (snap.exists()) setDm({ id: snap.id, ...snap.data() } as DirectMessage);
      setLoading(false);
    });
    return unsub;
  }, [dmId]);

  // Load messages
  useEffect(() => {
    if (!dmId) return;
    const q = query(
      collection(db, "directMessages", dmId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
    return unsub;
  }, [dmId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!dmId || !user || !dm) return;
    if (!dm.participants.includes(user.uid)) return;
    updateDoc(doc(db, "directMessages", dmId), {
      [`readBy.${user.uid}`]: Timestamp.now(),
    }).catch(() => {});
  }, [dmId, user, dm, messages]);

  const isParticipant = user && dm && dm.participants.includes(user.uid);
  const isRequester = user && dm && dm.requesterId === user.uid;
  const otherName = dm
    ? isRequester
      ? dm.helperName
      : dm.requesterName
    : "";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user || !profile || !dm) return;
    setSending(true);
    try {
      await addDoc(collection(db, "directMessages", dmId, "messages"), {
        ticketId: dm.ticketId,
        senderId: user.uid,
        senderName: profile.displayName,
        senderPhoto: user.photoURL ?? null,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "directMessages", dmId), {
        lastMessageAt: serverTimestamp(),
      });
      setText("");
    } catch {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!dm || !isParticipant) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-28 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="font-display font-bold text-2xl text-slate-700 mb-2">Access denied</h2>
        <p className="text-muted mb-6">You are not part of this conversation.</p>
        <Link href="/" className="btn-primary">Back to Feed</Link>
      </div>
    );
  }

  const style = CATEGORY_STYLES[dm.ticketCategory as keyof typeof CATEGORY_STYLES] ?? CATEGORY_STYLES["Other"];
  const isClosed = dm.status === "declined";
  const isAccepted = dm.status === "accepted";

  return (
    <div className="flex flex-col h-screen pt-16">
      {/* Header */}
      <div className="glass border-b border-white/20 px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className={`w-10 h-10 rounded-2xl ${style.bg} flex items-center justify-center text-lg flex-shrink-0`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-slate-800 truncate leading-tight">
            {otherName}
          </h2>
          <p className="text-xs text-muted truncate">{dm.ticketTitle}</p>
        </div>
        {isAccepted && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircle size={12} /> Accepted
          </span>
        )}
        <Link href={`/tickets/${dm.ticketId}`} className="p-2 text-muted hover:text-primary transition-colors">
          <Info size={16} />
        </Link>
      </div>

      {/* Status banner for declined */}
      {isClosed && (
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5 text-center text-sm text-muted font-medium">
          This request was filled by another helper. Thanks for offering! 🙏
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3">
        <div className="text-center">
          <span className="text-xs bg-slate-200 text-slate-500 px-3 py-1 rounded-full font-medium">
            {isRequester
              ? `${dm.helperName} offered to help with your request`
              : `You offered to help ${dm.requesterName}`}
          </span>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-muted">No messages yet. Say hello! 👋</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.senderId === user?.uid;
          const ts = msg.createdAt?.toDate?.() ?? new Date();
          const showDate =
            i === 0 ||
            format(messages[i - 1].createdAt?.toDate?.() ?? new Date(), "yyyy-MM-dd") !==
              format(ts, "yyyy-MM-dd");

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-2">
                  <span className="text-xs bg-slate-200 text-slate-500 px-3 py-1 rounded-full font-medium">
                    {format(ts, "EEEE, MMM d")}
                  </span>
                </div>
              )}
              <div className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                    {msg.senderName?.[0] ?? "?"}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isMe && (
                    <span className="text-[10px] text-slate-400 ml-1 font-medium">{msg.senderName}</span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-primary text-white rounded-br-md"
                        : "bg-white text-slate-800 border border-slate-100 rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mx-1">
                    {format(ts, "h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed ? (
        <form
          onSubmit={handleSend}
          className="bg-white border-t border-slate-100 px-4 py-3 flex items-center gap-3 pb-safe"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-11 h-11 bg-primary hover:bg-primary-dark text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 active:scale-90 flex-shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 text-center text-sm text-muted font-medium">
          This conversation is closed.
        </div>
      )}
    </div>
  );
}
