/**
 * 식약처 의약품안전나라 CSV 파서.
 *
 * 이 파일은 표준 CSV(RFC 4180)가 아니다. 값을 따옴표로 감싸지 않고, 성상 같은 값 안에
 * 따옴표가 그대로 들어 있다(예: 한면에“SZ"와…). 따옴표를 특별 취급하면 그 뒤 수천 줄이
 * 한 값으로 삼켜지므로, 한 줄 = 한 레코드, 쉼표 = 구분자로만 읽는다.
 */
export function parseCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line !== '')
    .map((line) => line.split(','));
}
