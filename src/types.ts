export type PillForm = '정제' | '경질캡슐' | '연질캡슐' | '기타';
export type ScoreLine = '없음' | '일자' | '십자' | '기타';

/** 식약처 낱알식별 정보 한 건 (public/pills.json 의 원소). */
export interface Pill {
  /** 알약 한 종류의 고유 id. 한 품목에 함량별 알약이 여럿이면(예: 라믹탈정 25|50|100mg) seq가 겹쳐서 따로 둔다. */
  id: string;
  /** 품목일련번호 — 허가정보 API와 연결하는 키 */
  seq: string;
  name: string;
  company: string;
  image: string;
  /** 표시(식별문자) 앞/뒤 원문. 없으면 '' */
  front: string;
  back: string;
  shape: string;
  colors: string[];
  line: ScoreLine;
  form: PillForm;
  /** 제형코드명 원문 (예: 필름코팅정) */
  formName: string;
  /** 전문의약품 / 일반의약품 */
  otc: string;
  className: string;
  /** 성상 */
  chart: string;
  /** [장축, 단축, 두께] mm */
  size: [number, number, number] | null;
}

export interface PillDataset {
  updated: string;
  count: number;
  pills: Pill[];
}
