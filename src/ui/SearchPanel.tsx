import type { ReactNode } from 'react';
import type { PillQuery } from '../lib/search';
import { SHAPES, COLORS, FORMS, LINES } from '../lib/options';
import { ShapeIcon } from './ShapeIcon';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="fgroup">
      <legend>
        <span className="fgroup-t">{title}</span>
        {hint && <span className="fgroup-h">{hint}</span>}
      </legend>
      <div className="fchips">{children}</div>
    </fieldset>
  );
}

export function SearchPanel({ query, onChange }: { query: PillQuery; onChange: (q: PillQuery) => void }) {
  const set = (patch: Partial<PillQuery>) => onChange({ ...query, ...patch });

  return (
    <section className="filters" aria-label="알약 검색 조건">
      <label className="imprint">
        <span className="imprint-t">새겨진 글자 또는 제품명</span>
        <span className="imprint-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
          <input
            value={query.text}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="예: YH LT (앞뒤 글자는 띄어서) · 코메키나"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          {query.text && (
            <button type="button" className="imprint-x" aria-label="글자 지우기" onClick={() => set({ text: '' })}>×</button>
          )}
        </span>
      </label>

      <Group title="모양">
        {SHAPES.map((s) => (
          <button
            key={s} type="button" className="fchip fchip-shape" aria-pressed={query.shapes.includes(s)}
            onClick={() => set({ shapes: toggle(query.shapes, s) })}
          >
            <ShapeIcon shape={s} />
            <span>{s.replace(/형$/, '')}</span>
          </button>
        ))}
      </Group>

      <Group title="색상" hint="보이는 색을 모두 골라요">
        {COLORS.map((c) => (
          <button
            key={c.name} type="button" className="fchip fchip-color" aria-pressed={query.colors.includes(c.name)}
            onClick={() => set({ colors: toggle(query.colors, c.name) })}
          >
            <i className={`swatch${c.name === '투명' ? ' swatch-clear' : ''}`} style={{ background: c.name === '투명' ? undefined : c.hex }} />
            <span>{c.name}</span>
          </button>
        ))}
      </Group>

      <Group title="제형">
        {FORMS.map((f) => (
          <button
            key={f} type="button" className="fchip" aria-pressed={query.forms.includes(f)}
            onClick={() => set({ forms: toggle(query.forms, f) })}
          >
            {f}
          </button>
        ))}
      </Group>

      <Group title="분할선" hint="알약을 쪼개는 홈">
        {LINES.map((l) => (
          <button
            key={l.value} type="button" className="fchip" aria-pressed={query.lines.includes(l.value)}
            onClick={() => set({ lines: toggle(query.lines, l.value) })}
          >
            {l.label}
          </button>
        ))}
      </Group>
    </section>
  );
}
