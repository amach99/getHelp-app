"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket, UserProfile } from "@/lib/types";
import { Category } from "@/lib/types";
import { CATEGORIES, CATEGORY_STYLES } from "@/lib/categories";
import TicketCard from "@/components/TicketCard";
import CreateTicketModal from "@/components/CreateTicketModal";
import ProfileSidebar from "@/components/ProfileSidebar";
import toast from "react-hot-toast";
import { Plus, Search, SlidersHorizontal, Loader2 } from "lucide-react";

type FilterCategory = "All" | Category;

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("All");
  const [leaderboard, setLeaderboard] = useState<
    { uid: string; displayName: string; totalHelps: number; isCurrentUser: boolean }[]
  >([]);

  // Redirect if not auth
  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  // Real-time tickets feed
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "tickets"),
      where("status", "==", "open"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
      setTickets(data);
      setTicketsLoading(false);
    });
    return unsub;
  }, [user]);

  // Load leaderboard
  const loadLeaderboard = useCallback(async () => {
    if (!user) return;
    const q = query(
      collection(db, "users"),
      orderBy("totalHelps", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => {
      const p = d.data() as UserProfile;
      return { uid: p.uid, displayName: p.displayName, totalHelps: p.totalHelps, isCurrentUser: p.uid === user.uid };
    });
    setLeaderboard(data);
  }, [user]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  async function handleAccept(ticketId: string) {
    if (!user || !profile) return;
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      if (ticket.acceptedHelpers.includes(user.uid)) {
        toast.error("You've already accepted this request.");
        return;
      }
      if (ticket.acceptedHelpers.length >= ticket.helpersNeeded) {
        toast.error("This request is already full.");
        return;
      }

      await updateDoc(ticketRef, {
        acceptedHelpers: arrayUnion(user.uid),
        ...(ticket.acceptedHelpers.length + 1 >= ticket.helpersNeeded ? { status: "accepted" } : {}),
      });

      toast.success("You're helping! 🙌 Opening chat...");
      router.push(`/chat/${ticketId}`);
    } catch {
      toast.error("Failed to accept. Please try again.");
    }
  }

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.location.address.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeFilter === "All" || t.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  const featured = filtered[0];
  const rest = filtered.slice(1);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <header className="relative h-[52vh] min-h-[360px] w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-teal-300" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/30" />
        <div className="relative z-10 text-center px-4 max-w-2xl">
          <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-3 tracking-tight">
            Apprentice
          </h1>
          <p className="text-lg md:text-xl text-white/80 font-light mb-8">
            Build a culture of daily kindness.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="px-7 py-3.5 bg-white text-primary rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 text-sm"
            >
              + Ask for Help
            </button>
            <button
              onClick={() => document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" })}
              className="px-7 py-3.5 bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm border border-white/30 rounded-full font-semibold transition-all text-sm"
            >
              Help a Neighbor
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 -mt-14 relative z-20 pb-28 md:pb-20" id="feed">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Feed */}
          <div className="lg:col-span-8 space-y-6">
            {/* Search & Filters */}
            <section className="glass rounded-3xl p-5 shadow-xl shadow-slate-200/40">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-grow">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search nearby requests..."
                    className="w-full pl-11 pr-4 py-3.5 bg-white/70 border border-white/50 rounded-2xl focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm placeholder-slate-400"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                  <button
                    onClick={() => setActiveFilter("All")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                      activeFilter === "All"
                        ? "bg-primary text-white shadow-sm"
                        : "bg-white/70 text-slate-600 hover:bg-white"
                    }`}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => {
                    const s = CATEGORY_STYLES[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveFilter(cat)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                          activeFilter === cat
                            ? `${s.bg} ${s.text}`
                            : "bg-white/70 text-slate-600 hover:bg-white"
                        }`}
                      >
                        {s.icon} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Ticket Feed */}
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 card">
                <div className="text-5xl mb-4">🏘️</div>
                <h3 className="font-display font-bold text-xl text-slate-700 mb-2">
                  {search || activeFilter !== "All" ? "No matching requests" : "No requests yet"}
                </h3>
                <p className="text-muted text-sm mb-6">
                  {search || activeFilter !== "All"
                    ? "Try adjusting your filters."
                    : "Be the first to ask for help in your community!"}
                </p>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                  Post a Request
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {featured && (
                  <TicketCard
                    ticket={featured}
                    featured
                    onAccept={handleAccept}
                    currentUserId={user.uid}
                  />
                )}
                {rest.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onAccept={handleAccept}
                    currentUserId={user.uid}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Profile Sidebar */}
          <aside className="lg:col-span-4">
            {profile && (
              <ProfileSidebar
                profile={profile}
                leaderboard={leaderboard}
              />
            )}
          </aside>
        </div>
      </div>

      {/* FAB (mobile) */}
      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed bottom-20 right-5 w-14 h-14 bg-primary text-white rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center z-40 active:scale-90 transition-transform hover:bg-primary-dark"
      >
        <Plus size={24} />
      </button>

      {/* Create Ticket Modal */}
      {showModal && (
        <CreateTicketModal
          onClose={() => setShowModal(false)}
          onCreated={() => {}}
        />
      )}
    </>
  );
}
