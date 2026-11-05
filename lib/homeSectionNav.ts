/**
 * Navigate to a Home section id (visitor or member shell).
 * Used by Member More → existing Home anchors until dedicated hubs ship.
 */

export function scrollToHomeSection(sectionId: string): void {
  if (sectionId === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/**
 * @returns true if already on Home and scrolled; false if caller should navigate to `/` first.
 */
export function goToHomeSection(
  pathname: string,
  navigate: (to: string) => void,
  sectionId: string
): boolean {
  if (pathname === '/') {
    scrollToHomeSection(sectionId);
    return true;
  }
  navigate('/');
  window.setTimeout(() => scrollToHomeSection(sectionId), 120);
  return false;
}
