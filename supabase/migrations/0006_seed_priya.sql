-- 0006_seed_priya.sql
-- We create the user first in auth.users during the migration run script if missing.
-- Here we'll just define the raw insertions. We need a known UUID for Priya's profile.
-- We'll use a fixed UUID so we can reference it.
-- Let's say Priya's profile ID is: '00000000-0000-4000-a000-000000000001'

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-a000-000000000001';
  v_auth_id uuid;
BEGIN
  -- We assume auth.users already has priya@savio.demo. 
  -- We fetch her auth.users id.
  SELECT id INTO v_auth_id FROM auth.users WHERE email = 'priya@savio.demo' LIMIT 1;
  
  -- If not found, we can still create the profile but leave auth_user_id null until we fix it.
  -- But in Supabase the auth.users should be seeded via script beforehand.

  INSERT INTO public.profiles (id, auth_user_id, email, full_name, avatar, life_stage, city, monthly_income_gross, monthly_income_net, anchor_day_of_month, income_pattern, primary_bank)
  VALUES (
    v_user_id,
    v_auth_id,
    'priya@savio.demo',
    'Priya Sharma',
    'strategist',
    'supporting_dependents',
    'Bangalore',
    85000.00,
    68500.00,
    1,
    'regular_salaried',
    'HDFC'
  )
  ON CONFLICT (id) DO UPDATE SET auth_user_id = v_auth_id;

  -- Commitments — 13 FIXED (mini-accounts where actual == budgeted) +
  -- 3 VARIABLE (Phase 3 added; budgets that the user tries to stay within).
  -- Variable commitments get FIXED UUIDs so the second DO block (transactions)
  -- can reference them by lookup without parsing back. Total non-investing
  -- monthly outflow stays ₹47,468 in the safe-to-spend formula — variable
  -- commitments are informational budgets WITHIN the discretionary bucket,
  -- they do NOT subtract from safe-to-spend.
  INSERT INTO public.commitments (id, user_id, label, amount, frequency, category, kind) VALUES
    -- Fixed commitments (13) — actual == budgeted, no buffer/overrun
    (gen_random_uuid(), v_user_id, 'Rent',              22000.00, 'monthly', 'Housing',       'fixed'),
    (gen_random_uuid(), v_user_id, 'Personal Loan EMI',  8500.00, 'monthly', 'Debt',          'fixed'),
    (gen_random_uuid(), v_user_id, 'SIP Mutual Fund 1', 10000.00, 'monthly', 'Investing',     'fixed'),
    (gen_random_uuid(), v_user_id, 'SIP Mutual Fund 2',  5000.00, 'monthly', 'Investing',     'fixed'),
    (gen_random_uuid(), v_user_id, 'Parents Support',    8000.00, 'monthly', 'Family',        'fixed'),
    (gen_random_uuid(), v_user_id, 'Term Insurance',      950.00, 'monthly', 'Insurance',     'fixed'),
    (gen_random_uuid(), v_user_id, 'Health Insurance',   1400.00, 'monthly', 'Insurance',     'fixed'),
    (gen_random_uuid(), v_user_id, 'Broadband',          1000.00, 'monthly', 'Utilities',     'fixed'),
    (gen_random_uuid(), v_user_id, 'Electricity (Avg)',  1800.00, 'monthly', 'Utilities',     'fixed'),
    (gen_random_uuid(), v_user_id, 'Gym',                2200.00, 'monthly', 'Health',        'fixed'),
    (gen_random_uuid(), v_user_id, 'Spotify',             119.00, 'monthly', 'Entertainment', 'fixed'),
    (gen_random_uuid(), v_user_id, 'Netflix',             499.00, 'monthly', 'Entertainment', 'fixed'),
    (gen_random_uuid(), v_user_id, 'Maid/Helper',        1000.00, 'monthly', 'Housing',       'fixed'),
    -- Variable commitments (3) — Phase 3 added. Budgets within discretionary,
    -- NOT subtracted from safe-to-spend. Buffer/overrun is the case-study story.
    ('d0000000-0000-4000-a000-000000000001', v_user_id, 'Groceries',   6000.00, 'monthly', 'Groceries', 'variable'),
    ('d0000000-0000-4000-a000-000000000002', v_user_id, 'Eating out',  5500.00, 'monthly', 'Food',      'variable'),
    ('d0000000-0000-4000-a000-000000000003', v_user_id, 'Transport',   5500.00, 'monthly', 'Transport', 'variable')
  ON CONFLICT DO NOTHING;

  -- Goals (3 rows)
  INSERT INTO public.goals (id, user_id, label, target_amount, current_amount, target_date, monthly_contribution, priority) VALUES
    ('c0000000-0000-4000-a000-000000000001', v_user_id, 'Phone fund', 35000.00, 8000.00, '2026-08-01', 4000.00, 1),
    ('c0000000-0000-4000-a000-000000000002', v_user_id, 'Emergency fund', 300000.00, 184000.00, '2028-01-01', 2000.00, 2),
    ('c0000000-0000-4000-a000-000000000003', v_user_id, 'Goa trip', 25000.00, 3000.00, '2026-12-01', 3000.00, 3)
  ON CONFLICT DO NOTHING;

