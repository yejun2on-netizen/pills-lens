import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App';
import type { Pill, PillDataset } from './types';

function pill(over: Partial<Pill>): Pill {
  return {
    id: over.seq ?? '1', seq: '1', name: '테스트정', company: '테스트제약', image: '', front: '', back: '', shape: '원형',
    colors: ['하양'], line: '없음', form: '정제', formName: '나정', otc: '일반의약품', className: '', chart: '', size: null,
    ...over,
  };
}

const dataset: PillDataset = {
  updated: '2026-09-27',
  count: 3,
  pills: [
    pill({ seq: 'a', name: '노랑정', front: 'YH', back: 'LT', colors: ['노랑'] }),
    pill({ seq: 'b', name: '하양정', front: 'AB', shape: '타원형' }),
    pill({ seq: 'c', name: '빨강캡슐', front: 'D-W', form: '경질캡슐', shape: '장방형', colors: ['빨강', '하양'] }),
  ],
};

let photoResponse: () => Response;
let pillData: PillDataset;

beforeEach(() => {
  pillData = dataset;
  photoResponse = () => new Response(JSON.stringify({ text: 'DW', shape: '장방형', colors: ['빨강'], form: '경질캡슐', line: '없음' }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url) === '/api/photo') return photoResponse();
    return new Response(JSON.stringify(String(url).startsWith('/api/permit/') ? { found: false } : pillData));
  }));
  // jsdom에는 사진 미리보기용 URL API가 없다
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('App — 첫 글자로 좁히기', () => {
  // 하양 원형 알약 40개: K로 시작 25개, S로 시작 15개(그중 5개는 뒷면이 K)
  const many: PillDataset = {
    updated: '2026-09-27',
    count: 40,
    pills: Array.from({ length: 40 }, (_, i) => pill({
      seq: `p${i}`,
      name: `알약${String(i).padStart(2, '0')}정`,
      front: i < 25 ? `K${i}` : `S${i}`,
      back: i >= 35 ? 'K' : '',
    })),
  };

  it('결과가 30개를 넘으면 첫 글자 버튼이 나오고, 고르면 좁혀지고, 지우면 돌아온다', async () => {
    pillData = many;
    render(<App />);
    await screen.findByText('조건을 골라 주세요');
    const filters = screen.getByRole('region', { name: '알약 검색 조건' });
    fireEvent.click(within(filters).getByRole('button', { name: /하양/ }));

    const picker = await screen.findByRole('region', { name: '첫 글자로 좁히기' });
    expect(within(picker).getByRole('button', { name: 'K 30개' })).toBeInTheDocument();
    expect(within(picker).getByRole('button', { name: 'S 15개' })).toBeInTheDocument();

    fireEvent.click(within(picker).getByRole('button', { name: 'S 15개' }));
    expect(await screen.findByText('좁힌 첫 글자')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /찾은 알약/ })).toHaveTextContent('찾은 알약 15개');

    fireEvent.click(screen.getByRole('button', { name: '첫 글자 지우기' }));
    expect(await screen.findByRole('region', { name: '첫 글자로 좁히기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /찾은 알약/ })).toHaveTextContent('찾은 알약 40개');
  });

  it('결과가 30개 이하이거나 글자를 넣었으면 나오지 않는다', async () => {
    pillData = many;
    render(<App />);
    await screen.findByText('조건을 골라 주세요');
    fireEvent.change(screen.getByPlaceholderText(/예: YH/), { target: { value: 'K' } });
    expect(await screen.findByRole('heading', { name: /찾은 알약/ })).toHaveTextContent('찾은 알약 30개');
    expect(screen.queryByRole('region', { name: '첫 글자로 좁히기' })).not.toBeInTheDocument();
  });
});

function takePhoto(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(['x'], 'pill.jpg', { type: 'image/jpeg' })] } });
}

