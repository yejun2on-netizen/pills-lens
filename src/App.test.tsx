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

beforeEach(() => {
  photoResponse = () => new Response(JSON.stringify({ text: 'DW', shape: '장방형', colors: ['빨강'], form: '경질캡슐', line: '없음' }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url) === '/api/photo') return photoResponse();
    return new Response(JSON.stringify(String(url).startsWith('/api/permit/') ? { found: false } : dataset));
  }));
  // jsdom에는 사진 미리보기용 URL API가 없다
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

function takePhoto(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(['x'], 'pill.jpg', { type: 'image/jpeg' })] } });
}

describe('App — 사진으로 찾기', () => {
  it('사진을 읽어 글자·모양·제형을 채우고 결과를 보여준다 (색은 넣지 않음)', async () => {
    const { container } = render(<App />);
    await screen.findByText('조건을 골라 주세요');
    takePhoto(container);

    expect(await screen.findByText('사진에서 읽은 내용으로 찾았어요')).toBeInTheDocument();
    expect(screen.getByText('빨강캡슐')).toBeInTheDocument();
    expect(screen.queryByText('노랑정')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/예: YH/)).toHaveValue('DW');
    const filters = screen.getByRole('region', { name: '알약 검색 조건' });
    expect(within(filters).getByRole('button', { name: /장방/ })).toHaveAttribute('aria-pressed', 'true');
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
