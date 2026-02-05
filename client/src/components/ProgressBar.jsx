import React from "react";

export default function ProgressBar({ value, max, tone = "gold", showLabel = false }) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(Math.max((value / safeMax) * 100, 0), 100);

  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
      <div 
        className="progress-fill" 
        style={{ 
          width: `${percent}%`,
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }} 
      />
      {showLabel && (
        <span className="progress-label" style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '10px',
          fontWeight: '700',
          color: percent > 50 ? '#22140b' : 'var(--muted)'
        }}>
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}
