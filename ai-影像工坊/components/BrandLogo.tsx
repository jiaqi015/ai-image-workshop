import React from 'react';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', compact = false }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className="h-9 w-9 ui-surface-soft flex items-center justify-center" style={{ borderColor: 'var(--ui-border)' }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ui-text-secondary)' }} />
          <circle cx="12" cy="12.5" r="3.3" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--ui-text-secondary)' }} />
          <circle cx="18.4" cy="8.4" r="1.3" fill="var(--ui-accent)" />
        </svg>
      </div>

      {!compact && (
        <div className="leading-none">
          <div className="text-[12px] font-semibold" style={{ color: 'var(--ui-text-primary)' }}>AI影像工坊</div>
          <div className="mt-1 ui-meta">专业创作工作台</div>
        </div>
      )}
    </div>
  );
};
