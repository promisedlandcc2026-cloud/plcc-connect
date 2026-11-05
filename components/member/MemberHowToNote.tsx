/**
 * Short in-app how-to for Directory opt-in and ministry join requests.
 */
import React from 'react';
import { Link } from 'react-router-dom';

type MemberHowToNoteProps = {
  /** Which tips to emphasize on this page */
  focus?: 'directory' | 'privacy' | 'ministries' | 'both';
};

export const MemberHowToNote: React.FC<MemberHowToNoteProps> = ({ focus = 'both' }) => {
  const showDirectory = focus === 'directory' || focus === 'privacy' || focus === 'both';
  const showMinistry = focus === 'ministries' || focus === 'both';

  return (
    <aside className="rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3.5 space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-gold-ink">Quick how-to</p>

      {showDirectory ? (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-[#1A1A1A]">Appear in the Directory</p>
          <ol className="list-decimal list-inside text-xs text-gray-600 leading-relaxed space-y-0.5">
            <li>
              Open{' '}
              <Link to="/profile" className="font-bold text-burgundy">
                More → My Profile
              </Link>
            </li>
            <li>Turn on <span className="font-semibold">Show me in the Member Directory</span></li>
            <li>Choose what others may see (photo, phone, etc.)</li>
            <li>
              Others find you under{' '}
              <Link to="/directory" className="font-bold text-burgundy">
                More → Directory
              </Link>
            </li>
          </ol>
          <p className="text-xs text-gray-500 leading-relaxed">
            Each adult opts in on their own account — household links do not list a spouse
            automatically.
          </p>
        </div>
      ) : null}

      {showMinistry ? (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-[#1A1A1A]">Join a ministry</p>
          <ol className="list-decimal list-inside text-xs text-gray-600 leading-relaxed space-y-0.5">
            <li>
              Open{' '}
              <Link to="/ministries" className="font-bold text-burgundy">
                More → Ministries
              </Link>
            </li>
            <li>Open a ministry hub</li>
            <li>Tap <span className="font-semibold">Request to join</span> and pick a team</li>
            <li>Status stays pending until leadership reviews</li>
          </ol>
        </div>
      ) : null}
    </aside>
  );
};
