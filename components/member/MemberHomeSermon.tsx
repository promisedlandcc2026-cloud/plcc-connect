import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen } from 'lucide-react';
import { ErrorState, LoadingState } from '../ui/States';
import { fetchMemberHomeLatestSermon, type HomeSermonPreview } from '../../lib/memberHomeData';
import { notesNewPath, startContextFromSermonPreview } from '../../lib/sermonNotesUi';

export const MemberHomeSermon: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sermon, setSermon] = useState<HomeSermonPreview | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSermon(await fetchMemberHomeLatestSermon());
    } catch {
      setError('Could not load the latest sermon.');
      setSermon(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!loading && !error && !sermon) {
    return null;
  }

  // Sits under the Watch player on Home, so it carries no section header and
  // no Watch button of its own — just what was preached and a Take Notes button.
  return (
    <div id="sermon-notes" className="scroll-mt-24">
      {loading ? <LoadingState message="Loading sermon…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && sermon ? (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-muted truncate">
              {sermon.date ? formatSermonDate(sermon.date) : 'Latest sermon'}
            </p>
            <h3 className="text-[15px] font-bold text-ink leading-snug line-clamp-2">{sermon.title}</h3>
            {sermon.scripture || sermon.speaker ? (
              <p className="text-xs text-gray-500 truncate">
                {[sermon.scripture, sermon.speaker].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <Link
            to={notesNewPath(startContextFromSermonPreview(sermon))}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] rounded-xl bg-burgundy/10 px-3 text-sm font-bold text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            <NotebookPen size={16} aria-hidden />
            Take Notes
          </Link>
        </div>
      ) : null}
    </div>
  );
};

/** "Sun, Oct 25" — same style as event dates on Home. Date-only values are read as local days. */
function formatSermonDate(value: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
