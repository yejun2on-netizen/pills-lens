// @vitest-environment node
import { parseGuess, analyzePhoto, buildVisionPrompt, EMPTY_GUESS } from './vision';

describe('parseGuess', () => {
  it('JSON을 꺼내 글자·모양·색·제형·분할선을 읽는다', () => {
    const raw = '```json\n{"imprint": " JW  5 ", "shape": "삼각형", "colors": ["갈색"], "form": "정제", "line": "없음", "is_pill": true}\n```';
    expect(parseGuess(raw)).toEqual({ text: 'JW 5', shape: '삼각형', colors: ['갈색'], form: '정제', line: '없음' });
  });

  it('선택지 밖의 값은 버리고 색은 중복 없이 2개까지만', () => {
    expect(parseGuess('{"imprint": 12, "shape": "별모양", "colors": ["남색", "형광", "남색", "노랑", "하양"], "form": "알약", "line": "?"}'))
      .toEqual({ text: '', shape: '', colors: ['남색', '노랑'], form: '', line: '' });
  });

  it('알약이 아니라고 하거나 JSON이 깨지면 빈 결과', () => {
    expect(parseGuess('{"imprint": "A", "shape": "원형", "is_pill": false}')).toEqual(EMPTY_GUESS);
    expect(parseGuess('모르겠어요')).toEqual(EMPTY_GUESS);
    expect(parseGuess('{"imprint": ')).toEqual(EMPTY_GUESS);
  });
});

describe('buildVisionPrompt', () => {
  it('검색 선택지(모양·색)를 그대로 알려준다', () => {
    const p = buildVisionPrompt();
    expect(p).toContain('"마름모형"');
    expect(p).toContain('청록');
  });
});

describe('analyzePhoto', () => {
  const KEY = 'gemini-secret';
  const IMG = Buffer.from('fake-jpeg');
  const reply = (obj: object) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }));
  afterEach(() => vi.unstubAllGlobals());

  it('사진을 inline_data로 보내고 키는 URL이 아닌 헤더에 싣는다', async () => {
    const fetchMock = vi.fn(async () => reply({ imprint: 'MC5', shape: '팔각형', colors: ['하양'], form: '정제', line: '없음' }));
    vi.stubGlobal('fetch', fetchMock);
    const g = await analyzePhoto(IMG, 'image/jpeg', KEY, ['model-a']);
    expect(g).toEqual({ text: 'MC5', shape: '팔각형', colors: ['하양'], form: '정제', line: '없음' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/model-a:generateContent');
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: IMG.toString('base64') });
  });

  it('앞 모델이 실패하면 다음 모델로 넘어간다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(reply({ imprint: 'KDC', shape: '오각형', colors: [], form: '정제', line: '없음' }));
    vi.stubGlobal('fetch', fetchMock);
    const g = await analyzePhoto(IMG, 'image/jpeg', KEY, ['first', 'gemma-second']);
    expect(g.text).toBe('KDC');
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemma-second');
    // gemma는 JSON 모드 대신 thinking 최소
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig).toEqual({ thinkingConfig: { thinkingLevel: 'MINIMAL' } });
  });

  it('모든 모델이 실패하면 오류, 키가 없으면 바로 오류', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })));
    await expect(analyzePhoto(IMG, 'image/jpeg', KEY, ['a', 'b'])).rejects.toThrow('b HTTP 503');
    await expect(analyzePhoto(IMG, 'image/jpeg', '')).rejects.toThrow('GEMINI_API_KEY');
  });
});
