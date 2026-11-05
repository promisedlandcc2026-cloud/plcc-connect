/**
 * Announcement image with graceful fallback when the stored URL fails to load.
 * Vault stores a free-text image_url — expired or blocked hosts show as broken
 * unless we catch onError.
 */
import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

type AnnouncementImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  /** Wrapper used when there is no usable image */
  fallbackClassName?: string;
  iconSize?: number;
};

export const AnnouncementImage: React.FC<AnnouncementImageProps> = ({
  src,
  alt,
  className = 'w-full h-40 object-cover',
  fallbackClassName = 'w-full h-40 bg-gray-100 flex items-center justify-center text-gray-500',
  iconSize = 32,
}) => {
  const [failed, setFailed] = useState(false);
  const usable = Boolean(src && String(src).trim() && !failed);

  if (!usable) {
    return (
      <div className={fallbackClassName} aria-hidden>
        <ImageIcon size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={String(src).trim()}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