describe('App — 사진으로 찾기', () => {
  it('사진에서 읽은 글자로 찾고, 모양·색은 거르지 않는다', async () => {
    const { container } = render(<App />);
    await screen.findByText('조건을 골라 주세요');
    takePhoto(container);

    expect(await screen.findByText('사진에서 읽은 내용으로 찾았어요')).toBeInTheDocument();
    expect(screen.getByText(/새겨진 글자로 찾고/)).toBeInTheDocument();
    expect(screen.getByText('빨강캡슐')).toBeInTheDocument();
    expect(screen.queryByText('노랑정')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/예: YH/)).toHaveValue('DW');
    const filters = screen.getByRole('region', { name: '알약 검색 조건' });
    expect(within(filters).getByRole('button', { name: /장방/ })).toHaveAttribute('aria-pressed', 'false');
    expect(within(filters).getByRole('button', { name: /빨강/ })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '색도 조건에 넣기' }));
    expect(within(filters).getByRole('button', { name: /빨강/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('판독에 실패하면 안내하고, 직접 고를 수 있게 둔다', async () => {
    photoResponse = () => new Response('', { status: 502 });
    const { container } = render(<App />);
    await screen.findByText('조건을 골라 주세요');
    takePhoto(container);
    expect(await screen.findByRole('alert')).toHaveTextContent('사진을 읽지 못했어요');
    expect(screen.getByText('조건을 골라 주세요')).toBeInTheDocument();
  });

  it('알약이 없는 사진이면 다시 찍어 달라고 한다', async () => {
    photoResponse = () => new Response(JSON.stringify({ text: '', shape: '', colors: [], form: '', line: '' }));
    const { container } = render(<App />);
    await screen.findByText('조건을 골라 주세요');
    takePhoto(container);
    expect(await screen.findByRole('alert')).toHaveTextContent('알약을 알아보지 못했어요');
  });
});

describe('App', () => {
  it('조건이 없으면 안내만 보이고, 글자를 넣으면 맞는 알약이 나온다', async () => {
    render(<App />);
    expect(await screen.findByText('조건을 골라 주세요')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/예: YH/), { target: { value: 'yh lt' } });
    expect(await screen.findByText('노랑정')).toBeInTheDocument();
    expect(screen.queryByText('하양정')).not.toBeInTheDocument();
  });

  it('제품명으로도 찾을 수 있다', async () => {
    render(<App />);
    await screen.findByText('조건을 골라 주세요');
    fireEvent.change(screen.getByPlaceholderText(/예: YH/), { target: { value: '빨강' } });
    expect(await screen.findByText('빨강캡슐')).toBeInTheDocument();
    expect(screen.queryByText('노랑정')).not.toBeInTheDocument();
  });

  it('모양과 색을 함께 고르면 둘 다 맞는 알약만 남는다', async () => {
    render(<App />);
    await screen.findByText('조건을 골라 주세요');
    const filters = screen.getByRole('region', { name: '알약 검색 조건' });

    fireEvent.click(within(filters).getByRole('button', { name: /하양/ }));
    expect(await screen.findByText('하양정')).toBeInTheDocument();
    expect(screen.getByText('빨강캡슐')).toBeInTheDocument();

    fireEvent.click(within(filters).getByRole('button', { name: /장방/ }));
    expect(screen.queryByText('하양정')).not.toBeInTheDocument();
    expect(screen.getByText('빨강캡슐')).toBeInTheDocument();
  });

  it('알약을 누르면 상세 정보와 의약품안전나라 링크가 열린다', async () => {
    render(<App />);
    await screen.findByText('조건을 골라 주세요');
    fireEvent.change(screen.getByPlaceholderText(/예: YH/), { target: { value: 'DW' } });
    fireEvent.click(await screen.findByText('빨강캡슐'));

    const dialog = screen.getByRole('dialog', { name: '빨강캡슐' });
    expect(within(dialog).getByText('빨강, 하양')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /의약품안전나라/ })).toHaveAttribute(
      'href', 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=c',
    );
    expect(await within(dialog).findByText(/이 약의 설명을 찾지 못했어요/)).toBeInTheDocument();
  });
});
