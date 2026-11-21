/** Map the public site's allowlisted service key to the existing request workflow. */
export function pastoralService(key) {
  if (key === 'baptism') return { category:'baptism', label:null };
  if (key === 'counseling') return { category:'counseling', label:null };
  const label = key === 'dedication' ? 'Child dedication' : key === 'wedding' ? 'Wedding' : key === 'other' ? 'Other' : null;
  return { category:'appointment', label };
}
export function pastoralMessage(label, category, message) {
  return label && category === 'appointment' ? `[Service: ${label}]${message ? `\n${message}` : ''}` : message;
}
