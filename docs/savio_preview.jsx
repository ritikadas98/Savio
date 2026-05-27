import React, { useState } from 'react';
import {
  Compass, Home as HomeIcon, MessageCircle, Sparkles, Target,
  Send, X, ChevronRight, Smile, Meh, Frown,
  Plus, Check, ShoppingBag, Coffee, Car, Film, Calendar,
  Shield, ArrowLeft, ArrowRight, Download, FileText, Beaker, Tag,
  Trophy
} from 'lucide-react';

// =====================================================================
// Design tokens — savio-design-system-spec.md
// Priya = Strategist avatar → blue is her identity accent throughout.
// =====================================================================
const T = {
  bg: '#E4ECE6',
  card: '#FFFFFF',
  cardSoft: '#FAFAF7',
  p: '#1A1A1A',
  s: '#5F5E5A',
  t: '#888780',
  border: 'rgba(0,0,0,0.07)',
  borderHover: 'rgba(0,0,0,0.14)',
  // Strategist (Priya)
  avPlate: '#DCEEFF', avStop: '#0C447C', avAccent: '#58B9FF',
  // Semantic accents
  yPlate: '#FCF1CC', yStop: '#854F0B', yAccent: '#F4D123',
  gPlate: '#DEF2CB', gStop: '#3B6D11', gAccent: '#B2EF82',
  rPlate: '#FFE1E1', rStop: '#791F1F', rAccent: '#FF8F8F',
};

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const inrCompact = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return inr(n);
};

// =====================================================================
// Reusable primitives
// =====================================================================
const Pill = ({ plate, stop, children, size = 'sm' }) => (
  <span
    style={{
      backgroundColor: plate, color: stop,
      padding: size === 'sm' ? '4px 10px' : '6px 12px',
      borderRadius: 999,
      fontSize: size === 'sm' ? 12 : 13,
      fontWeight: 500, lineHeight: 1.2,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const Card = ({ children, hero, style, onClick }) => (
  <div
    onClick={onClick}
    style={{
      backgroundColor: T.card,
      borderRadius: hero ? 28 : 22,
      border: `0.5px solid ${T.border}`,
      padding: hero ? '24px 22px' : '18px',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ children, special }) => (
  <div style={{
    padding: '14px 6px 4px',
    fontSize: special ? 12 : 13,
    color: special ? T.avStop : T.s,
    fontWeight: 500,
    letterSpacing: special ? 0.5 : 0,
    textTransform: special ? 'uppercase' : 'none',
  }}>
    {children}
  </div>
);

const Row = ({ label, value, last, action, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: last ? 'none' : `0.5px solid ${T.border}`,
    cursor: onClick ? 'pointer' : 'default',
  }}>
    <span style={{ fontSize: 14, color: T.s }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14, color: T.p, fontWeight: 400 }}>{value}</span>
      {action && <span style={{ fontSize: 12, color: T.avStop }}>{action}</span>}
      <ChevronRight size={14} color={T.t} />
    </div>
  </div>
);

// =====================================================================
// Status bar + Header
// =====================================================================
const StatusBar = () => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '14px 22px 8px', fontSize: 14, fontWeight: 500, color: T.p,
  }}>
    <span>9:41</span>
    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <span style={{ fontSize: 11 }}>●●●</span>
      <span style={{ fontSize: 11 }}>5G</span>
      <span style={{
        width: 22, height: 11, border: `1px solid ${T.p}`, borderRadius: 3,
        position: 'relative', display: 'inline-block',
      }}>
        <span style={{
          position: 'absolute', inset: 1, backgroundColor: T.p, borderRadius: 1.5,
          width: '85%',
        }} />
      </span>
    </span>
  </div>
);

