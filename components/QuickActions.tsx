
import React, { useState } from 'react';
import { Heart, MessageSquare, UserPlus, Tv, ExternalLink } from 'lucide-react';
import { GiveModule } from './GiveModule';
import { PrayerModule } from './PrayerModule';
import { PlanVisitModule } from './PlanVisitModule';
import { YOUTUBE_CHANNEL_URL } from '../data';

interface ActionCardProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  isPrimary?: boolean;
  isExternal?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ label, icon, onClick, href, isPrimary, isExternal }) => {
  if (href) {
    return (
      <a 
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all active:scale-95 shadow-sm min-h-[110px] relative group
          ${isPrimary 
            ? 'bg-white border-gold/30 hover:border-gold' 
            : 'bg-white border-gray-100 hover:border-burgundy/20'}`}
      >
        {isExternal && (
          <div className="absolute top-2 right-2 text-gray-500 group-hover:text-burgundy transition-colors">
            <ExternalLink size={10} />
          </div>
        )}
        <div className={`${isPrimary ? 'text-gold' : 'text-burgundy'} mb-3 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <span className="text-xs font-bold text-[#1A1A1A] text-center leading-tight">{label}</span>
      </a>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all active:scale-95 shadow-sm min-h-[110px] relative group
        ${isPrimary 
          ? 'bg-white border-gold/30 hover:border-gold' 
          : 'bg-white border-gray-100 hover:border-burgundy/20'}`}
    >
      <div className={`${isPrimary ? 'text-gold' : 'text-burgundy'} mb-3 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <span className="text-xs font-bold text-[#1A1A1A] text-center leading-tight">{label}</span>
    </button>
  );
};

export const QuickActions: React.FC = () => {
  const [activeModule, setActiveModule] = useState<'give' | 'prayer' | 'visit' | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ActionCard 
          label="Give / Offering" 
          icon={<Heart fill="currentColor" size={24} />} 
          onClick={() => setActiveModule('give')}
          isPrimary 
        />
        <ActionCard 
          label="Prayer Request" 
          icon={<MessageSquare size={24} />} 
          onClick={() => setActiveModule('prayer')}
        />
        <ActionCard 
          label="Plan a Visit" 
          icon={<UserPlus size={24} />} 
          onClick={() => setActiveModule('visit')}
        />
        <ActionCard 
          label="Watch Sermon" 
          icon={<Tv size={24} />} 
          href={YOUTUBE_CHANNEL_URL} 
          isExternal
        />
      </div>

      <GiveModule isOpen={activeModule === 'give'} onClose={() => setActiveModule(null)} />
      <PrayerModule isOpen={activeModule === 'prayer'} onClose={() => setActiveModule(null)} />
      <PlanVisitModule isOpen={activeModule === 'visit'} onClose={() => setActiveModule(null)} />
    </>
  );
};
