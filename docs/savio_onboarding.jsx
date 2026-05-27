import React, { useState } from 'react';
import {
  Compass, Sailboat, Hammer, Check, ArrowRight, ArrowLeft,
  Upload, FileText, Calendar, Target, Sparkles, ShieldCheck,
  Wallet, TrendingUp, Plane, Repeat, MessageSquare,
  Building2, Pencil, Lock
} from 'lucide-react';

// =====================================================================
// Design tokens
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
  avPlate: '#DCEEFF', avStop: '#0C447C', avAccent: '#58B9FF',
  adPlate: '#FCF1CC', adStop: '#854F0B', adAccent: '#F4D123',
  bdPlate: '#DEF2CB', bdStop: '#3B6D11', bdAccent: '#B2EF82',
  rPlate: '#FFE1E1', rStop: '#791F1F', rAccent: '#FF8F8F',
};

const inr = (n) => `\u20B9${n.toLocaleString('en-IN')}`;

const AVATARS = {
  strategist: { label: 'The Strategist', icon: Compass, plate: T.avPlate, stop: T.avStop, accent: T.avAccent,
    blurb: 'I want to verify my work and see the math.', tagline: 'Math-forward, rule-referenced.' },
  adventurer: { label: 'The Adventurer', icon: Sailboat, plate: T.adPlate, stop: T.adStop, accent: T.adAccent,
    blurb: 'Just tell me if it\u2019s a yes or no. Life comes first.', tagline: 'Warm, low-friction, brief.' },
  builder:    { label: 'The Builder',    icon: Hammer,  plate: T.bdPlate, stop: T.bdStop, accent: T.bdAccent,
    blurb: 'I\u2019m working toward something. Show me progress.', tagline: 'Goal-anchored, milestone-focused.' },
};

// =====================================================================
// Primitives
// =====================================================================
const Card = ({ children, hero, style, onClick }) => (
  <div onClick={onClick} style={{
    backgroundColor: T.card,
    borderRadius: hero ? 28 : 22,
    border: `0.5px solid ${T.border}`,
    padding: hero ? '24px 22px' : '18px',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }}>
    {children}
  </div>
);

const Pill = ({ plate, stop, children }) => (
  <span style={{
    backgroundColor: plate, color: stop,
    padding: '4px 10px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 500, lineHeight: 1.2,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    whiteSpace: 'nowrap',
  }}>{children}</span>
);

const PrimaryButton = ({ onClick, children, disabled, full = true }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: full ? '100%' : 'auto',
    padding: '14px 22px',
    backgroundColor: disabled ? '#D5D5D0' : T.p,
    color: T.card, border: 'none',
    borderRadius: 999, fontSize: 15, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 200ms ease, opacity 200ms ease',
  }}>{children}</button>
);

const SecondaryButton = ({ onClick, children, full = true }) => (
  <button onClick={onClick} style={{
    width: full ? '100%' : 'auto',
    padding: '13px 22px',
    backgroundColor: 'transparent', color: T.p,
    border: `0.5px solid ${T.borderHover}`,
    borderRadius: 999, fontSize: 14.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  }}>{children}</button>
);

const SavioWordmark = ({ size = 64 }) => (
  <span style={{
    fontSize: size, fontWeight: 500, lineHeight: 1,
    letterSpacing: '-2px',
    background: 'linear-gradient(90deg, #FF8F8F 0%, #FBAA5A 25%, #F4D123 50%, #B2EF82 75%, #58B9FF 100%)',
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    WebkitTextFillColor: 'transparent', color: 'transparent',
    display: 'inline-block',
  }}>Savio</span>
);

// Step wrapper — fixes the flex/scroll bug with minHeight: 0
const StepFrame = ({ children }) => (
  <div style={{
    flex: 1, minHeight: 0,
    display: 'flex', flexDirection: 'column',
  }}>{children}</div>
);

// Scrollable body — fixes the flex/scroll bug with minHeight: 0
const ScrollBody = ({ children, style }) => (
  <div className="savio-scroll" style={{
    flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
    padding: '0 16px 16px',
    ...style,
  }}>{children}</div>
);

const Footer = ({ children }) => (
  <div style={{
    padding: '12px 16px 24px', flexShrink: 0,
    backgroundColor: T.bg,
  }}>{children}</div>
);

// =====================================================================
// Status + progress
// =====================================================================
const StatusBar = () => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '14px 22px 8px', fontSize: 14, fontWeight: 500, color: T.p,
    flexShrink: 0,
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

const ProgressBar = ({ step, total, onBack }) => (
  <div style={{
    padding: '12px 22px 16px', display: 'flex',
    alignItems: 'center', gap: 12, flexShrink: 0,
  }}>
    {step > 1 ? (
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, color: T.s, display: 'flex',
      }}>
        <ArrowLeft size={18} />
      </button>
    ) : <div style={{ width: 18 }} />}
    <div style={{ flex: 1, display: 'flex', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 999,
          backgroundColor: i < step ? T.p : 'rgba(0,0,0,0.08)',
          transition: 'background-color 250ms ease',
        }} />
      ))}
    </div>
    <span style={{ fontSize: 11, color: T.t, fontWeight: 500, minWidth: 32, textAlign: 'right' }}>
      {step} / {total}
    </span>
  </div>
);

