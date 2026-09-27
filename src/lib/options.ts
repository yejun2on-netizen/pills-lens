import type { PillForm, ScoreLine } from '../types';

/** 검색 선택지. 값은 식약처 원본 데이터의 표기와 같다. */
export const SHAPES = ['원형', '타원형', '장방형', '반원형', '삼각형', '사각형', '마름모형', '오각형', '육각형', '팔각형', '기타'];

export const COLORS: { name: string; hex: string }[] = [
  { name: '하양', hex: '#ffffff' },
  { name: '노랑', hex: '#f6d23c' },
  { name: '주황', hex: '#f59a3a' },
  { name: '분홍', hex: '#f3a5bf' },
  { name: '빨강', hex: '#e04a3f' },
  { name: '갈색', hex: '#9b6a3c' },
  { name: '연두', hex: '#a9d65e' },
  { name: '초록', hex: '#3fa45f' },
  { name: '청록', hex: '#26a69a' },
  { name: '파랑', hex: '#3f7fe0' },
  { name: '남색', hex: '#2d3f8f' },
  { name: '자주', hex: '#a23b86' },
  { name: '보라', hex: '#8a5bd0' },
  { name: '회색', hex: '#9aa1a8' },
  { name: '검정', hex: '#26282b' },
  { name: '투명', hex: 'transparent' },
];

export const FORMS: PillForm[] = ['정제', '경질캡슐', '연질캡슐', '기타'];

export const LINES: { value: ScoreLine; label: string }[] = [
  { value: '없음', label: '없음' },
  { value: '일자', label: '일자 ( − )' },
  { value: '십자', label: '십자 ( + )' },
  { value: '기타', label: '기타' },
];

/** 의약품안전나라 제품 상세 페이지 (식약처 공식) */
export function nedrugUrl(seq: string): string {
  return `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${encodeURIComponent(seq)}`;
}
