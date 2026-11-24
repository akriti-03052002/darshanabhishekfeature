import React from 'react';
import { GestureIconKey } from '../logic/gestureEngine';

interface GestureIconProps {
  iconKey: GestureIconKey;
  className?: string;
}

export const GestureIcon: React.FC<GestureIconProps> = ({ iconKey, className = 'h-6 w-6' }) => {
  switch (iconKey) {
    case 'namaste':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 4v14" />
          <path d="M14 4c-2.2 3.4-4.2 7.2-5 11.2-.5 2.4.9 4.8 3.3 5.2L14 21" />
          <path d="M14 4c2.2 3.4 4.2 7.2 5 11.2.5 2.4-.9 4.8-3.3 5.2L14 21" />
          <path d="M14 23v2.5M10.5 22.5l-1.5 2M17.5 22.5l1.5 2" />
        </svg>
      );
    case 'cupped':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4.5 14c1.2 4.6 5.1 7.2 9.5 7.2s8.3-2.6 9.5-7.2" />
          <path d="M6.5 11.5c1.5 2.6 4.2 4.2 7.5 4.2s6-1.6 7.5-4.2" />
          <path d="M14 5v4.5M11.8 7.3L14 5l2.2 2.3" />
        </svg>
      );
    case 'pour':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M9.5 7.5l6.5-2.5 3.5 7.5a5 5 0 0 1-7.4 6.2l-3.6-4.5z" />
          <path d="M7 11.5c-1.8 2.2-2.2 6.8-2.2 10.5" />
          <path d="M21.5 6.5c1.5 1.4 2.2 3.1 2.2 5" />
          <path d="M22.2 10l1.5 1.8 1.5-1.8" />
        </svg>
      );
    case 'pinch-release':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M10 13.5c0-3.2 2.2-6 4.5-6s3.2 2.2 2.6 4.2c-.6 1.8-2.8 2.3-4.6 2.1" />
          <path d="M8.5 18.5l2.8-4.5M18 19.5c2.2-1.8 3.8-4.4 4-7" />
          <circle cx="13.2" cy="11.8" r="1.4" fill="currentColor" stroke="none" />
          <path d="M6.5 22.5h15" />
        </svg>
      );
    case 'pinch-flame':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 4.5c2.4 2.6 3.5 4.8 3.5 6.9a3.5 3.5 0 1 1-7 0c0-2.1 1.1-4.3 3.5-6.9z" />
          <path d="M9.5 19.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5" />
          <path d="M7.5 22.5h13" />
        </svg>
      );
    case 'aarti-circle':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M21.5 14a7.5 7.5 0 1 1-2.6-5.7" />
          <path d="M19.5 5.5l-.2 3.2-3.2-.2" />
          <circle cx="14" cy="14" r="2.2" />
        </svg>
      );
    case 'chaur-sweep':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 21v-8" />
          <path d="M14 13c-3-4-4-7.5-1.5-8.5 1-.4 2-.4 3 0 2.5 1 1.5 4.5-1.5 8.5z" />
          <path d="M5.5 16.5h4.5M18 16.5h4.5" />
          <path d="M7.5 14.5l-2 2 2 2M20.5 14.5l2 2-2 2" />
        </svg>
      );
    case 'tasbih':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="14" cy="12" r="7" strokeDasharray="1.5 3.5" />
          <path d="M14 19v4.5M12.2 22.5h3.6" />
        </svg>
      );
    case 'bowl':
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M5.5 13h17a8.5 8.5 0 0 1-17 0z" />
          <path d="M9.5 22.5h9M17 9l4.5-4.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 5v13" />
          <path d="M14 5c-2.5 3.5-4.5 7-4.5 10.8a4.5 4.5 0 0 0 9 0C18.5 12 16.5 8.5 14 5z" />
          <circle cx="14" cy="14" r="10.5" strokeOpacity="0.35" />
        </svg>
      );
  }
};
