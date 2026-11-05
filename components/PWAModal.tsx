
import React from 'react';
import { X, Smartphone, Apple, Share } from 'lucide-react';

interface PWAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAModal: React.FC<PWAModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#252525] w-full max-w-[340px] rounded-2xl p-6 shadow-2xl border border-gold/30 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gold text-[#1A1A1A] rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3">
            <Smartphone size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">PLCC Connect App</h2>
          <p className="text-gray-500 text-sm mb-8">Access church updates faster by adding this page to your home screen.</p>

          <div className="w-full space-y-6 text-left">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0">
                <Apple className="text-white w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white text-sm font-bold">iPhone / iOS</h3>
                <p className="text-gray-500 text-xs">Tap <Share size={12} className="inline mx-1 text-blue-400" /> then select <span className="text-white font-medium italic">"Add to Home Screen"</span></p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="text-white font-bold text-lg">⋮</div>
              </div>
              <div>
                <h3 className="text-white text-sm font-bold">Android / Chrome</h3>
                <p className="text-gray-500 text-xs">Tap the three dots icon then select <span className="text-white font-medium italic">"Install App"</span> or <span className="text-white font-medium italic">"Add to Home Screen"</span></p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full h-[50px] bg-white/5 text-white rounded-xl mt-8 font-bold border border-white/10 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
