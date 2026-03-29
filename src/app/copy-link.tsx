'use client';

import { useState } from 'react';

interface CopyLinkProps {
  url: string;
  label: string;
  className?: string;
}

export default function CopyLink({ url, label, className = '' }: CopyLinkProps) {
  const [state, setState] = useState<'idle' | 'hover' | 'copied'>('idle');

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    });
  }

  const tooltipText = state === 'copied' ? 'Copied!' : 'Copy';
  const showTooltip = state !== 'idle';

  return (
    <button
      onClick={handleCopy}
      onMouseEnter={() => setState(s => s === 'copied' ? 'copied' : 'hover')}
      onMouseLeave={() => setState(s => s === 'copied' ? 'copied' : 'idle')}
      className={`relative group/copy text-left ${className}`}
    >
      {label}
      {showTooltip && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 text-xs bg-fg text-bg px-2 py-1 rounded whitespace-nowrap">
          {tooltipText}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-fg" />
        </span>
      )}
    </button>
  );
}
