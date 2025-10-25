import React from 'react';
import './CallLogBadge.css';

interface CallLogBadgeProps {
  count: number;
}

export const CallLogBadge: React.FC<CallLogBadgeProps> = ({ count }) => {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span className="call-log-badge">
      {displayCount}
    </span>
  );
};

