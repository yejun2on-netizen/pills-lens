# 알약 렌즈 (Pill Lens)

알약을 찍거나 새겨진 글자·모양·색을 고르면, **식품의약품안전처 공공데이터**에서 같은 알약을 찾아 **공식 설명(효능·용법·주의사항)** 을 보여주는 웹앱입니다.

> ⚠️ 알약 식별 결과는 틀릴 수 있습니다. 이 앱은 참고용이며 의학적 조언이 아닙니다. 확실하지 않은 약은 먹지 말고 약사·의사에게 확인하세요.

## 주요 기능

| 기능 | 설명 |
|---|---|
| **조건 검색** | 새겨진 글자 또는 제품명, 모양 11종, 색상 16종, 제형(정제·경질캡슐·연질캡슐), 분할선으로 알약 27,456개 중에서 찾습니다. 검색은 브라우저 안에서 바로 처리되고, 결과가 많으면 **새겨진 글자의 첫 글자**로 한 번에 좁힐 수 있습니다. |
| **약 설명** | 알약을 누르면 식약처 허가정보의 효능·효과, 용법·용량, 사용상의 주의사항, 성분·첨가제를 **문구를 바꾸지 않고** 보여줍니다. |
| **사진으로 찾기** | 알약 사진에서 AI가 글자·모양·제형을 읽어 검색 조건을 자동으로 채웁니다 (평균 1~2초). |

## 빠르게 시작하기

Node.js 20 이상이 필요합니다 (24에서 확인).

```bash
npm install
cp server/.env.example server/.env   # 키 입력 (아래 참고)

npm run server   # API 서버  → http://localhost:8788
npm run dev      # 화면      → http://localhost:5173
```

`public/pills.json`(알약 데이터)은 저장소에 포함되어 있어 바로 실행됩니다. **키가 없어도 조건 검색은 동작**하고, 약 설명과 사진 찾기만 비활성화됩니다.

### 필요한 키 (`server/.env`)

