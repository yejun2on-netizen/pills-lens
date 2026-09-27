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

/* ---------------------------------------------- 허가정보 (서버 /api/permit) */

export interface DocCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
}

export type DocBlock =
  | { kind: 'text'; text: string }
  | { kind: 'table'; rows: DocCell[][] };

/** 첨부문서의 한 항목 (예: "1. 경고"). 제목만 있는 항목도 있다. */
export interface DocArticle {
  title: string;
  blocks: DocBlock[];
}

export interface Ingredient {
  name: string;
  /** 예: "1.33 밀리그램" */
  amount: string;
  /** 예: "히오스시아민으로서 0.126밀리그램" */
  note: string;
}

/** 식약처 의약품 제품 허가정보 — 공식 문구를 그대로 담는다. */
export interface PermitInfo {
  seq: string;
  name: string;
  company: string;
  otc: string;
  /** 허가 상태가 '정상'이 아니면 그 상태 (예: 취소, 취하) */
  cancel: string | null;
  efficacy: DocArticle[];
  dosage: DocArticle[];
  cautions: DocArticle[];
  /** 예: "이 약 1캡슐 (315.46밀리그램) 중" */
  totalContent: string;
  ingredients: Ingredient[];
  additives: string[];
  storage: string;
  validTerm: string;
}

export type PermitResponse = { found: true; permit: PermitInfo } | { found: false };

/* ------------------------------------------- 사진 판독 (서버 /api/photo) */

/** AI가 알약 사진에서 읽은 값. 못 읽은 항목은 빈 값. */
export interface PhotoGuess {
  /** 새겨지거나 인쇄된 글자 */
  text: string;
  shape: string;
  /** 참고용 — 데이터의 색 이름과 자주 달라 자동으로 조건에 넣지 않는다 */
  colors: string[];
  form: PillForm | '';
  line: ScoreLine | '';
}
