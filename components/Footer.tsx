
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-10 px-6 text-center">
      <a
        href="https://sanctum-live-nine.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-burgundy hover:text-gold uppercase tracking-widest font-bold transition-colors block mb-2"
      >
        Promised Land Christian Center website
      </a>
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
        &copy; {new Date().getFullYear()} Promised Land Christian Center
      </p>
      <p className="text-xs text-gray-500 mt-2 italic">
        Powered by PLCC Connect
      </p>
    </footer>
  );
};