| 변수 | 용도 | 발급 |
|---|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 약 설명 (허가정보 API) | [data.go.kr](https://www.data.go.kr)에서 [의약품 제품 허가정보](https://www.data.go.kr/data/15095677/openapi.do) 활용신청 → 마이페이지의 **Decoding** 인증키 |
| `GEMINI_API_KEY` | 사진으로 찾기 | [Google AI Studio](https://aistudio.google.com/apikey) |

- data.go.kr 키는 계정당 하나이며, API마다 활용신청을 따로 해야 합니다. 자동승인이지만 **발급 직후 1시간 정도는** `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`가 날 수 있습니다.
- 키는 서버에만 두고 브라우저로 보내지 않습니다. `server/.env`는 git에서 제외되어 있습니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 화면 개발 서버 (Vite). `/api`는 8788로 프록시 |
| `npm run server` | API 서버 (Express, 파일이 바뀌면 재시작) |
| `npm run data` | 식약처 낱알식별 CSV를 새로 받아 `public/pills.json`을 다시 만듭니다. 로컬 CSV를 쓰려면 `npm run data -- ./파일.csv` |
| `npm test` | 테스트 (화면·검색·서버·파서) |
| `npm run build` | 타입 검사 후 `dist/`에 정적 파일 빌드 |
| `npm run sample:setup` | 사진 판독 평가용 알약 사진 샘플을 받아 `sample_img/`에 풉니다 (아래 참고) |
| `npm run eval:photos` | 샘플 사진으로 사진 판독 정확도를 잽니다 → `eval/results/` |

## 사진 판독 평가

실제로 촬영한 알약 사진으로 "사진으로 찾기"의 정확도를 잽니다.

```bash
npm run sample:setup    # 처음 한 번: 사진 샘플 받기 (약 515MB)
npm run eval:photos     # 4장마다 1장(230장) 평가. 전부는 -- --every 1
```

- **사진 출처**: 식약처·약학정보원 「[인공지능 개발을 위한 알약 이미지 데이터](https://www.data.go.kr/data/15112582/fileData.do)」 샘플 (이용허락범위 제한 없음). 22개 품목을 휴대폰으로 돌려 가며 앞·뒷면을 찍은 사진 920장(배경 제거)입니다.
- **정답표**: `eval/kpic-sample-labels.csv`. 샘플에는 폴더(식별표시 접수번호)와 품목의 대응표가 없어서, 사진과 식약처 알약 사진을 직접 대조해 만들었습니다. 1개 품목은 "불확실"로 표시해 전체 수치에서 뺍니다.
- **필요한 것**: `server/.env`의 `GEMINI_API_KEY`, 그리고 `.egg` 압축을 풀 [반디집](https://www.bandisoft.com/bandizip/) (Windows: `winget install Bandisoft.Bandizip`). 반디집이 없으면 `.cache/sample_img.Egg`를 반디집·알집으로 `sample_img/`에 직접 풀어도 됩니다.
- 사진(`sample_img/`), 받은 압축 파일(`.cache/`), 평가 결과(`eval/results/`)는 용량 때문에 git에 올리지 않습니다.
- **최근 결과** (2026-09-27, 정답 확실 220장): 정답 1위 40% · 5위 안 45%. 글자가 새겨진 앞면 사진만 보면 1위 58%. 방법과 해석은 [설계 문서 6.5](docs/design.md)에 있습니다.

## 폴더 구조

```
pill-lens/
├─ scripts/
│  ├─ buildPills.ts          낱알식별 CSV → public/pills.json
│  ├─ setupSample.ts         평가용 사진 샘플 받기·풀기 → sample_img/
│  └─ evalPhotos.ts          사진 판독 정확도 평가 → eval/results/
├─ eval/kpic-sample-labels.csv  평가 정답표 (샘플 폴더 → 알약)
├─ public/pills.json         알약 27,456개 (빌드 결과, 약 12.5MB / gzip 1.7MB)
├─ src/                      화면 (React + TypeScript)
│  ├─ App.tsx                검색 상태, 사진 판독 흐름, 결과 목록
│  ├─ types.ts               화면·서버가 함께 쓰는 타입
│  ├─ lib/
│  │  ├─ csv.ts, pillData.ts  CSV 파싱, 알약 레코드 정규화 (빌드 스크립트와 공유)
│  │  ├─ search.ts           검색·정렬, 사진 판독 결과 → 검색 조건
│  │  ├─ options.ts          모양·색·제형·분할선 선택지
│  │  ├─ api.ts, image.ts    서버 호출, 사진 축소
│  └─ ui/                    SearchPanel, PhotoSearch, PillCard, PillSheet, PermitView …
├─ server/                   API 서버 (Express)
│  ├─ app.ts                 라우트: /api/permit/:seq, /api/photo
│  ├─ permit.ts, docXml.ts   허가정보 조회, 첨부문서 XML 파싱
│  ├─ vision.ts              사진 판독 (Gemini → Gemma 폴백)
│  ├─ cache.ts               하루 캐시
│  └─ fixtures/              실제 API 응답 (테스트용)
└─ docs/design.md            상세 설계 문서
```

## API

| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| `GET` | `/api/permit/:seq` | 품목일련번호 9자리 | `{ found: true, permit }` 또는 `{ found: false }` |
| `POST` | `/api/photo` | 이미지 바이트 (`Content-Type: image/jpeg·png·webp`, 8MB 이하) | `{ text, shape, colors, form, line }` |

오류는 `400`(잘못된 요청)과 `502`(외부 API 실패)로 돌려주며, 오류 내용이나 키는 응답에 싣지 않습니다.

## 데이터 출처

| 데이터 | 출처 | 이용 조건 |
|---|---|---|
| 알약 식별 정보·사진 | 식약처 [의약품 낱알식별 정보](https://www.data.go.kr/data/15057639/openapi.do) (의약품안전나라 CSV) | 이용허락범위 제한 없음 |
| 효능·용법·주의사항·성분 | 식약처 [의약품 제품 허가정보](https://www.data.go.kr/data/15095677/openapi.do) | 이용허락범위 제한 없음 |

약학정보원(health.kr)도 같은 식별 검색을 제공하지만, 약관이 콘텐츠의 복제·재배포를 금지하고 있어 사용하지 않았습니다. 대신 상세 화면에서 식약처 **의약품안전나라** 제품 페이지로 링크합니다.

## 한계

- **사진 판독은 배경이 제거된 촬영 사진으로 평가했습니다** ([사진 판독 평가](#사진-판독-평가)). 책상·손 같은 배경이 있는 실제 사용 사진은 아직 평가하지 않았습니다.
- 표본 60개 기준으로 약 12%는 허가정보에 없어 설명 대신 안내 문구가 나옵니다 (허가 취소·변경 품목 등).
- 알약 데이터가 12.5MB라 휴대폰 데이터로 처음 열 때 느릴 수 있습니다 (배포 시 gzip 압축으로 1.7MB).
- API 서버는 빌드된 화면(`dist/`)을 서빙하지 않습니다. 배포하려면 정적 호스팅과 API 서버를 따로 두거나, 서버에 정적 서빙을 추가해야 합니다.

설계 결정과 근거, 데이터 특이점, 시험 결과는 [docs/design.md](docs/design.md)에 정리되어 있습니다.
