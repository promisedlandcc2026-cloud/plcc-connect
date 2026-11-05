export type VaultNewsKind = 'church' | 'database' | 'celebration' | 'sympathy';

export type VaultNewsItem = {
  id: string;
  created_at: string | null;
  title: string;
  body: string;
  kind: VaultNewsKind;
  author_name: string | null;
  author_role: string | null;
};

export const VAULT_NEWS_KIND_LABEL: Record<VaultNewsKind, string> = {
  church: 'Church',
  database: 'Database',
  celebration: 'Celebration',
  sympathy: 'Sympathy',
};

const POST_ROLES = new Set(['SUPER_ADMIN', 'PASTOR', 'MINISTRY_LEADER']);

export function canPostVaultNews(role: string | null | undefined): boolean {
  if (!role) return false;
  return POST_ROLES.has(String(role).trim().toUpperCase());
}

export function vaultNewsRoleLabel(role: string | null | undefined): string {
  const r = String(role || '').toUpperCase();
  if (r === 'SUPER_ADMIN') return 'Super Admin';
  if (r === 'MINISTRY_LEADER') return 'Ministry Leader';
  if (r === 'PASTOR') return 'Pastor';
  return r
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatVaultNewsWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function vaultNewsShareText(item: VaultNewsItem, homeUrl?: string): string {
  const kind = VAULT_NEWS_KIND_LABEL[item.kind] || 'Church';
  const who = [item.author_name || 'Leader', item.author_role ? vaultNewsRoleLabel(item.author_role) : '']
    .filter(Boolean)
    .join(' · ');
  const home =
    homeUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://plcc-connect.vercel.app');
  return [`Canaan News · ${kind}`, item.title, '', item.body, '', `— ${who}`, 'Promised Land Christian Center', home].join('\n');
}
