
import React from 'react';

export interface OutlinePoint {
  id: number;
  text: string;
  missingWord: string;
}

export interface Sermon {
  date: string;
  title: string;
  scripture: string;
  book: string;
  version: string;
  speaker: string;
  outline: OutlinePoint[];
}

export interface Announcement {
  id: string | number;
  title: string;
  description: string;
  date: string;
  image_url?: string;
  imageUrl?: string;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description?: string;
  starts_at?: string;
  date?: string;
  time?: string;
  end_time?: string;
  location?: string;
  image_url?: string;
  type?: string;
  /** Vault calendar toggle — when false, Connect must not show RSVP UI */
  rsvp_enabled?: boolean;
  rsvp_url?: string;
  /** RSVP closes (ISO). After this, Connect shows "RSVP closed" instead of the link. */
  rsvp_close_at?: string;
}

export interface Ministry {
  name: string;
  desc: string;
  icon?: React.ReactNode;
}

export interface PrayerRequest {
  id: string;
  member_name: string;
  content: string;
  is_confidential: boolean;
  created_at: string;
  agreements?: number;
  prayed_count?: number;
}

export interface VisitRegistration {
  visitor_name: string;
  preferred_date: string;
  family_size: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface ConnectFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export interface GivingSettings {
  online_url?: string;
  text_number?: string;
  mail_address?: string;
}
