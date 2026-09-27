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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(dataset))));
});
afterEach(() => vi.unstubAllGlobals());

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
  });
});