const Header = ({ title, onAvatarTap }) => (
  <div style={{ padding: '6px 22px 18px' }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 14,
    }}>
      <span style={{ fontSize: 13, color: T.s }}>👋 Welcome in, Priya</span>
      <button
        onClick={onAvatarTap}
        style={{
          width: 32, height: 32, borderRadius: 999,
          backgroundColor: T.avPlate, color: T.avStop,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <Compass size={16} strokeWidth={2} />
      </button>
    </div>
    <h1 style={{
      fontSize: 30, fontWeight: 400, color: T.p,
      lineHeight: 1.15, letterSpacing: '-0.5px', margin: 0,
    }}>
      {title}
    </h1>
  </div>
);

// =====================================================================
// HOME
// =====================================================================
const Home = ({
  windfallDismissed, dismissWindfall, openWindfallFlow,
  ritualCompleted, openMonthlyRitual,
}) => {
  const heroPosition = 62;

  const recentTx = [
    { merchant: 'Swiggy', cat: 'Food', amount: 450, icon: Coffee, when: 'Today' },
    { merchant: 'Myntra', cat: 'Shopping', amount: 2800, icon: ShoppingBag, when: 'Yesterday' },
    { merchant: 'Uber', cat: 'Transport', amount: 220, icon: Car, when: '2 days ago' },
    { merchant: 'BookMyShow', cat: 'Entertainment', amount: 600, icon: Film, when: '3 days ago' },
  ];

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Time-sensitive: pending windfall */}
      {!windfallDismissed && (
        <Card style={{ borderColor: T.yAccent, borderWidth: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                backgroundColor: T.yPlate, color: T.yStop,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, color: T.p, fontWeight: 500, lineHeight: 1.35 }}>
                  ₹50,000 landed today — well above your usual.
                </div>
                <div style={{ fontSize: 12.5, color: T.s, marginTop: 4, lineHeight: 1.4 }}>
                  Money that breaks pattern is the easiest to spend without noticing. Want to spend 60 seconds deciding what this is for?
                </div>
              </div>
            </div>
            <button onClick={dismissWindfall} style={{
              background: 'transparent', border: 'none', color: T.t,
              cursor: 'pointer', padding: 4, marginLeft: 4, flexShrink: 0,
            }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={openWindfallFlow} style={{
              backgroundColor: T.p, color: T.card, border: 'none',
              padding: '10px 18px', borderRadius: 999, fontSize: 13,
              fontWeight: 500, cursor: 'pointer', flex: 1, fontFamily: 'inherit',
            }}>
              Allocate now
            </button>
            <button onClick={dismissWindfall} style={{
              backgroundColor: 'transparent', color: T.p,
              border: `0.5px solid ${T.borderHover}`,
              padding: '10px 18px', borderRadius: 999, fontSize: 13,
              fontWeight: 500, cursor: 'pointer', flex: 1, fontFamily: 'inherit',
            }}>
              Skip for now
            </button>
          </div>
        </Card>
      )}

      {/* Time-sensitive: monthly ritual */}
      {!ritualCompleted && (
        <Card style={{ borderColor: T.avAccent, borderWidth: 1 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.avPlate, color: T.avStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calendar size={18} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, color: T.p, fontWeight: 500, lineHeight: 1.35 }}>
                It's the 1st — your monthly check-in is ready
              </div>
              <div style={{ fontSize: 12, color: T.s, marginTop: 2 }}>
                About 90 seconds. Locks your safe-to-spend for April.
              </div>
            </div>
            <button onClick={openMonthlyRitual} style={{
              backgroundColor: T.p, color: T.card, border: 'none',
              padding: '8px 14px', borderRadius: 999, fontSize: 12.5,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              flexShrink: 0,
            }}>
              Start
            </button>
          </div>
        </Card>
      )}

      {/* Safe-to-spend HERO */}
      <Card hero>
        <div style={{ fontSize: 14, color: T.s, marginBottom: 6 }}>
          Safe to spend today
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <span style={{
            fontSize: 56, fontWeight: 500, color: T.p,
            lineHeight: 1, letterSpacing: '-1.5px',
          }}>
            ₹12,400
          </span>
          <Pill plate={T.gPlate} stop={T.gStop}>+₹420</Pill>
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{
            height: 10, borderRadius: 999,
            background: 'linear-gradient(90deg, #FF8F8F 0%, #FBAA5A 25%, #F4D123 50%, #B2EF82 75%, #58B9FF 100%)',
          }} />
          <div style={{
            position: 'absolute', top: -3, left: `${heroPosition}%`,
            transform: 'translateX(-50%)',
            width: 4, height: 16, backgroundColor: T.p, borderRadius: 2,
            boxShadow: `0 0 0 3px ${T.card}`,
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: T.t, marginBottom: 14,
        }}>
          <span>₹0</span>
          <span>17 days until salary on the 1st</span>
          <span>₹20K</span>
        </div>
        <div style={{ fontSize: 12, color: T.t }}>
          Updated just now · Refreshes at midnight
        </div>
      </Card>

      {/* Commitments on track */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 14,
            backgroundColor: T.gPlate, color: T.gStop,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Calendar size={18} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: T.p, fontWeight: 400 }}>
              Commitments on track
            </div>
            <div style={{ fontSize: 12.5, color: T.s, marginTop: 2 }}>
              2 due this week
            </div>
          </div>
          <div style={{
            fontSize: 26, color: T.p, fontWeight: 500, lineHeight: 1,
            display: 'flex', alignItems: 'baseline',
          }}>
            8<span style={{ fontSize: 16, color: T.s, fontWeight: 400 }}>/10</span>
          </div>
        </div>
      </Card>

      {/* Manual categorization — tiny banner, documented-fake */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px', backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: 16, border: `0.5px solid ${T.border}`,
      }}>
        <Tag size={13} color={T.s} />
        <span style={{ fontSize: 12.5, color: T.s, flex: 1 }}>
          12 transactions need categorization
        </span>
        <span style={{ fontSize: 10, color: T.t, fontStyle: 'italic' }}>
          coming in V2
        </span>
      </div>

      {/* For you today — single contextual insight */}
      <div style={{ padding: '12px 6px 4px', fontSize: 13, color: T.s, fontWeight: 500 }}>
        For you today
      </div>
      <Card onClick={() => {}}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999, flexShrink: 0,
            backgroundColor: T.avPlate, color: T.avStop,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={15} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.p, lineHeight: 1.4 }}>
              Your phone fund is on track to hit ₹35,000 by August.
            </div>
            <div style={{ fontSize: 12, color: T.t, marginTop: 4 }}>
              4 more monthly contributions to go
            </div>
          </div>
          <ChevronRight size={16} color={T.t} style={{ marginTop: 6 }} />
        </div>
      </Card>

      {/* Recent transactions */}
      <div style={{
        padding: '12px 6px 4px', fontSize: 13, color: T.s, fontWeight: 500,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Recent transactions</span>
        <span style={{ color: T.avStop, fontSize: 12 }}>See all →</span>
      </div>
      <Card style={{ padding: '6px 4px' }}>
        {recentTx.map((tx, i) => {
          const Icon = tx.icon;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              borderBottom: i < recentTx.length - 1 ? `0.5px solid ${T.border}` : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                backgroundColor: '#F4F4F2', color: T.s,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={14} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: T.p }}>{tx.merchant}</div>
                <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>
                  {tx.cat} · {tx.when}
                </div>
              </div>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>
                −{inr(tx.amount)}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// =====================================================================
// CHAT
// =====================================================================
const Chat = () => {
  const chips = ['Am I on track?', "What's my regret rate?", 'Should I buy this?', 'Show my spend'];
  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
        <div style={{
          backgroundColor: T.avPlate, color: T.avStop,
          padding: '10px 14px', borderRadius: '18px 18px 4px 18px',
          fontSize: 14, lineHeight: 1.4,
        }}>
          Can I afford a ₹5,000 watch?
        </div>
        <div style={{ fontSize: 10.5, color: T.t, textAlign: 'right', marginTop: 3 }}>
          You · just now
        </div>
      </div>

      <div style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
        <Card style={{ borderRadius: '4px 22px 22px 22px', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)',
            }} />
            <span style={{ fontSize: 12.5, color: T.p, fontWeight: 500 }}>Savio</span>
            <Pill plate={T.gPlate} stop={T.gStop}>
              <Check size={10} strokeWidth={3} /> Verified
            </Pill>
          </div>

          <div style={{ fontSize: 15, color: T.p, lineHeight: 1.45, fontWeight: 500, marginBottom: 10 }}>
            Yes — it fits comfortably. The numbers suggest GREEN.
          </div>
          <div style={{ fontSize: 13.5, color: T.s, lineHeight: 1.5, marginBottom: 12 }}>
            ₹5,000 leaves you ₹7,400 of safe-to-spend for the rest of the month — about ₹435/day across the remaining 17 days. Your phone fund and goal contributions stay untouched.
          </div>

          <div style={{
            backgroundColor: T.cardSoft, borderRadius: 14, padding: 12, marginBottom: 12,
          }}>
            <div style={{ fontSize: 11.5, color: T.t, fontWeight: 500, marginBottom: 6, letterSpacing: 0.3 }}>
              Tradeoffs
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: T.p, lineHeight: 1.55 }}>
              <li>Daily budget drops from ₹715 to ₹435 — still above your ₹300 floor</li>
              <li>Buffer stays at ₹2,26,800 — above your ₹1L rule</li>
            </ul>
          </div>

          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            padding: '10px 12px', borderRadius: 14, backgroundColor: T.avPlate,
          }}>
            <Target size={14} color={T.avStop} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: T.avStop, fontWeight: 500, marginBottom: 2 }}>
                Best next step
              </div>
              <div style={{ fontSize: 12.5, color: T.avStop, lineHeight: 1.4 }}>
                Sit with it 48 hours per your impulse rule. If you still want it Tuesday, go ahead.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: T.t, textAlign: 'right' }}>
            Save this decision →
          </div>
        </Card>
        <div style={{ fontSize: 10.5, color: T.t, marginTop: 3 }}>
          Savio · just now
        </div>
      </div>

      {/* User message 2 — triggers progressive disclosure */}
      <div style={{ alignSelf: 'flex-end', maxWidth: '78%', marginTop: 6 }}>
        <div style={{
          backgroundColor: T.avPlate, color: T.avStop,
          padding: '10px 14px', borderRadius: '18px 18px 4px 18px',
          fontSize: 14, lineHeight: 1.4,
        }}>
          Thinking of pausing my Goa savings this month — can I?
        </div>
        <div style={{ fontSize: 10.5, color: T.t, textAlign: 'right', marginTop: 3 }}>
          You · 2m ago
        </div>
      </div>

      {/* Savio asks before guessing — progressive disclosure in action */}
      <div style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
        <Card style={{ borderRadius: '4px 22px 22px 22px', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 999,
              background: 'linear-gradient(135deg, #FF8F8F, #F4D123, #B2EF82, #58B9FF)',
            }} />
            <span style={{ fontSize: 12.5, color: T.p, fontWeight: 500 }}>Savio</span>
          </div>

          <div style={{ fontSize: 13.5, color: T.p, lineHeight: 1.5, marginBottom: 12 }}>
            Quick check before I run the numbers — is this a cashflow thing for this month, or are you reconsidering the trip itself? It changes how I'd think about it.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Cashflow this month is tight',
              'Reconsidering the Goa trip',
              'Something else — let me type',
            ].map(t => (
              <button key={t} style={{
                backgroundColor: T.card, color: T.p,
                border: `0.5px solid ${T.borderHover}`,
                padding: '10px 14px', borderRadius: 14, fontSize: 12.5,
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 12, padding: '8px 10px', borderRadius: 10,
            backgroundColor: T.cardSoft, fontSize: 10.5, color: T.s,
            lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <Sparkles size={11} color={T.s} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Your answer gets added to how I think about you — Savio asks instead of guessing.</span>
          </div>
        </Card>
        <div style={{ fontSize: 10.5, color: T.t, marginTop: 3 }}>
          Savio · just now
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
        {chips.map(c => (
          <button key={c} style={{
            backgroundColor: T.card, color: T.p,
            border: `0.5px solid ${T.borderHover}`,
            padding: '8px 14px', borderRadius: 999, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, backgroundColor: T.bg }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          backgroundColor: T.card, border: `0.5px solid ${T.border}`,
          borderRadius: 999, padding: '6px 6px 6px 18px',
        }}>
          <input
            placeholder="Ask Savio anything…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 14, backgroundColor: 'transparent',
              fontFamily: 'inherit', color: T.p,
            }}
          />
          <button style={{
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: T.p, color: T.card, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Send size={14} strokeWidth={2} />
          </button>
        </div>
        <div style={{ fontSize: 10, color: T.t, textAlign: 'center', marginTop: 6 }}>
          Savio is decision-support, not a financial advisor. Verify important calculations.
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// REFLECT
// =====================================================================
const Reflect = ({ reflections, label }) => {
  const items = [
    { id: 't1', merchant: 'Myntra', amount: 2800, cat: 'Shopping', when: 'Yesterday', icon: ShoppingBag },
    { id: 't2', merchant: 'Zomato Dine-In', amount: 1450, cat: 'Dining', when: '3 days ago', icon: Coffee },
    { id: 't3', merchant: 'BookMyShow', amount: 1200, cat: 'Entertainment', when: '4 days ago', icon: Film },
    { id: 't4', merchant: 'Amazon', amount: 3499, cat: 'Shopping', when: '6 days ago', icon: ShoppingBag },
  ];

  const labels = {
    glad: { icon: Smile, plate: T.gPlate, stop: T.gStop, label: 'Glad' },
    neutral: { icon: Meh, plate: '#F4F4F2', stop: T.s, label: 'Neutral' },
    regret: { icon: Frown, plate: T.rPlate, stop: T.rStop, label: 'Regret' },
  };

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '0 6px 8px' }}>
        <p style={{ fontSize: 14, color: T.s, lineHeight: 1.5, margin: 0 }}>
          Tap how each felt — labels help Savio understand your patterns over time.
        </p>
      </div>

      {items.map(item => {
        const Icon = item.icon;
        const reflected = reflections[item.id];
        const labelMeta = reflected ? labels[reflected] : null;
        const LabelIcon = labelMeta?.icon;

        return (
          <Card key={item.id} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: reflected ? 0 : 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 999,
                backgroundColor: '#F4F4F2', color: T.s,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} strokeWidth={2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, color: T.p, fontWeight: 500 }}>{item.merchant}</div>
                <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>
                  {item.cat} · {item.when}
                </div>
              </div>
              <div style={{ fontSize: 15, color: T.p, fontWeight: 500 }}>
                {inr(item.amount)}
              </div>
            </div>

            {reflected ? (
              <div style={{
                marginTop: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Pill plate={labelMeta.plate} stop={labelMeta.stop}>
                  <LabelIcon size={12} strokeWidth={2} /> {labelMeta.label}
                </Pill>
                <button onClick={() => label(item.id, null)} style={{
                  background: 'transparent', border: 'none', color: T.t,
                  fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Undo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(labels).map(([key, meta]) => {
                  const MetaIcon = meta.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => label(item.id, key)}
                      style={{
                        flex: 1, padding: '9px 8px',
                        border: `0.5px solid ${T.border}`,
                        backgroundColor: T.card,
                        borderRadius: 12, fontSize: 12.5,
                        color: T.p, cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      <MetaIcon size={14} strokeWidth={2} color={meta.stop} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      <div style={{ padding: '12px 16px', fontSize: 12, color: T.t, textAlign: 'center' }}>
        Reflections train Savio's regret-rate signal. No reminders, no nags.
      </div>
    </div>
  );
};

// =====================================================================
// GOALS — milestone callouts folded in
// =====================================================================
const Goals = () => {
  const goals = [
    {
      label: 'Phone fund', target: 35000, current: 8000,
      contribution: 4000, dueLabel: 'Aug 2026',
      status: 'On track', statusPlate: T.gPlate, statusStop: T.gStop,
      milestone: { icon: Shield, text: 'Declined AirPods — protected this by ~6 months' },
    },
    {
      label: 'Emergency fund', target: 300000, current: 184000,
      contribution: 2000, dueLabel: 'Mar 2027',
      status: 'On track', statusPlate: T.gPlate, statusStop: T.gStop,
      milestone: { icon: Trophy, text: '4 months hitting your savings target' },
    },
    {
      label: 'Goa trip', target: 25000, current: 3000,
      contribution: 3000, dueLabel: 'Dec 2026',
      status: 'Behind 1 month', statusPlate: T.yPlate, statusStop: T.yStop,
      milestone: null,
    },
  ];

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {goals.map(g => {
        const pct = Math.round((g.current / g.target) * 100);
        const MilestoneIcon = g.milestone?.icon;
        return (
          <Card key={g.label} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: T.p, fontWeight: 500 }}>{g.label}</div>
                <div style={{ fontSize: 12, color: T.t, marginTop: 3 }}>
                  Target {g.dueLabel} · {inr(g.contribution)}/month
                </div>
              </div>
              <Pill plate={g.statusPlate} stop={g.statusStop}>{g.status}</Pill>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 22, color: T.p, fontWeight: 500, letterSpacing: '-0.5px' }}>
                {inrCompact(g.current)}
              </span>
              <span style={{ fontSize: 13, color: T.s }}>
                of {inrCompact(g.target)} · <span style={{ color: T.p, fontWeight: 500 }}>{pct}%</span>
              </span>
            </div>

            <div style={{
              height: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.05)',
              overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                backgroundColor: T.avAccent, borderRadius: 999,
              }} />
            </div>

            {g.milestone && (
              <div style={{
                marginTop: 14, padding: '10px 12px',
                backgroundColor: T.gPlate, borderRadius: 14,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <MilestoneIcon size={14} color={T.gStop} />
                <span style={{ fontSize: 12.5, color: T.gStop, fontWeight: 500 }}>
                  {g.milestone.text}
                </span>
              </div>
            )}
          </Card>
        );
      })}

      <button style={{
        marginTop: 10, padding: '14px 20px',
        backgroundColor: 'transparent',
        border: `0.5px dashed ${T.borderHover}`,
        borderRadius: 22, color: T.p, fontSize: 14, fontWeight: 500,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6, fontFamily: 'inherit',
      }}>
        <Plus size={15} strokeWidth={2} />
        Add a goal
      </button>
    </div>
  );
};

// =====================================================================
// PROFILE — Framing B (settings + reviewer console openly combined)
// =====================================================================
const Profile = ({ onClose, openMonthlyRitual }) => {
  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <div style={{
        padding: '14px 22px', display: 'flex',
        alignItems: 'center', gap: 14,
      }}>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, color: T.p, display: 'flex', alignItems: 'center',
        }}>
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontSize: 17, color: T.p, fontWeight: 500 }}>Profile</span>
      </div>

      {/* Identity hero */}
      <div style={{ padding: '6px 22px 22px', textAlign: 'center' }}>
        <div style={{
          width: 84, height: 84, borderRadius: 999,
          backgroundColor: T.avPlate, color: T.avStop,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Compass size={36} strokeWidth={1.7} />
        </div>
        <div style={{ fontSize: 22, color: T.p, fontWeight: 500, marginBottom: 8 }}>
          Priya Sharma
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pill plate={T.avPlate} stop={T.avStop}>The Strategist</Pill>
          <Pill plate="#F4F4F2" stop={T.s}>Supporting dependents</Pill>
        </div>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        {/* Your finances */}
        <SectionHeader>Your finances</SectionHeader>
        <Card style={{ padding: 0 }}>
          <Row label="Monthly income" value="₹68,500 net" onClick={() => {}} />
          <Row label="Anchor date" value="1st of month" onClick={() => {}} />
          <Row label="Primary bank" value="HDFC" last onClick={() => {}} />
        </Card>

        {/* Your rules */}
        <SectionHeader>Your rules</SectionHeader>
        <Card style={{ padding: 0 }}>
          <Row label="Buffer floor" value="₹1,00,000" onClick={() => {}} />
          <Row label="Impulse purchase wait" value="48 hrs over ₹3K" onClick={() => {}} />
          <Row label="Avatar" value="Strategist" last action="Change" onClick={() => {}} />
        </Card>

        {/* Disclaimer */}
        <SectionHeader>Disclaimer</SectionHeader>
        <Card>
          <div style={{ fontSize: 12.5, color: T.s, lineHeight: 1.55 }}>
            Savio helps you think about your money. It is not a financial advisor, investment advisor, or registered financial planner. All numerical estimates are AI-generated and may contain errors. Verify all important calculations independently.
          </div>
          <div style={{ fontSize: 10.5, color: T.t, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.border}` }}>
            Acknowledged on 12 Apr 2026
          </div>
        </Card>

        {/* REVIEWER CONSOLE — Framing B, deliberately surfaced */}
        <div style={{
          marginTop: 24, padding: '14px 16px',
          backgroundColor: T.avPlate, borderRadius: 18,
        }}>
          <div style={{
            fontSize: 11, color: T.avStop, fontWeight: 500,
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
          }}>
            For reviewers
          </div>
          <div style={{ fontSize: 12, color: T.avStop, lineHeight: 1.5, opacity: 0.85 }}>
            This is a portfolio demo running on a single seeded user (Priya). The affordances below let you experience parts of the product that are normally event-triggered.
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <Card style={{ padding: 0 }}>
            <ReviewerRow
              icon={Calendar}
              label="Try the monthly ritual"
              sublabel="See the 5-screen check-in flow"
              onClick={openMonthlyRitual}
            />
            <ReviewerRow
              icon={Download}
              label="View seed data CSV"
              sublabel="Priya's 600 transactions"
              onClick={() => {}}
            />
            <ReviewerRow
              icon={FileText}
              label="Read the case study"
              sublabel="What I built and why"
              onClick={() => {}}
            />
            <ReviewerRow
              icon={Beaker}
              label="View divergence tests"
              sublabel="The 5 architectural changes from team v1"
              last
              onClick={() => {}}
            />
          </Card>
        </div>

        {/* About */}
        <SectionHeader>About Savio</SectionHeader>
        <Card style={{ padding: 0 }}>
          <Row label="Version" value="0.2.0 (Demo MVP)" last />
        </Card>

        <div style={{
          textAlign: 'center', padding: '24px 0 12px',
          fontSize: 11, color: T.t,
        }}>
          Built solo as the Savio rebuild — April 2026
        </div>
      </div>
    </div>
  );
};

const ReviewerRow = ({ icon: Icon, label, sublabel, onClick, last }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', cursor: 'pointer',
    borderBottom: last ? 'none' : `0.5px solid ${T.border}`,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 999, flexShrink: 0,
      backgroundColor: T.avPlate, color: T.avStop,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={15} strokeWidth={2} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>{sublabel}</div>
    </div>
    <ChevronRight size={14} color={T.t} />
  </div>
);

// =====================================================================
// WINDFALL ALLOCATION FLOW — 2 screens
// =====================================================================
const WindfallFlow = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(0);
  const [allocations, setAllocations] = useState({
    emergency: 20000,
    phone: 15000,
    loan: 10000,
    free: 5000,
  });
  const TOTAL = 50000;
  const sum = Object.values(allocations).reduce((a, b) => a + b, 0);

  const update = (key, value) => {
    // simple slider: rebalance free spend to keep total ≈ TOTAL
    const otherKeys = Object.keys(allocations).filter(k => k !== key && k !== 'free');
    const otherSum = otherKeys.reduce((a, k) => a + allocations[k], 0);
    const newFree = TOTAL - value - (key === 'free' ? 0 : otherSum);
    if (key === 'free') {
      setAllocations(a => ({ ...a, free: Math.max(0, value) }));
    } else {
      setAllocations(a => ({ ...a, [key]: value, free: Math.max(0, newFree) }));
    }
  };

  const buckets = [
    { key: 'emergency', label: 'Emergency fund', sub: 'Gap to your 6-month target', plate: T.gPlate, stop: T.gStop, max: 30000 },
    { key: 'phone', label: 'Phone fund', sub: 'Closest goal to completion', plate: T.avPlate, stop: T.avStop, max: 27000 },
    { key: 'loan', label: 'Personal loan early payment', sub: '12.5% interest rate', plate: T.rPlate, stop: T.rStop, max: 25000 },
    { key: 'free', label: 'Free spend', sub: 'Unrestricted', plate: T.yPlate, stop: T.yStop, max: 50000 },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '14px 22px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, color: T.p, display: 'flex',
        }}>
          <X size={20} />
        </button>
        <div style={{ fontSize: 11, color: T.t, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Windfall · Step {step + 1} of 2
        </div>
        <div style={{ width: 20 }} />
      </div>

      {step === 0 && (
        <div style={{ padding: '8px 16px 24px', flex: 1 }}>
          <div style={{ padding: '0 6px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 400, color: T.p, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 8 }}>
              Allocate your ₹50,000
            </div>
            <div style={{ fontSize: 13.5, color: T.s, lineHeight: 1.5 }}>
              Here's a suggested split based on your current state. Adjust as needed — the four buckets keep things in your existing structure.
            </div>
          </div>

          <Card hero style={{ padding: '20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: T.s }}>Allocated</span>
              <span style={{ fontSize: 13, color: T.t }}>{inr(sum)} / {inr(TOTAL)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 18 }}>
              <div style={{
                width: `${(sum / TOTAL) * 100}%`, height: '100%',
                backgroundColor: T.avAccent, borderRadius: 999,
              }} />
            </div>

            {buckets.map((b, i) => (
              <div key={b.key} style={{
                marginBottom: i < buckets.length - 1 ? 18 : 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, color: T.p, fontWeight: 500 }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: T.t, marginTop: 2 }}>{b.sub}</div>
                  </div>
                  <Pill plate={b.plate} stop={b.stop}>{inr(allocations[b.key])}</Pill>
                </div>
                <input
                  type="range"
                  min={0}
                  max={b.max}
                  step={500}
                  value={allocations[b.key]}
                  onChange={(e) => update(b.key, Number(e.target.value))}
                  style={{
                    width: '100%', accentColor: b.stop,
                    cursor: 'pointer',
                  }}
                />
              </div>
            ))}
          </Card>

          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 14,
            backgroundColor: T.yPlate, color: T.yStop, fontSize: 11.5, lineHeight: 1.5,
          }}>
            Savio only allocates into your own buckets — goals, debt, free spend. No specific instrument recommendations (that's a SEBI-regulated area).
          </div>

          <button onClick={() => setStep(1)} style={{
            marginTop: 18, width: '100%', padding: '14px',
            backgroundColor: T.p, color: T.card, border: 'none',
            borderRadius: 999, fontSize: 15, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Review allocation
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: '8px 16px 24px', flex: 1 }}>
          <div style={{ padding: '0 6px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 400, color: T.p, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 8 }}>
              Lock it in?
            </div>
            <div style={{ fontSize: 13.5, color: T.s, lineHeight: 1.5 }}>
              Here's what you decided. You can adjust this within 24 hours from your transactions view.
            </div>
          </div>

          <Card hero>
            {buckets.map((b, i) => (
              <div key={b.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < buckets.length - 1 ? `0.5px solid ${T.border}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    backgroundColor: b.plate, color: b.stop,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 14, color: T.p }}>{b.label}</span>
                </div>
                <span style={{ fontSize: 15, color: T.p, fontWeight: 500 }}>
                  {inr(allocations[b.key])}
                </span>
              </div>
            ))}
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: 13, color: T.s }}>Total</span>
              <span style={{ fontSize: 22, color: T.p, fontWeight: 500 }}>{inr(sum)}</span>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setStep(0)} style={{
              flex: 1, padding: '13px', borderRadius: 999,
              backgroundColor: 'transparent', color: T.p,
              border: `0.5px solid ${T.borderHover}`,
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              Back
            </button>
            <button onClick={onComplete} style={{
              flex: 2, padding: '13px', borderRadius: 999,
              backgroundColor: T.p, color: T.card, border: 'none',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              Lock it in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MONTHLY ANCHOR RITUAL — 5 screens
// =====================================================================
const MonthlyRitual = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(0);
  const [focusGoal, setFocusGoal] = useState('phone');

  const goals = [
    { id: 'phone', label: 'Phone fund', sub: '₹8K of ₹35K · Aug 2026' },
    { id: 'emergency', label: 'Emergency fund', sub: '₹1.84L of ₹3L · Mar 2027' },
    { id: 'goa', label: 'Goa trip', sub: '₹3K of ₹25K · Dec 2026' },
    { id: 'none', label: 'No specific focus', sub: 'Just stay aware' },
  ];

  const commitments = [
    { label: 'Rent — HSR Layout', amount: 22000 },
    { label: 'Personal loan EMI', amount: 8500 },
    { label: 'SIPs (2)', amount: 15000 },
    { label: 'Parents — monthly transfer', amount: 8000 },
    { label: 'Insurance (term + health)', amount: 2350 },
    { label: 'Utilities + subscriptions', amount: 5618 },
  ];

  const Header2 = ({ stepLabel }) => (
    <div style={{
      padding: '14px 22px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, color: T.p, display: 'flex',
      }}>
        <X size={20} />
      </button>
      <div style={{ fontSize: 11, color: T.t, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        Monthly check-in · {stepLabel}
      </div>
      <div style={{ width: 20 }} />
    </div>
  );

  const Title = ({ children, sub }) => (
    <div style={{ padding: '0 22px 18px' }}>
      <div style={{ fontSize: 28, fontWeight: 400, color: T.p, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 8 }}>
        {children}
      </div>
      {sub && <div style={{ fontSize: 13.5, color: T.s, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );

  const PrimaryButton = ({ onClick, children, full = true }) => (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto', padding: '14px 24px',
      backgroundColor: T.p, color: T.card, border: 'none',
      borderRadius: 999, fontSize: 15, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      {children}
    </button>
  );

  // STEP 0 — Welcome
  if (step === 0) return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <Header2 stepLabel="1 of 5" />
      <div style={{ padding: '40px 22px 24px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 999,
          backgroundColor: T.avPlate, color: T.avStop,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
        }}>
          <Calendar size={32} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 30, fontWeight: 400, color: T.p, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 14 }}>
          It's the 1st — your monthly check-in is ready.
        </div>
        <div style={{ fontSize: 15, color: T.s, lineHeight: 1.55, marginBottom: 32 }}>
          About 90 seconds. You'll confirm what landed, scan your commitments, pick a focus, and lock your safe-to-spend for April.
        </div>
        <PrimaryButton onClick={() => setStep(1)}>
          Start <ArrowRight size={16} />
        </PrimaryButton>
      </div>
    </div>
  );

  // STEP 1 — Income confirmation
  if (step === 1) return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <Header2 stepLabel="2 of 5" />
      <Title sub="We saw your salary land this morning.">Income for April</Title>
      <div style={{ padding: '0 16px 24px' }}>
        <Card hero>
          <div style={{ fontSize: 12.5, color: T.s, marginBottom: 6 }}>Salary credited</div>
          <div style={{ fontSize: 44, fontWeight: 500, color: T.p, letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>
            ₹68,500
          </div>
          <div style={{ fontSize: 12, color: T.t }}>
            1 Apr 2026 · 09:14 AM · HDFC
          </div>
        </Card>

        <div style={{ marginTop: 14, fontSize: 13.5, color: T.s, padding: '0 6px' }}>
          Did you receive any other income this month?
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={{
            flex: 1, padding: '12px', borderRadius: 14,
            backgroundColor: T.card, color: T.p,
            border: `1px solid ${T.avStop}`,
            fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            No, just salary
          </button>
          <button style={{
            flex: 1, padding: '12px', borderRadius: 14,
            backgroundColor: T.card, color: T.p,
            border: `0.5px solid ${T.border}`,
            fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Yes, let me add
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => setStep(2)}>
            Continue <ArrowRight size={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );

  // STEP 2 — Commitments confirmation
  if (step === 2) return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <Header2 stepLabel="3 of 5" />
      <Title sub="A quick scan of what's committed. Tap to adjust any that changed.">Your commitments</Title>
      <div style={{ padding: '0 16px 24px' }}>
        <Card style={{ padding: '6px 4px' }}>
          {commitments.map((c, i) => (
            <div key={c.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 14px',
              borderBottom: i < commitments.length - 1 ? `0.5px solid ${T.border}` : 'none',
            }}>
              <span style={{ fontSize: 13.5, color: T.p }}>{c.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13.5, color: T.p, fontWeight: 500 }}>{inr(c.amount)}</span>
                <span style={{ fontSize: 11.5, color: T.avStop }}>Same</span>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 14, backgroundColor: T.cardSoft, fontSize: 12.5, color: T.s, lineHeight: 1.5 }}>
          Total: <strong style={{ color: T.p }}>{inr(61468)}/month</strong>. This leaves <strong style={{ color: T.p }}>₹7,032</strong> as base monthly slack before goals.
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => setStep(3)}>
            Looks right <ArrowRight size={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );

  // STEP 3 — Focus goal
  if (step === 3) return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <Header2 stepLabel="4 of 5" />
      <Title sub="Pick one. You can change it any time this month.">Your focus this month</Title>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goals.map(g => {
            const active = focusGoal === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setFocusGoal(g.id)}
                style={{
                  textAlign: 'left', padding: '14px 16px',
                  backgroundColor: T.card,
                  border: active ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
                  borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 999,
                  border: `1.5px solid ${active ? T.avStop : T.borderHover}`,
                  backgroundColor: active ? T.avStop : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {active && <Check size={12} color={T.card} strokeWidth={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, color: T.p, fontWeight: 500 }}>{g.label}</div>
                  <div style={{ fontSize: 11.5, color: T.t, marginTop: 2 }}>{g.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => setStep(4)}>
            Continue <ArrowRight size={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );

  // STEP 4 — Lock in
  if (step === 4) return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: T.bg }}>
      <Header2 stepLabel="5 of 5" />
      <Title>Your April is set.</Title>
      <div style={{ padding: '0 16px 24px' }}>
        <Card hero>
          <div style={{ fontSize: 13, color: T.s, marginBottom: 6 }}>Safe to spend in April</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 52, fontWeight: 500, color: T.p, lineHeight: 1, letterSpacing: '-1.3px' }}>
              ₹16,032
            </span>
          </div>
          <div style={{
            height: 10, borderRadius: 999,
            background: 'linear-gradient(90deg, #FF8F8F 0%, #FBAA5A 25%, #F4D123 50%, #B2EF82 75%, #58B9FF 100%)',
            marginBottom: 14,
          }} />
          <div style={{ fontSize: 12.5, color: T.s, lineHeight: 1.5 }}>
            That's <strong style={{ color: T.p }}>₹534/day</strong> across 30 days. Your focus this month is the <strong style={{ color: T.p }}>phone fund</strong>.
          </div>
        </Card>

        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 14,
          backgroundColor: T.avPlate,
          fontSize: 12.5, color: T.avStop, lineHeight: 1.5,
        }}>
          Savio will check in again on 1 May. You can ask anything in chat anytime before that.
        </div>

        <div style={{ marginTop: 22 }}>
          <PrimaryButton onClick={onComplete}>
            <Check size={16} strokeWidth={2.5} /> Lock it in
          </PrimaryButton>
        </div>
      </div>
    </div>
  );

  return null;
};

// =====================================================================
// Bottom nav
// =====================================================================
const BottomNav = ({ tab, setTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'chat', label: 'Chat', Icon: MessageCircle },
    { id: 'reflect', label: 'Reflect', Icon: Sparkles },
    { id: 'goals', label: 'Goals', Icon: Target },
  ];
  return (
    <div style={{
      borderTop: `0.5px solid ${T.border}`,
      backgroundColor: T.bg, paddingBottom: 14,
    }}>
      <div style={{ display: 'flex', padding: '10px 8px 6px' }}>
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '6px 4px', cursor: 'pointer',
                color: active ? T.avStop : T.t,
                fontFamily: 'inherit',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 500 : 400 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// =====================================================================
// Main app
// =====================================================================
export default function SavioPreview() {
  const [view, setView] = useState('app');      // 'app' | 'profile' | 'windfall' | 'ritual'
  const [tab, setTab] = useState('home');
  const [windfallDismissed, setWindfallDismissed] = useState(false);
  const [ritualCompleted, setRitualCompleted] = useState(false);
  const [reflections, setReflections] = useState({});

  const titles = {
    home: 'Your Dashboard',
    chat: 'Savio',
    reflect: 'Reflect',
    goals: 'Your goals',
  };

  const label = (id, val) => setReflections(r => {
    if (val === null) {
      const next = { ...r };
      delete next[id];
      return next;
    }
    return { ...r, [id]: val };
  });

  const renderAppContent = () => (
    <>
      <StatusBar />
      <Header title={titles[tab]} onAvatarTap={() => setView('profile')} />
      <div className="savio-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'home' && (
          <Home
            windfallDismissed={windfallDismissed}
            dismissWindfall={() => setWindfallDismissed(true)}
            openWindfallFlow={() => setView('windfall')}
            ritualCompleted={ritualCompleted}
            openMonthlyRitual={() => setView('ritual')}
          />
        )}
        {tab === 'chat' && <Chat />}
        {tab === 'reflect' && <Reflect reflections={reflections} label={label} />}
        {tab === 'goals' && <Goals />}
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600&display=swap');
        .savio-app, .savio-app * {
          font-family: 'Neue Montreal', 'Hanken Grotesk', system-ui, -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          box-sizing: border-box;
        }
        .savio-scroll::-webkit-scrollbar { display: none; }
        .savio-scroll { scrollbar-width: none; }
        .savio-app input[type=range] {
          height: 24px; -webkit-appearance: none; background: transparent;
        }
        .savio-app input[type=range]::-webkit-slider-runnable-track {
          height: 4px; background: rgba(0,0,0,0.08); border-radius: 999px;
        }
        .savio-app input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 999px;
          background: #1A1A1A; margin-top: -7px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: pointer;
        }
      `}</style>

      <div style={{
        minHeight: '100vh', width: '100%',
        backgroundColor: '#D8D8D2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
        backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 60%)',
      }}>
        <div className="savio-app" style={{
          width: '100%', maxWidth: 392,
          height: 820, maxHeight: 'calc(100vh - 80px)',
          backgroundColor: T.bg,
          borderRadius: 44,
          border: '8px solid #1A1A1A',
          boxShadow: '0 30px 80px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 26, backgroundColor: '#1A1A1A', borderRadius: 999,
            zIndex: 10,
          }} />

          {view === 'app' && renderAppContent()}

          {view === 'profile' && (
            <>
              <StatusBar />
              <Profile
                onClose={() => setView('app')}
                openMonthlyRitual={() => setView('ritual')}
              />
            </>
          )}

          {view === 'windfall' && (
            <>
              <StatusBar />
              <WindfallFlow
                onClose={() => setView('app')}
                onComplete={() => {
                  setWindfallDismissed(true);
                  setView('app');
                }}
              />
            </>
          )}

          {view === 'ritual' && (
            <>
              <StatusBar />
              <MonthlyRitual
                onClose={() => setView('app')}
                onComplete={() => {
                  setRitualCompleted(true);
                  setView('app');
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
