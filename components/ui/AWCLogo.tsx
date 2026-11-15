import React from 'react';

interface AWCLogoProps {
  size?: number;
  className?: string;
}

export const AWCLogo: React.FC<AWCLogoProps> = ({ size = 120, className = '' }) => (
  <img
    src="/awc_connect_logo.png"
    alt="Tribes — Promised Land Christian Center"
    width={size}
    height={size}
    className={`object-contain ${className}`}
  />
);