END $$;

-- TRANSACTIONS AND REFLECTIONS
-- Generate ~250 random discretionary transactions over 6 months ending
-- DEMO_TODAY. Earlier seed used 600, but the resulting ~₹30K/month of debits
-- was unrealistic for a ₹68.5K-net-income earner (44% on discretionary).
-- 250 brings it to ~₹13K/month — closer to realistic 20-25% discretionary
-- share — and produces a positive net leftover for the monthly ritual rollover.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-a000-000000000001';
  v_demo_today date := '2026-05-01'::date;
  v_start_date date := v_demo_today - interval '180 days';
  v_txn_id uuid;
  v_diwali_bonus_id uuid := gen_random_uuid();
  v_tax_refund_id uuid := gen_random_uuid();
  v_merchant text;
  v_amount numeric;
  v_direction text;
  v_is_significant boolean;
  v_cat text;
  -- Phase 3 additions
  v_commitment record;
  v_pay_day int;
  v_payee text;
  v_groceries_id uuid;
  v_eating_out_id uuid;
  v_transport_id uuid;
BEGIN
  -- Lock the random sequence so every reseed produces identical transaction
  -- amounts, dates, and merchant selections. Doc 1.1 added — keeps the
  -- canonical demo numbers stable across reseeds. Pick a value once and
  -- never change it (changing breaks every screenshot taken at this point).
  PERFORM setseed(0.42);

  -- Insert ~250 small discretionary transactions (groceries, transport, food delivery, coffee)
  FOR i IN 1..250 LOOP
    -- Pick a random date
    v_merchant := CASE (random() * 5)::int 
      WHEN 0 THEN 'Swiggy' 
      WHEN 1 THEN 'Uber' 
      WHEN 2 THEN 'Blinkit' 
      WHEN 3 THEN 'Starbucks' 
      WHEN 4 THEN 'Amazon' 
      ELSE 'UPI/Local Vendor' 
    END;
    
    v_amount := round((random() * 500 + 50)::numeric, 2);
    v_cat := CASE v_merchant 
      WHEN 'Swiggy' THEN 'Food' 
      WHEN 'Uber' THEN 'Transport' 
      WHEN 'Blinkit' THEN 'Groceries'
      ELSE 'Other'
    END;
    
    INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, description, category, is_significant)
    VALUES (
      gen_random_uuid(),
      v_user_id,
      v_start_date + (random() * 180 || ' days')::interval + (random() * 24 || ' hours')::interval,
      v_amount,
      'debit',
      v_merchant,
      'Regular spend',
      v_cat,
      false
    );
  END LOOP;

  -- Insert Salary (1st of each month for 6 months)
  FOR i IN 0..5 LOOP
    INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, description, category)
    VALUES (
      gen_random_uuid(),
      v_user_id,
      date_trunc('month', v_demo_today - (i || ' months')::interval),
      68500.00,
      'credit',
      'Acme Corp Salary',
      'Monthly Salary',
      'Income'
    );
  END LOOP;

  -- Diwali Bonus (October 2025 relative date -> ~6 months ago relative to May 1)
  -- 2026-05-01 minus 6 months = 2025-11-01. Adjusted offset keeps it in early Nov 2025.
  -- The spec: "Diwali bonus ₹50,000 in Oct/Nov 2025 relative date"
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, description, category, is_significant)
  VALUES (v_diwali_bonus_id, v_user_id, (v_demo_today - interval '5 months 26 days')::timestamptz, 50000.00, 'credit', 'Acme Corp', 'Diwali Bonus', 'Income', true);

  -- Tax Refund (March 2026 relative date -> ~1 month ago)
  -- The spec: "tax refund ₹6,200 in March 2026 relative date"
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, description, category, is_significant)
  VALUES (v_tax_refund_id, v_user_id, (v_demo_today - interval '1 month 7 days')::timestamptz, 6200.00, 'credit', 'Income Tax Dept', 'Tax Refund', 'Income', true);

  -- Windfalls pending allocation
  INSERT INTO public.windfalls (user_id, transaction_id, amount, detected_at, status) VALUES
    (v_user_id, v_diwali_bonus_id, 50000.00, (v_demo_today - interval '5 months 26 days')::timestamptz, 'pending_allocation'),
    (v_user_id, v_tax_refund_id, 6200.00, (v_demo_today - interval '1 month 7 days')::timestamptz, 'pending_allocation');

  -- Pre-labeled reflection corpus (9 rows, spread Nov 2025 → March 2026).
  -- Doc 1.1: redistributed from the previous 5-in-April layout so:
  --   - April has NO pre-labeled high-impact (those become ritual-labeling candidates)
  --   - Aggregated regret-rate (Doc 2) has enough corpus to be statistically interesting
  --   - Pattern: Myntra 100% regret (4/4), Zara 100% regret (2/2), Amazon 50% (1/2), Swiggy neutral (1/1)

  -- 1. Myntra regret — Nov 12, 2025  (~5.5 months ago)
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '5 months 19 days')::timestamptz, 3200, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 2. Myntra regret — Dec 8, 2025
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '4 months 23 days')::timestamptz, 4500, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 3. Amazon regret — Dec 22, 2025
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '4 months 9 days')::timestamptz, 2100, 'debit', 'Amazon', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 4. Myntra regret — Jan 18, 2026
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '3 months 13 days')::timestamptz, 2800, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 5. Zara regret — Jan 25, 2026
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '3 months 6 days')::timestamptz, 2500, 'debit', 'Zara', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 6. Myntra regret — Feb 14, 2026
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '2 months 15 days')::timestamptz, 3600, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 7. Zara regret — Feb 22, 2026
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '2 months 7 days')::timestamptz, 1800, 'debit', 'Zara', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 8. Amazon glad — Mar 10, 2026  (the contrast — useful purchase Priya was happy with)
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '1 month 21 days')::timestamptz, 1500, 'debit', 'Amazon', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'glad');

  -- 9. Swiggy neutral — Mar 28, 2026  (low-stakes daily-life txn; pattern noise)
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, (v_demo_today - interval '1 month 3 days')::timestamptz, 450, 'debit', 'Swiggy', 'Food', false);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'neutral');

  -- April unlabeled high-impact transactions (NOT in reflections).
  -- These are what the ritual close-out's "Looking back" prompts surface.
  -- Doc 1.1: one ₹4,000+ and one ₹1,500+, both commitment_id NULL (discretionary).
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (gen_random_uuid(), v_user_id, (v_demo_today - interval '13 days')::timestamptz, 4800, 'debit', 'Myntra',  'Shopping', true);
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (gen_random_uuid(), v_user_id, (v_demo_today - interval '9 days')::timestamptz,  1950, 'debit', 'Amazon', 'Shopping', true);

  -- Update merchant stats explicitly for demo certainty.
  -- Numbers reflect the labeled corpus above (NOT all merchant txns — just labeled).
  INSERT INTO public.merchant_stats (user_id, merchant, total_transactions, total_labeled, glad_count, regret_count, neutral_count, regret_rate)
  VALUES
    (v_user_id, 'Myntra', 4, 4, 0, 4, 0, 100.00),
    (v_user_id, 'Amazon', 2, 2, 1, 1, 0,  50.00),
    (v_user_id, 'Zara',   2, 2, 0, 2, 0, 100.00),
    (v_user_id, 'Swiggy', 1, 1, 0, 0, 1,   0.00);

  -- Monthly Rituals (Jan/Feb/Mar 2026 completed, April pending)
  INSERT INTO public.monthly_rituals (user_id, month_year, status, income_confirmed, safe_to_spend_locked) VALUES
    (v_user_id, '2026-01', 'completed', 68500, 12000),
    (v_user_id, '2026-02', 'completed', 68500, 11500),
    (v_user_id, '2026-03', 'completed', 68500, 12200),
    (v_user_id, '2026-04', 'pending', null, null);

  ------------------------------------------------------------------
  -- PHASE 3 — Commitment linkage backfill
  ------------------------------------------------------------------
  -- 1. Variable commitments: backfill existing random transactions
  --    via category + merchant match. Only Blinkit/Swiggy/Uber get
  --    linked; Starbucks/Amazon/UPI/Local Vendor stay NULL (truly
  --    discretionary).

  SELECT id INTO v_groceries_id  FROM public.commitments
    WHERE user_id = v_user_id AND label = 'Groceries';
  SELECT id INTO v_eating_out_id FROM public.commitments
    WHERE user_id = v_user_id AND label = 'Eating out';
  SELECT id INTO v_transport_id  FROM public.commitments
    WHERE user_id = v_user_id AND label = 'Transport';

  UPDATE public.transactions SET commitment_id = v_groceries_id
    WHERE user_id = v_user_id AND category = 'Groceries' AND merchant = 'Blinkit';

  UPDATE public.transactions SET commitment_id = v_eating_out_id
    WHERE user_id = v_user_id AND category = 'Food' AND merchant = 'Swiggy';

  UPDATE public.transactions SET commitment_id = v_transport_id
    WHERE user_id = v_user_id AND category = 'Transport' AND merchant = 'Uber';

  -- Doc 1.1 — explicit April Eating out transactions to push actual past
  -- the ₹5,500 budget (creates the visual red overrun pill in close-out
  -- against the green buffers on Groceries + Transport). Total: ~₹5,150
  -- on top of the random Swiggy share (~₹1,177 deterministic from setseed),
  -- landing actual ~₹6,327 → overrun ~₹827.
  INSERT INTO public.transactions (id, user_id, commitment_id, occurred_at, amount, direction, merchant, description, category)
  VALUES
    (gen_random_uuid(), v_user_id, v_eating_out_id, (v_demo_today - interval '27 days')::timestamptz,  890, 'debit', 'Zomato',         'Sunday lunch order',    'Food'),
    (gen_random_uuid(), v_user_id, v_eating_out_id, (v_demo_today - interval '20 days')::timestamptz, 1650, 'debit', 'Toit',            'Saturday outing',       'Food'),
    (gen_random_uuid(), v_user_id, v_eating_out_id, (v_demo_today - interval '14 days')::timestamptz,  720, 'debit', 'Swiggy',          'Weeknight dinner',      'Food'),
    (gen_random_uuid(), v_user_id, v_eating_out_id, (v_demo_today - interval '11 days')::timestamptz, 1200, 'debit', 'Mainland China',  'Mid-week dinner out',   'Food'),
    (gen_random_uuid(), v_user_id, v_eating_out_id, (v_demo_today - interval '5 days')::timestamptz,   690, 'debit', 'Swiggy',          'Sunday lunch',          'Food');

  -- 2. Fixed commitments: insert one payment transaction per month per
  --    fixed commitment for 6 months. Each insert sets commitment_id
  --    directly. 13 fixed × 6 months = 78 new transactions.
  --    Per-commitment payment days + payee names below are illustrative
  --    and don't affect rollover math (actual == budgeted, buffer = 0).

  FOR v_commitment IN
    SELECT id, label, amount, category
      FROM public.commitments
      WHERE user_id = v_user_id AND kind = 'fixed'
  LOOP
    v_pay_day := CASE v_commitment.label
      WHEN 'Rent'              THEN 1
      WHEN 'Gym'               THEN 2
      WHEN 'Parents Support'   THEN 3
      WHEN 'Personal Loan EMI' THEN 5
      WHEN 'SIP Mutual Fund 1' THEN 7
      WHEN 'SIP Mutual Fund 2' THEN 7
      WHEN 'Broadband'         THEN 10
      WHEN 'Spotify'           THEN 12
      WHEN 'Netflix'           THEN 14
      WHEN 'Term Insurance'    THEN 15
      WHEN 'Health Insurance'  THEN 15
      WHEN 'Electricity (Avg)' THEN 18
      WHEN 'Maid/Helper'       THEN 28
      ELSE 1
    END;
    v_payee := CASE v_commitment.label
      WHEN 'Rent'              THEN 'Landlord (HDFC NEFT)'
      WHEN 'Personal Loan EMI' THEN 'HDFC Bank Loan EMI'
      WHEN 'SIP Mutual Fund 1' THEN 'Zerodha Coin'
      WHEN 'SIP Mutual Fund 2' THEN 'Zerodha Coin'
      WHEN 'Parents Support'   THEN 'Parents (UPI)'
      WHEN 'Term Insurance'    THEN 'LIC India'
      WHEN 'Health Insurance'  THEN 'Star Health'
      WHEN 'Broadband'         THEN 'ACT Fibernet'
      WHEN 'Electricity (Avg)' THEN 'BESCOM'
      WHEN 'Gym'               THEN 'Cult.fit'
      WHEN 'Spotify'           THEN 'Spotify Premium'
      WHEN 'Netflix'           THEN 'Netflix'
      WHEN 'Maid/Helper'       THEN 'Domestic Help'
      ELSE v_commitment.label
    END;

    FOR i IN 0..5 LOOP
      INSERT INTO public.transactions (id, user_id, commitment_id, occurred_at, amount, direction, merchant, description, category, is_recurring, source)
      VALUES (
        gen_random_uuid(),
        v_user_id,
        v_commitment.id,
        (date_trunc('month', v_demo_today - (i || ' months')::interval)
          + (v_pay_day - 1) * interval '1 day'
          + interval '10 hours')::timestamptz,
        v_commitment.amount,
        'debit',
        v_payee,
        'Monthly ' || v_commitment.label || ' payment',
        v_commitment.category,
        true,
        'seeded_demo'
      );
    END LOOP;
  END LOOP;

END $$;
