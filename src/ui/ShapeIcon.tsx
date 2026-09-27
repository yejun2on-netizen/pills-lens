const POLYGONS: Record<string, string> = {
  삼각형: '12,4 21,19.5 3,19.5',
  마름모형: '12,3 21,12 12,21 3,12',
  오각형: '12,3.5 20.6,9.7 17.3,20.3 6.7,20.3 3.4,9.7',
  육각형: '12,3 19.8,7.5 19.8,16.5 12,21 4.2,16.5 4.2,7.5',
  팔각형: '15.4,3.7 20.3,8.6 20.3,15.4 15.4,20.3 8.6,20.3 3.7,15.4 3.7,8.6 8.6,3.7',
};

/** 알약 모양 선택지용 작은 도형 아이콘 */
export function ShapeIcon({ shape }: { shape: string }) {
  const common = { stroke: 'currentColor', strokeWidth: 1.6, fill: 'var(--shape-fill)', strokeLinejoin: 'round' as const };
  let el;
  if (shape === '원형') el = <circle cx="12" cy="12" r="8.5" {...common} />;
  else if (shape === '타원형') el = <ellipse cx="12" cy="12" rx="10" ry="6.5" {...common} />;
  else if (shape === '장방형') el = <rect x="2" y="7" width="20" height="10" rx="5" {...common} />;
  else if (shape === '반원형') el = <path d="M3.5 16.5a8.5 8.5 0 0 1 17 0Z" {...common} />;
  else if (shape === '사각형') el = <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" {...common} />;
  else if (POLYGONS[shape]) el = <polygon points={POLYGONS[shape]} {...common} />;
  else el = <circle cx="12" cy="12" r="8.5" {...common} strokeDasharray="3 2.4" />;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {el}
    </svg>
  );
}
