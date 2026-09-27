import { render, screen, fireEvent, within } from '@testing-library/react';
import type { PermitInfo, PermitResponse } from '../types';
import { PermitView } from './PermitView';

const permit: PermitInfo = {
  seq: '201706199', name: '코메키나캡슐', company: '(주)대웅제약', otc: '일반의약품', cancel: null,
  efficacy: [{ title: '', blocks: [{ kind: 'text', text: '코감기(급성비염)에 의한 증상의 완화' }] }],
  dosage: [{ title: '', blocks: [{ kind: 'text', text: '성인(15세 이상) : 1회 1캡슐씩 1일 3회' }] }],
  cautions: [
    { title: '1. 경고', blocks: [{ kind: 'text', text: '중증 피부 이상반응이 나타날 수 있다.' }] },
    { title: '2. 다음과 같은 사람은 이 약을 복용하지 말 것', blocks: [{ kind: 'table', rows: [[{ text: '가' }, { text: '나', colSpan: 2 }]] }] },
  ],
  totalContent: '이 약 1캡슐 중',
  ingredients: [{ name: '메퀴타진', amount: '1.33 밀리그램', note: '' }],
  additives: ['유당수화물'],
  storage: '기밀용기, 실온보관',
  validTerm: '제조일로부터 34 개월',
};

function mockPermit(...responses: (PermitResponse | number)[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockImplementationOnce(async () => (typeof r === 'number' ? new Response('', { status: r }) : new Response(JSON.stringify(r))));
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('PermitView', () => {
  it('효능·용법은 펼쳐서, 주의사항·성분은 접어서 공식 문구를 보여준다', async () => {
    const fetchMock = mockPermit({ found: true, permit });
    render(<PermitView seq="201706199" />);
    expect(screen.getByText(/허가정보를 불러오는 중/)).toBeInTheDocument();

    expect(await screen.findByText('코감기(급성비염)에 의한 증상의 완화')).toBeVisible();
    expect(screen.getByText('성인(15세 이상) : 1회 1캡슐씩 1일 3회')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith('/api/permit/201706199', expect.anything());

    const cautions = screen.getByText('사용상의 주의사항').closest('details')!;
    expect(cautions).not.toHaveAttribute('open');
    expect(within(cautions).getByText('2개 항목')).toBeInTheDocument();
    expect(within(cautions).getByText('1. 경고')).toBeInTheDocument();
    expect(within(cautions).getByText('나')).toHaveAttribute('colspan', '2');

    expect(screen.getByText('메퀴타진')).toBeInTheDocument();
    expect(screen.getByText('제조일로부터 34 개월')).toBeInTheDocument();
    expect(screen.getByText(/공식 문구 그대로/)).toBeInTheDocument();
  });

  it('허가정보에 없는 약이면 안내를 보여준다', async () => {
    mockPermit({ found: false });
    render(<PermitView seq="200808877" />);
    expect(await screen.findByText(/이 약의 설명을 찾지 못했어요/)).toBeInTheDocument();
  });

  it('허가가 취소·취하된 약은 경고한다', async () => {
    mockPermit({ found: true, permit: { ...permit, cancel: '취하' } });
    render(<PermitView seq="201706199" />);
    expect(await screen.findByText(/허가 상태가 ‘취하’예요/)).toBeInTheDocument();
  });

  it('불러오기에 실패하면 다시 시도할 수 있다', async () => {
    mockPermit(502, { found: true, permit });
    render(<PermitView seq="201706199" />);
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('코감기(급성비염)에 의한 증상의 완화')).toBeInTheDocument();
  });
});
