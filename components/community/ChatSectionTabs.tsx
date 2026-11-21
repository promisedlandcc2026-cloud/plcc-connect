import React from 'react';
import { HandHeart, Users, MessagesSquare, User, Radio } from 'lucide-react';
import { CHAT_SECTIONS, type ChatSection } from '../../lib/chatSections';

export const SECTION_LABELS: Record<ChatSection, string> = { prayers: 'Prayers', ministries: 'Ministries', messages: 'Messages', direct: 'Direct Messages', live: 'Live' };
const ICONS = { prayers: HandHeart, ministries: Users, messages: MessagesSquare, direct: User, live: Radio };

export function ChatSectionTabs({ active, onSelect }: { active: ChatSection; onSelect: (section: ChatSection) => void }) {
  const onKeyDown = (event: React.KeyboardEvent, section: ChatSection) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = CHAT_SECTIONS.indexOf(section);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? CHAT_SECTIONS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + CHAT_SECTIONS.length) % CHAT_SECTIONS.length;
    onSelect(CHAT_SECTIONS[next]);
    document.getElementById(`chat-tab-${CHAT_SECTIONS[next]}`)?.focus();
  };
  return (
    <div className="mb-5 rounded-2xl bg-[#F3EBD8] p-1.5" role="tablist" aria-label="Chat sections">
      <div className="grid grid-cols-3 gap-1">
        {CHAT_SECTIONS.map((section) => {
          const Icon = ICONS[section];
          const selected = active === section;
          return <button key={section} id={`chat-tab-${section}`} type="button" role="tab" aria-selected={selected} aria-controls={`chat-panel-${section}`} tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(section)} onKeyDown={(event) => onKeyDown(event, section)}
            className={`${section === 'direct' ? 'col-span-2' : ''} flex min-h-[48px] items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9c7321] ${selected ? 'bg-[#173c2b] text-white' : 'text-[#334b3c] hover:bg-black/5'}`}>
            <Icon size={17} className="hidden min-[390px]:block shrink-0" aria-hidden /> {SECTION_LABELS[section]}
          </button>;
        })}
      </div>
    </div>
  );
}
