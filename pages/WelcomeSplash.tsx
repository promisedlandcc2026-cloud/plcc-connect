
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CHURCH_INFO } from '../data';
import { AWCLogo } from '../components/ui/AWCLogo';
import { SlideToBegin } from '../components/ui/SlideToBegin';

export const WelcomeSplash: React.FC<{ onEnter?: () => void }> = ({ onEnter }) => {
    const navigate = useNavigate();
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowContent(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleEnter = () => {
        localStorage.setItem('awc_seen_splash', 'true');
        if (onEnter) onEnter();
        navigate('/');
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A] flex flex-col items-center justify-between px-8 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-burgundy/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-[100px] pointer-events-none" />

            <div className={`flex flex-col items-center justify-center flex-1 w-full space-y-10 transition-all duration-1000 transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="relative flex justify-center">
                    <div className="absolute inset-0 bg-gold rounded-full blur-3xl opacity-15 animate-pulse scale-110" />
                    <AWCLogo size={220} className="relative z-10 drop-shadow-2xl" />
                </div>

                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-black text-white tracking-tight leading-none font-serif">
                        Welcome <br />
                        <span className="text-gold">Home</span>
                    </h1>
                    <div className="w-12 h-1 bg-burgundy mx-auto rounded-full" />
                    <p className="text-gray-400 text-sm font-medium tracking-wide uppercase max-w-[200px] mx-auto leading-relaxed">
                        {CHURCH_INFO.motto}
                    </p>
                </div>
            </div>

            <div className={`w-full max-w-[300px] space-y-4 mb-2 transition-all duration-1000 delay-500 transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <SlideToBegin onComplete={handleEnter} />
                <Link
                    to="/install"
                    className="flex min-h-[44px] items-center justify-center text-sm font-bold text-gold underline underline-offset-4"
                >
                    How to put the app on your phone
                </Link>
                <p className="text-center text-xs text-white/20 font-bold uppercase tracking-[0.2em]">
                    Promised Land Christian Center
                </p>
            </div>
        </div>
    );
};
