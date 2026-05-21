'use client';

import React, { useState, useMemo } from 'react';
import type { Theme, LayoutType, DensityType, NavId, TabId, Plan } from './types';
import { PLANS, RECIPES, RX, SLOT_DEFS, TARGETS, dayTotals, slotsForPlan } from './data';
import { Icon } from './icons';
import { Sidebar, Chip } from './shared';
import { PlanSwitcher, RecipeLibrary, GridLayout, StackLayout, SplitLayout } from './planner';
import { CalendarView } from './calendar';

export function MealPlannerApp() {
  const [theme, setTheme]         = useState<Theme>('dark');
  const [nav, setNav]             = useState<NavId>('planner');
  const [tab, setTab]             = useState<TabId>('planner');
  const [collapsed, setCollapsed] = useState(false);
  const [activePlanId, setActivePlanId] = useState('p1');
  const [plans, setPlans]         = useState<Plan[]>(PLANS);
  const [layout, setLayout]       = useState<LayoutType>('grid');
  const [density, setDensity]     = useState<DensityType>('regular');
  const [showMacros, setShowMacros]   = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showAi, setShowAi]       = useState(false);

  const plan = plans.find(p => p.id === activePlanId)!;

  const onUpdate = (dayIdx: number, slotKey: string, recipeId: string | null) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== activePlanId) return p;
      const sched = { ...p.schedule };
      const day = { ...(sched['d' + dayIdx] || {}) };
      if (recipeId === null) delete day[slotKey];
      else day[slotKey] = recipeId;
      sched['d' + dayIdx] = day;
      return { ...p, schedule: sched };
    }));
  };

  const onAutofill = () => {
    setPlans(prev => prev.map(p => {
      if (p.id !== activePlanId) return p;
      const sched = { ...p.schedule };
      const slots = slotsForPlan(p);
      for (let i = 0; i < p.days; i++) {
        const day = { ...(sched['d' + i] || {}) };
        slots.forEach(s => {
          if (!day[s.key]) {
            const candidates = RECIPES;
            day[s.key] = candidates[Math.floor(Math.random() * candidates.length)].id;
          }
        });
        sched['d' + i] = day;
      }
      return { ...p, schedule: sched };
    }));
    setShowAi(true);
    setTimeout(() => setShowAi(false), 2200);
  };

  const weekTotals = useMemo(() => {
    let kcal = 0, p = 0, c = 0, f = 0;
    for (let i = 0; i < plan.days; i++) {
      const t = dayTotals(plan, i);
      kcal += t.kcal; p += t.p; c += t.c; f += t.f;
    }
    return { kcal, p, c, f };
  }, [plan]);

  const LAYOUT_OPTIONS = [
    { id: 'grid'  as LayoutType, label: 'Cuadrícula', icon: 'panel'   },
    { id: 'stack' as LayoutType, label: 'Apiladas',   icon: 'layers'  },
    { id: 'split' as LayoutType, label: 'Dividida',   icon: 'recipes' },
  ];

  return (
    <div
      data-theme={theme}
      className="mp-root"
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--mp-bg)' }}
    >
      <Sidebar
        active={nav}
        onNav={setNav}
        theme={theme}
        onTheme={setTheme}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* ── Header ── */}
        <header style={{ padding: '22px 32px 16px', borderBottom: '1px solid var(--mp-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(244,123,92,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="calendar" size={15} color="var(--mp-coral)" />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mp-coral)' }}>
                  Planificador de comidas
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--mp-fg)', letterSpacing: '-0.015em', lineHeight: 1.1 }}>
                Planes de Comidas
              </div>
              <div style={{ fontSize: 13, color: 'var(--mp-fg3)', marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
                Crea planes reutilizables, prográmalos en tu calendario y deja que la IA balancee tus macros.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onAutofill}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9,
                  background: 'linear-gradient(135deg, rgba(244,123,92,0.18), rgba(212,160,23,0.18))',
                  border: '1px solid rgba(244,123,92,0.35)', color: 'var(--mp-coral)',
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Icon name="sparkle" size={15} color="var(--mp-coral)" /> Generar con IA
              </button>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 9,
                background: 'var(--mp-coral)', border: 'none', color: '#1C1A17',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(244,123,92,0.3)',
              }}>
                <Icon name="plus" size={15} color="#1C1A17" strokeWidth={2.2} /> Crear plan
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, marginTop: 18, padding: 4,
            background: 'var(--mp-card-soft)', borderRadius: 10, width: 'fit-content',
            border: '1px solid var(--mp-border)',
          }}>
            {([
              { id: 'planner'  as TabId, label: 'Planificador',       icon: 'edit'     },
              { id: 'calendar' as TabId, label: 'Vista de Calendario', icon: 'calendar' },
            ]).map(x => (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 7, border: 'none',
                  background: tab === x.id ? 'var(--mp-card)' : 'transparent',
                  color: tab === x.id ? 'var(--mp-fg)' : 'var(--mp-fg3)',
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: tab === x.id ? 600 : 500,
                  cursor: 'pointer', boxShadow: tab === x.id ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 150ms',
                }}
              >
                <Icon name={x.icon} size={14} color={tab === x.id ? 'var(--mp-coral)' : 'var(--mp-fg4)'} />
                {x.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 32px' }}>
          {tab === 'planner' ? (
            <>
              {/* Plan switcher */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mp-fg3)', letterSpacing: '0.04em' }}>
                  {plans.length} planes guardados
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <PlanSwitcher plans={plans} activeId={activePlanId} onPick={setActivePlanId} onCreate={() => {}} />
              </div>

              {/* Active plan header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18,
                padding: '18px 20px', background: 'var(--mp-card-soft)', border: '1px solid var(--mp-border)',
                borderRadius: 12, borderLeft: `3px solid ${plan.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--mp-fg)', letterSpacing: '-0.01em' }}>
                        {plan.name}
                      </div>
                      {plan.public && <Chip color="gold" size="sm">Público</Chip>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mp-fg3)', marginTop: 3 }}>
                      {plan.days} días · {plan.meals} comidas/día · objetivo {plan.kcal} kcal
                    </div>
                  </div>
                </div>

                {/* Layout switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    display: 'flex', gap: 2, padding: 3,
                    background: 'var(--mp-bg)', border: '1px solid var(--mp-border)', borderRadius: 8,
                  }}>
                    {LAYOUT_OPTIONS.map(L => {
                      const a = layout === L.id;
                      return (
                        <button
                          key={L.id}
                          onClick={() => setLayout(L.id)}
                          title={L.label}
                          style={{
                            padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: a ? 'var(--mp-card)' : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 5,
                            color: a ? 'var(--mp-coral)' : 'var(--mp-fg3)',
                            fontSize: 11, fontWeight: 600,
                          }}
                        >
                          <Icon name={L.icon} size={12} color={a ? 'var(--mp-coral)' : 'var(--mp-fg3)'} />
                          {L.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    title="Más"
                    style={{
                      width: 32, height: 32, borderRadius: 7,
                      border: '1px solid var(--mp-border)', background: 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name="more" size={14} color="var(--mp-fg3)" />
                  </button>
                </div>
              </div>

              {/* Weekly macros strip */}
              {showMacros && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr repeat(4, minmax(120px, 160px))', gap: 14,
                  padding: '14px 18px', background: 'var(--mp-card)', border: '1px solid var(--mp-border)',
                  borderRadius: 12, marginBottom: 20,
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mp-fg4)', marginBottom: 4 }}>
                      Resumen semanal
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mp-fg3)' }}>
                      Promedio diario · {Math.round(weekTotals.kcal / plan.days)} kcal
                    </div>
                  </div>
                  {[
                    { label: 'Calorías', v: weekTotals.kcal, t: plan.kcal * plan.days, unit: '',  c: 'var(--mp-coral)' },
                    { label: 'Proteína', v: weekTotals.p,    t: TARGETS.p * plan.days, unit: 'g', c: 'var(--mp-coral)' },
                    { label: 'Carbos',   v: weekTotals.c,    t: TARGETS.c * plan.days, unit: 'g', c: 'var(--mp-gold)'  },
                    { label: 'Grasas',   v: weekTotals.f,    t: TARGETS.f * plan.days, unit: 'g', c: 'var(--mp-sage)'  },
                  ].map(m => {
                    const pct = Math.min(1, m.v / m.t);
                    return (
                      <div key={m.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mp-fg4)' }}>{m.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 5 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--mp-fg)' }}>
                            {m.v.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--mp-fg3)' }}>{m.unit} / {m.t.toLocaleString()}{m.unit}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--mp-track)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: (pct * 100) + '%', height: '100%', background: m.c, transition: 'width 600ms var(--mp-ease)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Planner body */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: showLibrary ? '300px 1fr' : '1fr',
                gap: 18, alignItems: 'start',
              }}>
                {showLibrary && (
                  <div style={{
                    background: 'var(--mp-card)', border: '1px solid var(--mp-border)', borderRadius: 12, padding: 16,
                    height: 'calc(100vh - 280px)', position: 'sticky', top: 0,
                  }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--mp-fg)' }}>Recetas</div>
                      <div style={{ fontSize: 11, color: 'var(--mp-fg3)' }}>Arrastra a un slot del plan</div>
                    </div>
                    <div style={{ height: 'calc(100% - 50px)' }}>
                      <RecipeLibrary onDragStart={() => {}} dense={density === 'compact'} />
                    </div>
                  </div>
                )}
                <div style={{ overflowX: layout === 'grid' ? 'auto' : 'visible' }}>
                  {layout === 'grid'  && <GridLayout  plan={plan} onUpdate={onUpdate} density={density} />}
                  {layout === 'stack' && <StackLayout plan={plan} onUpdate={onUpdate} />}
                  {layout === 'split' && <SplitLayout plan={plan} onUpdate={onUpdate} />}
                </div>
              </div>
            </>
          ) : (
            <CalendarView plans={plans} />
          )}
        </div>
      </main>

      {/* AI toast */}
      {showAi && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 18px', background: 'var(--mp-card)', border: '1px solid var(--mp-coral)',
          borderRadius: 99, boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 1000,
          fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--mp-fg)',
        }}>
          <Icon name="sparkle" size={16} color="var(--mp-coral)" />
          <strong>IA:</strong> Plan generado balanceando proteína y calorías.
        </div>
      )}
    </div>
  );
}
