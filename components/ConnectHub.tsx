
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  UserPlus,
  UserRound,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';
import { CHURCH_INFO } from '../data';
import { useAuth } from '../context/AuthContext';

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CHURCH_INFO.address)}`;
const PHONE_HREF = `tel:${CHURCH_INFO.phone.replace(/\D/g, '')}`;

export const ConnectHub: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-5">
      <div className="px-1">
        <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <Phone size={20} className="text-burgundy" />
          We're Here For You
        </h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Reach us anytime — or join us this Sunday.
        </p>
      </div>

      <Link
        to={isAuthenticated ? '/account' : '/sign-in'}
        className="w-full min-h-[52px] bg-burgundy text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-sm shadow-sm hover:bg-burgundy-dark transition-colors active:scale-[0.99]"
      >
        <UserRound size={18} aria-hidden />
        {isAuthenticated ? 'Member Account' : 'Member Sign In'}
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={PHONE_HREF}
          className="flex flex-col items-center justify-center gap-2 min-h-[88px] bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all hover:border-burgundy/20"
        >
          <div className="w-10 h-10 rounded-xl bg-burgundy/5 flex items-center justify-center text-burgundy">
            <Phone size={18} />
          </div>
          <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">Call</span>
        </a>
        <a
          href={`mailto:${CHURCH_INFO.email}`}
          className="flex flex-col items-center justify-center gap-2 min-h-[88px] bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all hover:border-burgundy/20"
        >
          <div className="w-10 h-10 rounded-xl bg-burgundy/5 flex items-center justify-center text-burgundy">
            <Mail size={18} />
          </div>
          <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">Email</span>
        </a>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-2 min-h-[88px] bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all hover:border-burgundy/20"
        >
          <div className="w-10 h-10 rounded-xl bg-burgundy/5 flex items-center justify-center text-burgundy">
            <MapPin size={18} />
          </div>
          <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">Directions</span>
        </a>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-burgundy">
          <Clock size={16} />
          <p className="text-xs font-black uppercase tracking-widest">Service Times</p>
        </div>
        {CHURCH_INFO.schedule.map((s) => (
          <div key={s.day} className="flex justify-between items-center text-sm">
            <span className="font-bold text-[#1A1A1A]">{s.day}</span>
            <span className="text-gray-500 text-xs">{s.time}</span>
          </div>
        ))}
        <p className="text-xs text-gray-500 pt-1 border-t border-gray-50">{CHURCH_INFO.address}</p>

        <div className="pt-3 border-t border-gray-50 flex items-center justify-between gap-3">
          <div className="flex gap-5 text-gray-500">
            <a
              href={CHURCH_INFO.socials.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-burgundy transition-colors"
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
            <a
              href={CHURCH_INFO.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-burgundy transition-colors"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
            <a
              href={CHURCH_INFO.socials.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-burgundy transition-colors"
              aria-label="YouTube"
            >
              <Youtube size={18} />
            </a>
          </div>
          <a
            href="https://sanctum-live-nine.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-burgundy uppercase tracking-widest hover:text-gold transition-colors shrink-0"
          >
            Official Website
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={() => document.getElementById('connect')?.scrollIntoView({ behavior: 'smooth' })}
        className="w-full min-h-[52px] bg-white border border-burgundy/15 rounded-2xl flex items-center justify-center gap-2 text-burgundy font-bold text-sm shadow-sm hover:bg-burgundy/5 transition-colors active:scale-[0.99]"
      >
        <UserPlus size={18} />
        Send a Connect Card
      </button>
    </div>
  );
};
