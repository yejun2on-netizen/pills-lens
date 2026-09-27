export function Disclaimer({ updated }: { updated?: string }) {
  return (
    <p className="disclaimer">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span>
        본 정보는 참고용이며 의학적 조언이 아닙니다. 알약 식별 결과는 틀릴 수 있으니 복용 전 반드시 약사·의사에게 확인하세요.
        <br />출처: 식품의약품안전처 의약품 낱알식별 정보{updated && ` (${updated} 기준)`}
      </span>
    </p>
  );
}
