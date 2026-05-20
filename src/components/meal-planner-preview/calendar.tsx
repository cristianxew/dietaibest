'use client';

import React, { useState } from 'react';
import type { Plan } from './types';
import { MONTH_NAMES_ES_FULL } from './data';
import { Icon } from './icons';

interface CalendarViewProps {
  plans: Plan[];
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function navBtn(): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    background: 'var(--mp-card-soft)', border: '1px solid var(--mp-border)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

export function CalendarView({ plans }: CalendarViewProps) {
  const [month, setMonth] = useState({ y: 2026, m: 4 }); // May 2026
  const [scheduled, setScheduled] = useState<Record<string, string>>({
    '2026-05-04': 'p1', '2026-05-05': 'p1', '2026-05-06': 'p1',
    '2026-05-07': 'p1', '2026-05-08': 'p1',
    '2026-05-11': 'p2', '2026-05-12': 'p2', '2026-05-13': 'p2',
    '2026-05-18': 'p3', '2026-05-19': 'p3', '2026-05-20': 'p3', '2026-05-21': 'p3',
  });
  const [draggedPlan, setDraggedPlan] = useState<string | null>(null);

  const today = new Date(2026, 4, 7);
  const first = new Date(month.y, month.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();

  const cells: Array<{ inMonth: boolean; date: Date }> = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ inMonth: false, date: new Date(month.y, month.m, -i) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ inMonth: true, date: new Date(month.y, month.m, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ inMonth: false, date: new Date(month.y, month.m + 1, cells.length - startWeekday - daysInMonth + 1) });
  }

  const planById = (id: string) => plans.find(p => p.id === id);

  const onDrop = (date: Date) => {
    if (!draggedPlan) return;
    const plan = planById(draggedPlan);
    if (!plan) return;
    const next = { ...scheduled };
    for (let i = 0; i < plan.days; i++) {
      const dd = new Date(date);
      dd.setDate(dd.getDate() + i);
      next[isoOf(dd)] = draggedPlan;
    }
    setScheduled(next);
    setDraggedPlan(null);
  };

  const prevMonth = () => setMonth(m => ({ y: m.m === 0 ? m.y - 1 : m.y, m: (m.m + 11) % 12 }));
  const nextMonth = () => setMonth(m => ({ y: m.m === 11 ? m.y + 1 : m.y, m: (m.m + 1) % 12 }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Plans list */}
      <div style={{ background: 'var(--mp-card)', border: '1px solid var(--mp-border)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--mp-fg)', marginBottom: 6 }}>
          Tus planes
        </div>
        <div style={{ fontSize: 12, color: 'var(--mp-fg3)', marginBottom: 14, lineHeight: 1.5 }}>
          Arrastra a una fecha para programar.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDraggedPlan(p.id)}
              onDragEnd={() => setDraggedPlan(null)}
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--mp-card-soft)', border: '1px solid var(--mp-border)',
                cursor: 'grab', display: 'flex', alignItems: 'center', gap: 10,
                borderLeft: `3px solid ${p.color}`, transition: 'all 150ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.borderColor = p.color;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--mp-border)';
              }}
            >
              <Icon name="drag" size={14} color="var(--mp-fg4)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mp-fg)', fontFamily: 'var(--font-display)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--mp-fg3)', marginTop: 1 }}>{p.days} días · {p.kcal} kcal</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: 'var(--mp-card)', border: '1px solid var(--mp-border)', borderRadius: 14, padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={prevMonth} style={navBtn()}>
              <Icon name="chevL" size={16} color="var(--mp-fg2)" />
            </button>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--mp-fg)' }}>
                {MONTH_NAMES_ES_FULL[month.m]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mp-fg3)' }}>{month.y}</div>
            </div>
            <button onClick={nextMonth} style={navBtn()}>
              <Icon name="chevR" size={16} color="var(--mp-fg2)" />
            </button>
          </div>
          <button
            onClick={() => setMonth({ y: 2026, m: 4 })}
            style={{
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid var(--mp-border)', background: 'transparent',
              color: 'var(--mp-fg2)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Hoy
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => (
            <div key={d} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--mp-fg4)', padding: '4px 8px' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((c, i) => {
            const iso = isoOf(c.date);
            const planId = scheduled[iso];
            const plan = planId ? planById(planId) : null;
            const isToday = c.date.getTime() === today.getTime();
            const past = c.date < today && !isToday;
            return (
              <div
                key={i}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(c.date)}
                style={{
                  minHeight: 90, padding: 8, borderRadius: 8, position: 'relative',
                  background: plan ? `${plan.color}1a` : 'transparent',
                  border: isToday
                    ? '1.5px solid var(--mp-coral)'
                    : `1px solid ${plan ? plan.color + '4d' : 'var(--mp-border)'}`,
                  opacity: c.inMonth ? (past ? 0.5 : 1) : 0.3,
                  cursor: draggedPlan ? 'copy' : 'default',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: isToday ? 16 : 14,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--mp-coral)' : (plan ? 'var(--mp-fg)' : 'var(--mp-fg3)'),
                  }}>
                    {c.date.getDate()}
                  </div>
                  {isToday && <div style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--mp-coral)' }} />}
                </div>
                {plan && (
                  <div style={{
                    marginTop: 8, padding: '4px 6px', borderRadius: 5,
                    background: plan.color, color: '#1C1A17',
                    fontSize: 10, fontWeight: 700, lineHeight: 1.2,
                  }}>
                    {plan.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 18, marginTop: 16, paddingTop: 14,
          borderTop: '1px solid var(--mp-border)', flexWrap: 'wrap',
          fontSize: 11, color: 'var(--mp-fg3)',
        }}>
          {plans.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
              <span>{p.name}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--mp-coral)' }} />
            Hoy
          </div>
        </div>
      </div>
    </div>
  );
}
