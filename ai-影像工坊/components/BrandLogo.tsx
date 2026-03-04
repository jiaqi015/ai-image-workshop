import React from 'react';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', compact = false }) => {
  const markSizeClass = compact ? 'h-8 w-8' : 'h-9 w-9';
  const titleClass = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <div className={`flex items-center gap-2.5 ${className}`.trim()}>
      <div className={`${markSizeClass} ui-surface-soft flex items-center justify-center`} style={{ borderColor: 'var(--ui-border)' }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.2" stroke="currentColor" strokeWidth="1.35" style={{ color: 'var(--ui-text-secondary)' }} />
          <circle cx="12" cy="12" r="5.25" stroke="currentColor" strokeWidth="1.35" style={{ color: 'var(--ui-text-secondary)' }} />
          <circle cx="12" cy="12" r="2.15" fill="var(--ui-accent)" opacity="0.85" />
          <path d="M12 6.75l2.15 1.2M17.25 12l-1.2 2.15M12 17.25l-2.15-1.2M6.75 12l1.2-2.15" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" style={{ color: 'var(--ui-text-muted)' }} />
        </svg>
      </div>

      <div className={`${titleClass} font-semibold tracking-[0.08em] leading-none`} style={{ color: 'var(--ui-text-primary)' }}>
        影像工坊
      </div>
    </div>
  );
};
