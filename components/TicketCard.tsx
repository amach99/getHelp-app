"use client";

import Link from "next/link";
import { Ticket } from "@/lib/types";
import { CATEGORY_STYLES } from "@/lib/categories";
import { MapPin, Clock, Users, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TicketCardProps {
  ticket: Ticket;
  featured?: boolean;
  onAccept?: (ticketId: string) => void;
  currentUserId?: string;
}

export default function TicketCard({ ticket, featured = false, onAccept, currentUserId }: TicketCardProps) {
  const style = CATEGORY_STYLES[ticket.category];
  const isOwner = currentUserId === ticket.requesterId;
  const isAccepted = currentUserId ? ticket.acceptedHelpers.includes(currentUserId) : false;
  const isFull = ticket.acceptedHelpers.length >= ticket.helpersNeeded;
  const spotsLeft = ticket.helpersNeeded - ticket.acceptedHelpers.length;
  const createdAt = ticket.createdAt?.toDate?.() ?? new Date();

  if (featured) {
    return (
      <div className="ticket-card md:col-span-2 bg-white rounded-4xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
        {ticket.isUrgent && (
          <div className="absolute top-5 right-5">
            <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full uppercase tracking-widest flex items-center gap-1">
              <Zap size={10} fill="currentColor" /> Urgent
            </span>
          </div>
        )}
        <div className="flex flex-col h-full">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-2xl ${style.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
              {style.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`category-badge ${style.bg} ${style.text}`}>{ticket.category}</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-slate-800 leading-tight">{ticket.title}</h3>
              <p className="text-sm text-muted flex items-center gap-1 mt-1">
                <MapPin size={12} /> {ticket.location.address}
              </p>
            </div>
          </div>
          <p className="text-slate-600 mb-6 text-base leading-relaxed line-clamp-3">{ticket.description}</p>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Clock size={13} /> {ticket.timeSlot.timeWindow}
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/tickets/${ticket.id}`}
                className="text-sm font-semibold text-muted hover:text-primary transition-colors"
              >
                Details
              </Link>
              {!isOwner && !isAccepted && ticket.status === "open" && !isFull && (
                <button
                  onClick={() => onAccept?.(ticket.id)}
                  className="btn-primary group-hover:scale-105 transition-transform"
                >
                  I Can Help
                </button>
              )}
              {isAccepted && (
                <span className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-semibold">
                  Accepted ✓
                </span>
              )}
              {isFull && !isAccepted && (
                <span className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold">
                  Full
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/tickets/${ticket.id}`}>
      <div className="ticket-card bg-white rounded-4xl p-6 border border-slate-100 shadow-sm h-full flex flex-col cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className={`category-badge ${style.bg} ${style.text}`}>
            {style.icon} {ticket.category}
          </span>
          {ticket.isUrgent && (
            <span className="text-secondary">
              <Zap size={14} fill="currentColor" />
            </span>
          )}
        </div>
        <h3 className="font-display font-bold text-xl mb-2 text-slate-800 leading-tight line-clamp-2">
          {ticket.title}
        </h3>
        <p className="text-slate-500 text-sm mb-4 line-clamp-3 flex-1">{ticket.description}</p>
        <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-auto">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <MapPin size={10} /> {ticket.location.address}
            </span>
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Clock size={10} /> {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>
          <span className="text-primary font-bold text-sm">View →</span>
        </div>
      </div>
    </Link>
  );
}
