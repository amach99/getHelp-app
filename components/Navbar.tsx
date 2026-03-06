"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ticket } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Ticket as TicketIcon, MessageCircle, User, LogOut, Menu, X, Plus
} from "lucide-react";

const navLinks = [
  { label: "Feed", href: "/", icon: Home },
  { label: "My Tickets", href: "/my-tickets", icon: TicketIcon },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
];

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) { setHasUnread(false); return; }
    const uid = user.uid;
    let tickets1: Ticket[] = [];
    let tickets2: Ticket[] = [];

    function check() {
      const all = [...tickets1, ...tickets2];
      setHasUnread(all.some((t) => {
        if (!t.lastMessageAt) return false;
        const readAt = t.readBy?.[uid];
        if (!readAt) return true;
        return t.lastMessageAt.toMillis() > readAt.toMillis();
      }));
    }

    const unsub1 = onSnapshot(
      query(collection(db, "tickets"), where("requesterId", "==", uid)),
      (snap) => { tickets1 = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)); check(); }
    );
    const unsub2 = onSnapshot(
      query(collection(db, "tickets"), where("acceptedHelpers", "array-contains", uid)),
      (snap) => { tickets2 = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)); check(); }
    );
    return () => { unsub1(); unsub2(); };
  }, [user]);

  async function handleLogout() {
    await logout();
    router.push("/auth");
  }

  const initials = profile?.displayName
    ? profile.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass px-4 py-3 border-b border-white/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg font-display">
              G
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-slate-800">
              Get Help
            </span>
          </Link>

          {/* Desktop Nav */}
          {user && (
            <div className="hidden md:flex items-center gap-6 font-medium text-slate-600 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative hover:text-primary transition-colors pb-0.5 ${
                    pathname === link.href
                      ? "text-primary border-b-2 border-primary"
                      : ""
                  }`}
                >
                  {link.label}
                  {link.href === "/chat" && hasUnread && (
                    <span className="absolute -top-1 -right-2.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </Link>
              ))}

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary text-primary text-xs font-bold flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  {profile?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photoURL} alt="avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-50">
                      <p className="text-sm font-semibold text-slate-800 truncate">{profile?.displayName}</p>
                      <p className="text-xs text-muted truncate">{profile?.neighborhood || "No neighborhood set"}</p>
                    </div>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <User size={14} /> Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-secondary hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile toggle */}
          {user && (
            <button
              className="md:hidden p-2 text-slate-600"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}

          {/* Not logged in */}
          {!user && (
            <Link href="/auth" className="btn-primary text-sm px-5 py-2.5">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu */}
        {menuOpen && user && (
          <div className="md:hidden mt-3 pb-3 border-t border-white/20 pt-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-secondary hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Tab Bar */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 flex items-center justify-around px-2 py-2 safe-area-pb">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
                pathname === link.href ? "text-primary" : "text-slate-400"
              }`}
            >
              <link.icon size={20} />
              {link.href === "/chat" && hasUnread && (
                <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