const StepTitle = ({ children, sub }) => (
  <div style={{ padding: '8px 22px 22px', flexShrink: 0 }}>
    <h1 style={{
      fontSize: 28, fontWeight: 400, color: T.p,
      lineHeight: 1.15, letterSpacing: '-0.5px', margin: '0 0 8px',
    }}>{children}</h1>
    {sub && (
      <p style={{ fontSize: 14, color: T.s, lineHeight: 1.5, margin: 0 }}>{sub}</p>
    )}
  </div>
);

// =====================================================================
// STEP 0 — Welcome
// =====================================================================
const Welcome = ({ onStart, onSkip }) => (
  <div style={{
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
    padding: '24px 24px 28px',
  }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ marginBottom: 18 }}><SavioWordmark size={72} /></div>
      <h2 style={{
        fontSize: 22, fontWeight: 400, color: T.p,
        lineHeight: 1.25, letterSpacing: '-0.3px', margin: '0 0 14px',
      }}>Better money decisions, made together.</h2>
      <p style={{ fontSize: 15, color: T.s, lineHeight: 1.55, margin: 0 }}>
        Savio helps you think clearly about your money at the moments that matter — not by catching you mid-purchase, but at the moments you're already reflective.
      </p>

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: Wallet,   plate: T.avPlate, stop: T.avStop, text: 'Grounded answers using your actual numbers' },
          { icon: Calendar, plate: T.bdPlate, stop: T.bdStop, text: 'Monthly check-ins that anchor your budget' },
          { icon: Sparkles, plate: T.adPlate, stop: T.adStop, text: 'Reflection that builds your own pattern map' },
        ].map(({ icon: Icon, plate, stop, text }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              backgroundColor: plate, color: stop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={15} />
            </div>
            <span style={{ fontSize: 13.5, color: T.p, lineHeight: 1.45 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
      <PrimaryButton onClick={onStart}>Get started <ArrowRight size={16} /></PrimaryButton>
      <SecondaryButton onClick={onSkip}>Demo: log in as Priya</SecondaryButton>
    </div>
  </div>
);

// =====================================================================
// STEP 1 — Disclaimer
// =====================================================================
const Disclaimer = ({ acknowledged, setAcknowledged, onNext }) => (
  <StepFrame>
    <StepTitle sub="One thing to read before we begin.">Before we begin</StepTitle>
    <ScrollBody>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={16} color={T.avStop} />
          <span style={{ fontSize: 11.5, color: T.avStop, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            What Savio is
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: T.p, lineHeight: 1.55, margin: 0 }}>
          Savio helps you think about your money. It is <strong>not</strong> a financial advisor, investment advisor, or registered financial planner.
        </p>
        <p style={{ fontSize: 13.5, color: T.p, lineHeight: 1.55, margin: '10px 0 0' }}>
          All numerical estimates and suggestions are AI-generated based on the information you've provided and may contain errors. Verify all important calculations independently.
        </p>
        <p style={{ fontSize: 13.5, color: T.p, lineHeight: 1.55, margin: '10px 0 0' }}>
          For specific investment, tax, or legal advice, consult a qualified professional.
        </p>
      </Card>

      <button
        onClick={() => setAcknowledged(!acknowledged)}
        style={{
          marginTop: 12, width: '100%',
          backgroundColor: acknowledged ? T.avPlate : T.card,
          border: `0.5px solid ${acknowledged ? T.avStop : T.border}`,
          borderRadius: 18, padding: '14px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${acknowledged ? T.avStop : T.borderHover}`,
          backgroundColor: acknowledged ? T.avStop : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {acknowledged && <Check size={13} color={T.card} strokeWidth={3} />}
        </div>
        <span style={{ fontSize: 13, color: T.p, lineHeight: 1.45 }}>
          I understand Savio is decision-support, not a financial advisor. I'll verify important calculations independently.
        </span>
      </button>
    </ScrollBody>
    <Footer>
      <PrimaryButton onClick={onNext} disabled={!acknowledged}>
        Continue <ArrowRight size={16} />
      </PrimaryButton>
    </Footer>
  </StepFrame>
);

// =====================================================================
// STEP 2 — Data source choice
// =====================================================================
const DataSource = ({ source, setSource, onNext }) => {
  const [bankExpanded, setBankExpanded] = useState(false);

  return (
    <StepFrame>
      <StepTitle sub="The better the input, the sharper Savio gets. Pick what works.">
        How should Savio learn about your money?
      </StepTitle>
      <ScrollBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Statement */}
          <button
            onClick={() => { setSource('statement'); setBankExpanded(false); }}
            style={{
              textAlign: 'left', padding: '16px',
              backgroundColor: T.card,
              border: source === 'statement' ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
              borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', gap: 14, alignItems: 'flex-start',
              backgroundImage: source === 'statement' ? `linear-gradient(to bottom right, ${T.avPlate}55, transparent)` : 'none',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.avPlate, color: T.avStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={18} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14.5, color: T.p, fontWeight: 500 }}>Upload a bank statement</span>
                <Pill plate={T.bdPlate} stop={T.bdStop}>Recommended</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: T.s, lineHeight: 1.45 }}>
                6-month backfill in 30 seconds. Best for an immediate dashboard.
              </div>
            </div>
            {source === 'statement' && (
              <Check size={16} color={T.avStop} strokeWidth={3} style={{ marginTop: 4 }} />
            )}
          </button>

          {/* Bank connect — V2 */}
          <button
            onClick={() => setBankExpanded(!bankExpanded)}
            style={{
              textAlign: 'left', padding: '16px',
              backgroundColor: T.card,
              border: `0.5px solid ${T.border}`,
              borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', gap: 14, alignItems: 'flex-start',
              opacity: 0.85,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 999, flexShrink: 0,
              backgroundColor: '#F4F4F2', color: T.s,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={18} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14.5, color: T.p, fontWeight: 500 }}>Connect a bank account</span>
                <Pill plate={T.adPlate} stop={T.adStop}>Coming in V2</Pill>
              </div>
              <div style={{ fontSize: 12.5, color: T.s, lineHeight: 1.45 }}>
                Real-time transaction sync via Account Aggregator framework.
              </div>
              {bankExpanded && (
                <div style={{
                  marginTop: 10, padding: '10px 12px', borderRadius: 12,
                  backgroundColor: T.cardSoft, fontSize: 11.5, color: T.s,
                  lineHeight: 1.5,
                }}>
                  India's Account Aggregator framework (Sahamati / Finvu / OneMoney) is the regulator-sanctioned alternative to screen-scraping or repeat statement uploads. V2 path — picking this in the demo isn't yet wired up.
                </div>
              )}
            </div>
          </button>

          {/* Manual */}
          <button
            onClick={() => { setSource('manual'); setBankExpanded(false); }}
            style={{
              textAlign: 'left', padding: '16px',
              backgroundColor: T.card,
              border: source === 'manual' ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
              borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', gap: 14, alignItems: 'flex-start',
              backgroundImage: source === 'manual' ? `linear-gradient(to bottom right, ${T.avPlate}55, transparent)` : 'none',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.bdPlate, color: T.bdStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Pencil size={17} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14.5, color: T.p, fontWeight: 500 }}>Enter manually</span>
              </div>
              <div style={{ fontSize: 12.5, color: T.s, lineHeight: 1.45 }}>
                Just income and bank — Savio asks for the rest as you go.
              </div>
            </div>
            {source === 'manual' && (
              <Check size={16} color={T.avStop} strokeWidth={3} style={{ marginTop: 4 }} />
            )}
          </button>
        </div>

        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 12,
          backgroundColor: T.cardSoft, fontSize: 11.5, color: T.s,
          lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <Lock size={11} color={T.s} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Whatever you pick, your statement and SMS data stay on your device until you ask Savio a question. No background uploads.</span>
        </div>
      </ScrollBody>
      <Footer>
        <PrimaryButton onClick={onNext} disabled={!source || source === 'bank'}>
          Continue <ArrowRight size={16} />
        </PrimaryButton>
      </Footer>
    </StepFrame>
  );
};

// =====================================================================
// STEP 3a — Statement parse review (if statement chosen)
// =====================================================================
const StatementReview = ({ uploaded, setUploaded, onNext }) => (
  <StepFrame>
    <StepTitle sub={uploaded ? "Here's what Savio found in your last 6 months." : 'Tap to upload — production parsing scoped for V2.'}>
      {uploaded ? 'Your last 6 months' : 'Upload your statement'}
    </StepTitle>
    <ScrollBody>
      {!uploaded ? (
        <>
          <button
            onClick={() => setUploaded(true)}
            style={{
              width: '100%', padding: '40px 20px',
              backgroundColor: T.cardSoft,
              border: `1px dashed ${T.borderHover}`,
              borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 999,
              backgroundColor: T.avPlate, color: T.avStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={22} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 15, color: T.p, fontWeight: 500, marginBottom: 4 }}>
                Tap to upload PDF
              </div>
              <div style={{ fontSize: 12, color: T.t }}>HDFC, SBI, ICICI, Axis supported</div>
            </div>
          </button>
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 12,
            backgroundColor: T.adPlate, color: T.adStop,
            fontSize: 11.5, lineHeight: 1.5, fontStyle: 'italic',
          }}>
            Demo mode — using pre-loaded data. Production statement parsing scoped for V2.
          </div>
        </>
      ) : (
        <>
          <Card hero style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <FileText size={16} color={T.bdStop} />
              <span style={{ fontSize: 13, color: T.bdStop, fontWeight: 500 }}>
                HDFC_Statement_Nov2025_Apr2026.pdf
              </span>
            </div>
            {[
              { label: 'Income detected', value: '\u20B968,500/mo \u00B7 1st' },
              { label: 'Recurring commitments', value: '10 found' },
              { label: 'Spending categories', value: '6 patterns' },
              { label: 'Existing savings', value: '\u20B92,26,800' },
            ].map((row, i) => (
              <div key={row.label} style={{
                padding: '12px 0',
                borderTop: `0.5px solid ${T.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{ fontSize: 12.5, color: T.s }}>{row.label}</span>
                <span style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </Card>
          <button
            onClick={() => setUploaded(false)}
            style={{
              marginTop: 12, padding: '6px 10px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: T.t, fontSize: 12, fontFamily: 'inherit',
            }}
          >← Edit any of these</button>
        </>
      )}
    </ScrollBody>
    <Footer>
      <PrimaryButton onClick={onNext} disabled={!uploaded}>
        {uploaded ? <>Looks right, continue <ArrowRight size={16} /></> : 'Upload to continue'}
      </PrimaryButton>
    </Footer>
  </StepFrame>
);

// =====================================================================
// STEP 3b — Manual entry (if manual chosen)
// =====================================================================
const ManualEntry = ({ income, setIncome, bank, setBank, onNext }) => {
  const banks = ['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'Other'];
  const valid = income && parseInt(income, 10) > 0 && bank;

  return (
    <StepFrame>
      <StepTitle sub="Just enough to give you grounded answers. Savio asks for the rest as you go.">
        Your basics
      </StepTitle>
      <ScrollBody>
        <div style={{ fontSize: 11.5, color: T.s, fontWeight: 500, padding: '0 6px 8px', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Monthly take-home income
        </div>
        <Card style={{ padding: '6px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, color: T.t, fontWeight: 400 }}>₹</span>
            <input
              type="number"
              placeholder="e.g. 68,500"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 22, fontWeight: 500, color: T.p,
                fontFamily: 'inherit', padding: '14px 0',
                backgroundColor: 'transparent',
              }}
            />
            <span style={{ fontSize: 12, color: T.t }}>/ month</span>
          </div>
        </Card>

        <div style={{ fontSize: 11.5, color: T.s, fontWeight: 500, padding: '18px 6px 8px', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Primary bank
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {banks.map(b => {
            const active = bank === b;
            return (
              <button
                key={b}
                onClick={() => setBank(b)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: T.card,
                  border: active ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
                  borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, color: T.p, fontWeight: active ? 500 : 400,
                }}
              >{b}</button>
            );
          })}
        </div>

        <div style={{
          marginTop: 18, padding: '10px 12px', borderRadius: 12,
          backgroundColor: T.cardSoft, fontSize: 11.5, color: T.s,
          lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <Sparkles size={11} color={T.s} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>You can come back and add commitments, goals, and rules any time. Savio works with what it has — and asks for more only when it needs it.</span>
        </div>
      </ScrollBody>
      <Footer>
        <PrimaryButton onClick={onNext} disabled={!valid}>
          Continue <ArrowRight size={16} />
        </PrimaryButton>
      </Footer>
    </StepFrame>
  );
};

// =====================================================================
// STEP 4 — SMS permission (always)
// =====================================================================
const SmsPermission = ({ allowed, setAllowed, onNext }) => {
  const decided = allowed !== null;

  return (
    <StepFrame>
      <StepTitle sub="So you don't have to log anything by hand.">
        Catch your transactions automatically
      </StepTitle>
      <ScrollBody>
        <Card hero style={{ padding: 22, alignItems: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 999, margin: '0 auto 18px',
            backgroundColor: T.bdPlate, color: T.bdStop,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={32} strokeWidth={1.6} />
          </div>
          <div style={{ fontSize: 15, color: T.p, lineHeight: 1.5, textAlign: 'center', marginBottom: 14 }}>
            Savio reads transaction SMS from your bank so it can show you spending and trigger ritual prompts — without you logging anything.
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            paddingTop: 14, borderTop: `0.5px solid ${T.border}`,
          }}>
            {[
              { icon: Check, plate: T.gPlate, stop: T.bdStop, text: 'Only transaction SMS from whitelisted bank senders' },
              { icon: Check, plate: T.gPlate, stop: T.bdStop, text: 'OTPs and personal messages are ignored' },
              { icon: Check, plate: T.gPlate, stop: T.bdStop, text: 'Parsed on-device — never uploaded raw' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                  backgroundColor: T.bdPlate, color: T.bdStop,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={11} strokeWidth={3} />
                </div>
                <span style={{ fontSize: 12.5, color: T.p, lineHeight: 1.4 }}>{row.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 12,
          backgroundColor: T.adPlate, color: T.adStop,
          fontSize: 11.5, lineHeight: 1.5, fontStyle: 'italic',
        }}>
          Demo mode — actual SMS reading scoped for V2. Selecting either option here just records the choice.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setAllowed(true)}
            style={{
              padding: '14px 18px', borderRadius: 16,
              backgroundColor: allowed === true ? T.bdPlate : T.card,
              border: allowed === true ? `1.5px solid ${T.bdStop}` : `0.5px solid ${T.border}`,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', gap: 12, alignItems: 'center',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.bdPlate, color: T.bdStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={14} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>Allow SMS access</div>
              <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>Recommended for the best experience</div>
            </div>
            {allowed === true && <Check size={15} color={T.bdStop} strokeWidth={3} />}
          </button>
          <button
            onClick={() => setAllowed(false)}
            style={{
              padding: '14px 18px', borderRadius: 16,
              backgroundColor: allowed === false ? '#F4F4F2' : T.card,
              border: allowed === false ? `1.5px solid ${T.s}` : `0.5px solid ${T.border}`,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', gap: 12, alignItems: 'center',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 999, flexShrink: 0,
              backgroundColor: '#F4F4F2', color: T.s,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calendar size={14} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>Set this up later</div>
              <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>You can enable it any time from Profile</div>
            </div>
            {allowed === false && <Check size={15} color={T.s} strokeWidth={3} />}
          </button>
        </div>
      </ScrollBody>
      <Footer>
        <PrimaryButton onClick={onNext} disabled={!decided}>
          Continue <ArrowRight size={16} />
        </PrimaryButton>
      </Footer>
    </StepFrame>
  );
};

// =====================================================================
// STEP 5 — Avatar selection
// =====================================================================
const AvatarSelect = ({ avatar, setAvatar, onNext }) => (
  <StepFrame>
    <StepTitle sub="Pick the voice that fits how you think. You can change this later.">
      How do you like to think about money?
    </StepTitle>
    <ScrollBody style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(AVATARS).map(([key, a]) => {
        const Icon = a.icon;
        const active = avatar === key;
        return (
          <button
            key={key}
            onClick={() => setAvatar(key)}
            style={{
              textAlign: 'left', padding: '18px 16px',
              backgroundColor: T.card,
              border: active ? `1.5px solid ${a.stop}` : `0.5px solid ${T.border}`,
              borderRadius: 22, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'flex-start', gap: 14,
              backgroundImage: active ? `linear-gradient(to bottom right, ${a.plate}55, transparent)` : 'none',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 999, flexShrink: 0,
              backgroundColor: a.plate, color: a.stop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15.5, color: T.p, fontWeight: 500 }}>{a.label}</span>
                {active && <Check size={14} color={a.stop} strokeWidth={3} />}
              </div>
              <div style={{ fontSize: 13, color: T.p, lineHeight: 1.45, marginBottom: 6 }}>
                "{a.blurb}"
              </div>
              <div style={{ fontSize: 11.5, color: T.t, lineHeight: 1.4 }}>{a.tagline}</div>
            </div>
          </button>
        );
      })}
    </ScrollBody>
    <Footer>
      <PrimaryButton onClick={onNext} disabled={!avatar}>
        Continue <ArrowRight size={16} />
      </PrimaryButton>
    </Footer>
  </StepFrame>
);

// =====================================================================
// STEP 6 — Life stage + anchor
// =====================================================================
const LifeAnchor = ({ lifeStage, setLifeStage, anchor, setAnchor, irregular, setIrregular, onNext }) => {
  const stages = [
    { id: 'student', label: 'Student', sub: 'Primary activity is study' },
    { id: 'working_no_dependents', label: 'Working, no dependents', sub: 'Earning, not supporting others' },
    { id: 'supporting_dependents', label: 'Supporting dependents', sub: 'Parents / spouse / children' },
    { id: 'pre_retiree', label: 'Planning for retirement', sub: 'Corpus-building phase' },
  ];
  const dates = [{ v: '1', label: '1st' }, { v: '15', label: 'Mid-month' }, { v: '28', label: 'End of month' }];
  const dayNum = parseInt(anchor || '1', 10);

  return (
    <StepFrame>
      <StepTitle sub="Confirm or correct — we use these to set your check-in rhythm.">
        A couple quick details
      </StepTitle>
      <ScrollBody>
        <div style={{ fontSize: 11.5, color: T.s, fontWeight: 500, padding: '0 6px 8px', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Life stage
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stages.map(s => {
            const active = lifeStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setLifeStage(s.id)}
                style={{
                  textAlign: 'left', padding: '12px 14px',
                  backgroundColor: T.card,
                  border: active ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
                  borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                  border: `1.5px solid ${active ? T.avStop : T.borderHover}`,
                  backgroundColor: active ? T.avStop : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {active && <Check size={10} color={T.card} strokeWidth={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, color: T.p, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>{s.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11.5, color: T.s, fontWeight: 500, padding: '20px 6px 8px', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {irregular ? 'Pick your check-in day' : 'When does your money usually arrive?'}
        </div>

        {!irregular ? (
          <div style={{ display: 'flex', gap: 6 }}>
            {dates.map(d => {
              const active = anchor === d.v;
              return (
                <button
                  key={d.v}
                  onClick={() => setAnchor(d.v)}
                  style={{
                    flex: 1, padding: '12px 10px',
                    backgroundColor: T.card,
                    border: active ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
                    borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, color: T.p, fontWeight: active ? 500 : 400,
                  }}
                >{d.label}</button>
              );
            })}
          </div>
        ) : (
          <div style={{
            backgroundColor: T.card, border: `0.5px solid ${T.border}`,
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 13.5, color: T.p }}>Day</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setAnchor(String(Math.max(1, dayNum - 1)))}
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  backgroundColor: T.cardSoft, border: `0.5px solid ${T.border}`,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 18, color: T.p,
                  lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >−</button>
              <input
                type="number" min={1} max={28} value={anchor || ''}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(28, parseInt(e.target.value || '1', 10)));
                  setAnchor(String(v));
                }}
                style={{
                  width: 56, textAlign: 'center', padding: '6px 0',
                  border: `0.5px solid ${T.border}`, borderRadius: 10,
                  fontSize: 16, fontWeight: 500, color: T.p,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={() => setAnchor(String(Math.min(28, dayNum + 1)))}
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  backgroundColor: T.cardSoft, border: `0.5px solid ${T.border}`,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 18, color: T.p,
                  lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+</button>
            </div>
            <span style={{ fontSize: 13, color: T.s, flex: 1 }}>of each month</span>
          </div>
        )}

        <button
          onClick={() => setIrregular(!irregular)}
          style={{
            marginTop: 8, width: '100%', padding: '12px 14px',
            backgroundColor: irregular ? T.card : 'transparent',
            border: irregular ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
            borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 999, flexShrink: 0,
            backgroundColor: irregular ? T.avPlate : '#F4F4F2',
            color: irregular ? T.avStop : T.s,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Repeat size={13} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: T.p, fontWeight: 500 }}>
              {irregular ? 'My income is irregular \u2713' : 'My income is irregular'}
            </div>
            <div style={{ fontSize: 11.5, color: T.t, marginTop: 1 }}>
              {irregular ? 'You pick the check-in day above' : "I'll set my own check-in day"}
            </div>
          </div>
        </button>

        <div style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 12,
          backgroundColor: T.cardSoft, fontSize: 11.5, color: T.s,
          lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <Sparkles size={11} color={T.s} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Savio asks small follow-up questions like these when they matter, instead of overwhelming you up front.</span>
        </div>
      </ScrollBody>
      <Footer>
        <PrimaryButton onClick={onNext} disabled={!lifeStage}>
          Continue <ArrowRight size={16} />
        </PrimaryButton>
      </Footer>
    </StepFrame>
  );
};

// =====================================================================
// STEP 7 — Focus goal
// =====================================================================
const FocusGoal = ({ focusGoal, setFocusGoal, dataSource, onNext }) => {
  // For manual entry path, no pre-seeded goals — show empty state with one input
  if (dataSource === 'manual') {
    return (
      <StepFrame>
        <StepTitle sub="You haven't set up goals yet — what's one thing you're trying to do?">
          What are you working on?
        </StepTitle>
        <ScrollBody>
          <Card style={{ padding: '6px 14px' }}>
            <input
              placeholder="e.g. Save for laptop"
              value={focusGoal === 'none' ? '' : focusGoal}
              onChange={(e) => setFocusGoal(e.target.value || '')}
              style={{
                width: '100%', border: 'none', outline: 'none',
                fontSize: 16, color: T.p, fontFamily: 'inherit',
                padding: '16px 0', backgroundColor: 'transparent',
              }}
            />
          </Card>
          <button
            onClick={() => setFocusGoal('none')}
            style={{
              marginTop: 10, width: '100%', padding: '12px 14px',
              backgroundColor: focusGoal === 'none' ? T.card : 'transparent',
              border: focusGoal === 'none' ? `1.5px solid ${T.avStop}` : `0.5px solid ${T.border}`,
              borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, color: T.p, fontWeight: 500, textAlign: 'left',
            }}
          >No specific focus, just stay aware</button>
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 12,
            backgroundColor: T.cardSoft, fontSize: 11.5, color: T.s,
            lineHeight: 1.5,
          }}>
            You can add goals with target amounts and dates from the Goals tab once you're in.
          </div>
        </ScrollBody>
        <Footer>
          <PrimaryButton onClick={onNext} disabled={!focusGoal}>
            Continue <ArrowRight size={16} />
          </PrimaryButton>
        </Footer>
      </StepFrame>
    );
  }

  const goals = [
    { id: 'phone', label: 'Phone fund', target: 35000, current: 8000, sub: 'Target Aug 2026 \u00B7 \u20B94,000/mo', icon: Sparkles, plate: T.avPlate, stop: T.avStop },
    { id: 'emergency', label: 'Emergency fund', target: 300000, current: 184000, sub: 'Target Mar 2027 \u00B7 \u20B92,000/mo', icon: ShieldCheck, plate: T.bdPlate, stop: T.bdStop },
    { id: 'goa', label: 'Goa year-end trip', target: 25000, current: 3000, sub: 'Target Dec 2026 \u00B7 \u20B93,000/mo', icon: Plane, plate: T.adPlate, stop: T.adStop },
    { id: 'none', label: 'No specific focus', sub: 'Just stay aware of the month', icon: TrendingUp, plate: '#F4F4F2', stop: T.s },
  ];

  return (
    <StepFrame>
      <StepTitle sub="Pick one. You can change it any time this month — we'll check in next month.">
        What are you working on this month?
      </StepTitle>
      <ScrollBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {goals.map(g => {
          const Icon = g.icon;
          const active = focusGoal === g.id;
          const pct = g.target ? Math.round((g.current / g.target) * 100) : null;
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
                width: 38, height: 38, borderRadius: 999, flexShrink: 0,
                backgroundColor: g.plate, color: g.stop,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{g.label}</span>
                  {active && <Check size={13} color={T.avStop} strokeWidth={3} />}
                </div>
                <div style={{ fontSize: 11.5, color: T.t, marginTop: 2 }}>{g.sub}</div>
                {pct !== null && (
                  <div style={{
                    height: 3, marginTop: 6, borderRadius: 999,
                    backgroundColor: 'rgba(0,0,0,0.05)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      backgroundColor: g.stop, borderRadius: 999,
                    }} />
                  </div>
                )}
              </div>
              {pct !== null && (
                <span style={{ fontSize: 12, color: T.s, fontWeight: 500 }}>{pct}%</span>
              )}
            </button>
          );
        })}
      </ScrollBody>
      <Footer>
        <PrimaryButton onClick={onNext} disabled={!focusGoal}>
          Continue <ArrowRight size={16} />
        </PrimaryButton>
      </Footer>
    </StepFrame>
  );
};

// =====================================================================
// STEP 8 — Ready
// =====================================================================
const Ready = ({ avatar, lifeStage, anchor, irregular, focusGoal, dataSource, smsAllowed, manualIncome, onEnter, onRestart }) => {
  const A = AVATARS[avatar] || AVATARS.strategist;
  const Icon = A.icon;

  const focusLabel = dataSource === 'manual'
    ? (focusGoal === 'none' ? 'No specific focus' : (focusGoal || '—'))
    : ({ phone: 'Phone fund', emergency: 'Emergency fund', goa: 'Goa year-end trip', none: 'No specific focus' }[focusGoal] || '—');

  const anchorLabel = irregular
    ? `Day ${anchor} of each month`
    : ({ '1': '1st of each month', '15': 'Mid-month', '28': 'End of month' }[anchor] || '1st');

  const stageLabel = {
    student: 'Student',
    working_no_dependents: 'Working, no dependents',
    supporting_dependents: 'Supporting dependents',
    pre_retiree: 'Planning for retirement',
  }[lifeStage] || '\u2014';

  const safeToSpend = dataSource === 'manual'
    ? Math.max(0, parseInt(manualIncome || '0', 10) - Math.floor(parseInt(manualIncome || '0', 10) * 0.75))
    : 16032;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '24px 24px 24px' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="savio-scroll">
        <div style={{
          width: 76, height: 76, borderRadius: 999,
          backgroundColor: T.bdPlate, color: T.bdStop,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          animation: 'savio-pop 600ms ease-out',
        }}>
          <Check size={36} strokeWidth={2.2} />
        </div>

        <h1 style={{
          fontSize: 34, fontWeight: 400, color: T.p,
          lineHeight: 1.1, letterSpacing: '-0.8px', margin: '0 0 10px',
        }}>You're set.</h1>
        <p style={{ fontSize: 15, color: T.s, lineHeight: 1.5, margin: '0 0 22px' }}>
          Here's what Savio will work with. You can adjust any of this any time from your profile.
        </p>

        <Card style={{ padding: '6px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px', borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: A.plate, color: A.stop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon size={16} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.t, marginBottom: 1 }}>Your avatar</div>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{A.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px', borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: '#F4F4F2', color: T.s,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Calendar size={15} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.t, marginBottom: 1 }}>Life stage · anchor</div>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{stageLabel} · {anchorLabel}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px', borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: smsAllowed ? T.bdPlate : '#F4F4F2',
              color: smsAllowed ? T.bdStop : T.s,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><MessageSquare size={15} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.t, marginBottom: 1 }}>SMS tracking</div>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>
                {smsAllowed ? 'On — Savio reads transaction SMS' : 'Off — set up later from Profile'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.avPlate, color: T.avStop,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Target size={15} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.t, marginBottom: 1 }}>Focus this month</div>
              <div style={{ fontSize: 14, color: T.p, fontWeight: 500 }}>{focusLabel}</div>
            </div>
          </div>
        </Card>

        <div style={{
          marginTop: 14, padding: '14px 16px', borderRadius: 18,
          background: 'linear-gradient(135deg, #DCEEFF, #DEF2CB)',
        }}>
          <div style={{ fontSize: 11.5, color: T.p, opacity: 0.7, marginBottom: 4 }}>
            Your safe-to-spend this month
          </div>
          <div style={{ fontSize: 38, color: T.p, fontWeight: 500, letterSpacing: '-1px', lineHeight: 1 }}>
            {inr(safeToSpend)}
          </div>
          <div style={{ fontSize: 11.5, color: T.p, opacity: 0.6, marginTop: 4 }}>
            {dataSource === 'manual' ? 'Rough estimate \u2014 will sharpen as you add commitments' : '\u20B9534/day across 30 days'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <PrimaryButton onClick={onEnter}>
          Enter Savio <ArrowRight size={16} />
        </PrimaryButton>
        <button onClick={onRestart} style={{
          background: 'transparent', border: 'none', color: T.t,
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 6,
        }}>↺ Run onboarding again</button>
      </div>
    </div>
  );
};

// =====================================================================
// Main app — flow + routing
// =====================================================================
export default function SavioOnboarding() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState({
    disclaimer: false,
    dataSource: '',          // 'statement' | 'manual' | 'bank'
    uploaded: false,         // for statement path
    manualIncome: '',
    manualBank: '',
    smsAllowed: null,        // null = undecided, true/false = chosen
    avatar: '',
    lifeStage: '',
    anchor: '1',
    irregular: false,
    focusGoal: '',
  });

  const set = (k, v) => setState(s => ({ ...s, [k]: v }));

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));

  const skip = () => {
    // Demo: log in as Priya
    setState({
      disclaimer: true, dataSource: 'statement', uploaded: true,
      manualIncome: '', manualBank: '',
      smsAllowed: true, avatar: 'strategist',
      lifeStage: 'supporting_dependents', anchor: '1', irregular: false,
      focusGoal: 'phone',
    });
    setStep(8);
  };

  const restart = () => {
    setStep(0);
    setState({
      disclaimer: false, dataSource: '', uploaded: false,
      manualIncome: '', manualBank: '',
      smsAllowed: null, avatar: '',
      lifeStage: '', anchor: '1', irregular: false, focusGoal: '',
    });
  };

  const TOTAL_STEPS = 7;
  const showProgress = step >= 1 && step <= 7;

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
        @keyframes savio-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        .savio-app input[type=number]::-webkit-outer-spin-button,
        .savio-app input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        .savio-app input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div style={{
        minHeight: '100vh', width: '100%', backgroundColor: '#D8D8D2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
        backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 60%)',
      }}>
        <div className="savio-app" style={{
          width: '100%', maxWidth: 392, height: 820,
          maxHeight: 'calc(100vh - 80px)',
          backgroundColor: T.bg, borderRadius: 44,
          border: '8px solid #1A1A1A',
          boxShadow: '0 30px 80px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.1)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 26, backgroundColor: '#1A1A1A', borderRadius: 999,
            zIndex: 10,
          }} />

          <StatusBar />
          {showProgress && <ProgressBar step={step} total={TOTAL_STEPS} onBack={back} />}

          {step === 0 && <Welcome onStart={next} onSkip={skip} />}
          {step === 1 && (
            <Disclaimer
              acknowledged={state.disclaimer}
              setAcknowledged={(v) => set('disclaimer', v)}
              onNext={next}
            />
          )}
          {step === 2 && (
            <DataSource
              source={state.dataSource}
              setSource={(v) => set('dataSource', v)}
              onNext={next}
            />
          )}
          {step === 3 && state.dataSource === 'statement' && (
            <StatementReview
              uploaded={state.uploaded}
              setUploaded={(v) => set('uploaded', v)}
              onNext={next}
            />
          )}
          {step === 3 && state.dataSource === 'manual' && (
            <ManualEntry
              income={state.manualIncome} setIncome={(v) => set('manualIncome', v)}
              bank={state.manualBank} setBank={(v) => set('manualBank', v)}
              onNext={next}
            />
          )}
          {step === 4 && (
            <SmsPermission
              allowed={state.smsAllowed}
              setAllowed={(v) => set('smsAllowed', v)}
              onNext={next}
            />
          )}
          {step === 5 && (
            <AvatarSelect
              avatar={state.avatar}
              setAvatar={(v) => set('avatar', v)}
              onNext={next}
            />
          )}
          {step === 6 && (
            <LifeAnchor
              lifeStage={state.lifeStage} setLifeStage={(v) => set('lifeStage', v)}
              anchor={state.anchor} setAnchor={(v) => set('anchor', v)}
              irregular={state.irregular} setIrregular={(v) => set('irregular', v)}
              onNext={next}
            />
          )}
          {step === 7 && (
            <FocusGoal
              focusGoal={state.focusGoal}
              setFocusGoal={(v) => set('focusGoal', v)}
              dataSource={state.dataSource}
              onNext={next}
            />
          )}
          {step === 8 && (
            <Ready
              avatar={state.avatar}
              lifeStage={state.lifeStage}
              anchor={state.anchor}
              irregular={state.irregular}
              focusGoal={state.focusGoal}
              dataSource={state.dataSource}
              smsAllowed={state.smsAllowed}
              manualIncome={state.manualIncome}
              onEnter={restart}
              onRestart={restart}
            />
          )}
        </div>
      </div>
    </>
  );
}
