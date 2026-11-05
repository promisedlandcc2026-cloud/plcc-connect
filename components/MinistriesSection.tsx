
import React, { useState } from 'react';
import {
  Users, Music, Globe, Baby, ArrowRight, ShieldCheck,
  X, HeartHandshake, Tv, User, UserCheck, LucideIcon
} from 'lucide-react';
import { MINISTRIES } from '../data';
import { JoinTeamModule } from './JoinTeamModule';

const ICONS: Record<string, LucideIcon> = {
  Worship: Music,
  Youth: Users,
  Kids: Baby,
  Outreach: Globe,
  "Men's": User,
  "Women's": UserCheck,
  Media: Tv,
  Hospitality: HeartHandshake,
};

export const MinistriesSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinTeamOpen, setIsJoinTeamOpen] = useState(false);
  const [selectedMinistry, setSelectedMinistry] = useState<string | undefined>(undefined);

  const featuredMinistries = MINISTRIES.slice(0, 4);
  const allMinistries = MINISTRIES;

  const handleMinistryClick = (name: string) => {
    setSelectedMinistry(name);
    setIsModalOpen(true);
  };

  const handleJoinTeamTrigger = () => {
    setIsModalOpen(false);
    setIsJoinTeamOpen(true);
  };

  const renderIcon = (name: string) => {
    const Icon = ICONS[name] || Users;
    return <Icon size={18} />;
  };

  return (
    <div className="bg-white border border-gold/20 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-gold/5 rounded-full blur-2xl group-hover:bg-gold/10 transition-colors" />

      <div className="flex items-center gap-3 mb-4">
        <div className="bg-burgundy p-2.5 rounded-xl shadow-lg shadow-burgundy/20">
          <ShieldCheck size={20} className="text-gold" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">⛪ Our Ministries</h2>
          <p className="text-xs text-burgundy font-bold uppercase tracking-widest">Find Your Place to Serve</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Discover the heartbeat of PLCC. There is a place for everyone to grow, connect, and use their gifts for the Kingdom.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {featuredMinistries.map((m) => (
          <div
            key={m.name}
            onClick={() => handleMinistryClick(m.name)}
            className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center gap-3 hover:bg-burgundy/5 transition-colors cursor-pointer group/item"
          >
            <div className="bg-white p-2 rounded-lg text-burgundy shadow-sm group-hover/item:text-gold transition-colors">
              {renderIcon(m.name)}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1A1A1A]">{m.name}</p>
              <p className="text-xs text-gray-500 font-medium">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full min-h-[48px] bg-burgundy text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-burgundy-dark transition-all shadow-md active:scale-95"
      >
        Explore All Ministries <ArrowRight size={18} />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-bold text-[#1A1A1A]">PLCC Ministries</h3>
                <p className="text-xs text-burgundy font-bold uppercase tracking-widest">Connected in Service</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] bg-gray-100 rounded-full text-gray-500 hover:text-black transition-colors flex items-center justify-center"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar space-y-4">
              <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                We believe that every member is a minister. Find a community that matches your heart and join us in our mission.
              </p>

              <div className="grid grid-cols-1 gap-3">
                {allMinistries.map((m) => (
                  <div key={m.name} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gold/50 transition-colors group/modal-item">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-burgundy shadow-sm group-hover/modal-item:bg-burgundy group-hover/modal-item:text-white transition-all">
                      {renderIcon(m.name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1A1A1A] text-sm">{m.name} Ministry</h4>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <button
                  onClick={handleJoinTeamTrigger}
                  className="w-full min-h-[54px] bg-burgundy text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-burgundy-dark transition-all"
                >
                  Join a Team <HeartHandshake size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <JoinTeamModule
        isOpen={isJoinTeamOpen}
        onClose={() => setIsJoinTeamOpen(false)}
        initialMinistry={selectedMinistry}
      />
    </div>
  );
};
