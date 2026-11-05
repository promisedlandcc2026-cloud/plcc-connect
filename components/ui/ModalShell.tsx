import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * App-level overlay. Sits above BottomNav (z-110) and AWCAssistant so
 * primary actions are never covered by the home FAB.
 * Portaled to document.body so it escapes .awc-home-shell isolation.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-shell-title"
        className="bg-eggshell w-full max-w-[420px] rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[min(82vh,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 bg-[#1A1A1A] text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 min-w-[44px] min-h-[44px] bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="pr-12 flex items-start gap-3">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0 pt-0.5">
              <h2 id="modal-shell-title" className="text-xl font-bold leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p className="text-gold/90 text-xs uppercase tracking-[0.18em] font-bold mt-1.5">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="p-5 overflow-y-auto no-scrollbar flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
