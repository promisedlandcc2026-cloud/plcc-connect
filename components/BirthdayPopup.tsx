/**
 * Members rarely open their notifications, so on their birthday (or anniversary) the
 * Pastor's greeting pops up by itself the first time they open Connect.
 * Shows only an unread celebration from the last 2 days; closing it marks it read,
 * so it appears once.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import type { ConnectNotification } from '../lib/memberNotificationsTypes';
import BirthdayCard from './BirthdayCard';

const RECENT_MS = 2 * 24 * 60 * 60 * 1000;

export function pickBirthdayPopup(list: ConnectNotification[], now = Date.now()): ConnectNotification | null {
  return (
    list.find(
      (n) =>
        n.type === 'celebration' &&
        !n.readAt &&
        !/^\(Test\)/.test(n.title) &&
        now - Date.parse(n.createdAt) < RECENT_MS
    ) || null
  );
}

export default function BirthdayPopup() {
  const { notifications, markOneRead } = useNotifications();
  const location = useLocation();
  const [card, setCard] = useState<ConnectNotification | null>(null);
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (card || location.pathname === '/welcome' || location.pathname === '/notifications') return;
    const next = pickBirthdayPopup(notifications);
    if (next && !shown.current.has(next.id)) {
      shown.current.add(next.id);
      setCard(next);
    }
  }, [notifications, card, location.pathname]);

  if (!card) return null;
  return (
    <BirthdayCard
      title={card.title}
      body={card.message}
      onClose={() => {
        void markOneRead(card.id).catch(() => undefined);
        setCard(null);
      }}
    />
  );
}
