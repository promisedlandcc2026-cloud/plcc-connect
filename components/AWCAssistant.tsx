
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X } from 'lucide-react';
import { AWCLogo } from './ui/AWCLogo';

/** Other screens open the assistant with: window.dispatchEvent(new Event(ASSISTANT_OPEN_EVENT)) */
export const ASSISTANT_OPEN_EVENT = 'awc-assistant-open';

export function openAssistant(): void {
  window.dispatchEvent(new Event(ASSISTANT_OPEN_EVENT));
}

/**
 * Hide the floating launcher at the top of the page (where the hero and hub
 * tiles are) and while the reader scrolls down; bring it back when they scroll
 * up or pause further down the page.
 */
function useLauncherHidden(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(() => typeof window === 'undefined' || window.scrollY < 240);
  useEffect(() => {
    if (!enabled) return;
    let lastY = window.scrollY;
    let idle = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      // Near the top the first screen (hub tiles, hero) needs the space.
      if (y < 240) setHidden(true);
      else if (delta > 4) setHidden(true);
      else if (delta < -4) setHidden(false);
      window.clearTimeout(idle);
      if (y >= 240) idle = window.setTimeout(() => setHidden(false), 1200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idle);
    };
  }, [enabled]);
  return enabled && hidden;
}

export const AWCAssistant: React.FC<{ showLauncher?: boolean }> = ({ showLauncher = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const launcherHidden = useLauncherHidden(showLauncher);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(ASSISTANT_OPEN_EVENT, open);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, open);
  }, []);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Welcome to PLCC Connect! How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    // AI client loads only after the member intentionally sends a message.
    const { askAWCAssistant } = await import('../lib/ai');

    const response = await askAWCAssistant(userMsg);

    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      {
        role: 'bot',
        text:
          response ||
          "I'm not sure about that. Let me know if I can help with something else!",
      },
    ]);
  };

  return (
    <>
      {/* Launcher: labeled pill that steps aside while you scroll down (visitors). */}
      {showLauncher ? (
        <div
          className={`pointer-events-none fixed bottom-24 left-1/2 z-[80] w-full max-w-[500px] -translate-x-1/2 px-5 transition-all duration-300 ${
            launcherHidden ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            tabIndex={launcherHidden ? -1 : 0}
            className={`ml-auto flex h-12 items-center gap-2 rounded-full bg-gold pl-4 pr-5 text-burgundy font-bold text-sm shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-transform active:scale-95 ${
              launcherHidden ? '' : 'pointer-events-auto'
            }`}
            aria-label="Ask PLCC Assistant"
          >
            <Sparkles size={18} fill="currentColor" aria-hidden />
            Ask PLCC
          </button>
        </div>
      ) : null}

      {/* Assistant Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="PLCC Assistant"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-eggshell w-full max-w-[500px] sm:max-w-[400px] h-[85vh] sm:h-[600px] sm:max-h-[80vh] rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="bg-burgundy p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                  <AWCLogo size={40} />
                </div>
                <div>
                  <h3 className="font-bold">PLCC Assistant</h3>
                  <p className="text-sm text-white/80">Ask about services, events, or PLCC</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant" className="h-11 w-11 inline-flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Chat Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-white/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-burgundy text-white rounded-tr-none' 
                      : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'}
                  `}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isTyping) void handleSend();
                  }}
                  disabled={isTyping}
                  placeholder="Ask me anything about PLCC..."
                  className="flex-1 h-12 bg-gray-50 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20 disabled:opacity-60"
                />
                <button 
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isTyping || !input.trim()}
                  className="w-12 h-12 bg-burgundy text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-lg disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
