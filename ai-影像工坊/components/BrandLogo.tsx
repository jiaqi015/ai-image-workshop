import React from "react";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", compact = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className="relative h-10 w-10 rounded-lg border border-white/10 bg-zinc-900/70 shadow-[0_0_20px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 48 48" className="h-full w-full text-zinc-100" fill="none">
          <rect x="8" y="12" width="30" height="24" rx="6" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
          <path d="M17 12l2.2-3h7.6l2.2 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <circle cx="23" cy="24" r="6.4" stroke="currentColor" strokeWidth="1.6" opacity="0.95" />
          <circle cx="23" cy="24" r="2.2" fill="currentColor" opacity="0.85" />

          {/* Restrained claw motif */}
          <path d="M31 17.6c2.8-1.3 5.4-2.8 7.4-5.4" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M33 22.8c2.6-.4 5.3-1.4 7-3.5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
          <path d="M32.1 28c2.4.4 4.8.2 7-.8" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        </svg>
      </div>

      {!compact && (
        <div className="leading-none">
          <div className="text-[11px] tracking-[0.22em] text-zinc-300 font-semibold">CAMERACLAW</div>
          <div className="mt-1 text-[10px] tracking-[0.16em] text-zinc-500">影像工坊</div>
        </div>
      )}
    </div>
  );
};

