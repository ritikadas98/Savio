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

  -- Commitments (13 rows, ~62,468 total as requested)
  INSERT INTO public.commitments (id, user_id, label, amount, frequency, category) VALUES
    (gen_random_uuid(), v_user_id, 'Rent', 22000.00, 'monthly', 'Housing'),
    (gen_random_uuid(), v_user_id, 'Personal Loan EMI', 8500.00, 'monthly', 'Debt'),
    (gen_random_uuid(), v_user_id, 'SIP Mutual Fund 1', 10000.00, 'monthly', 'Investing'),
    (gen_random_uuid(), v_user_id, 'SIP Mutual Fund 2', 5000.00, 'monthly', 'Investing'),
    (gen_random_uuid(), v_user_id, 'Parents Support', 8000.00, 'monthly', 'Family'),
    (gen_random_uuid(), v_user_id, 'Term Insurance', 950.00, 'monthly', 'Insurance'),
    (gen_random_uuid(), v_user_id, 'Health Insurance', 1400.00, 'monthly', 'Insurance'),
    (gen_random_uuid(), v_user_id, 'Broadband', 1000.00, 'monthly', 'Utilities'),
    (gen_random_uuid(), v_user_id, 'Electricity (Avg)', 1800.00, 'monthly', 'Utilities'),
    (gen_random_uuid(), v_user_id, 'Gym', 2200.00, 'monthly', 'Health'),
    (gen_random_uuid(), v_user_id, 'Spotify', 119.00, 'monthly', 'Entertainment'),
    (gen_random_uuid(), v_user_id, 'Netflix', 499.00, 'monthly', 'Entertainment'),
    (gen_random_uuid(), v_user_id, 'Maid/Helper', 1000.00, 'monthly', 'Housing')
  ON CONFLICT DO NOTHING;

  -- Goals (3 rows)
  INSERT INTO public.goals (id, user_id, label, target_amount, current_amount, target_date, monthly_contribution, priority) VALUES
    ('c0000000-0000-4000-a000-000000000001', v_user_id, 'Phone fund', 35000.00, 8000.00, '2026-08-01', 4000.00, 1),
    ('c0000000-0000-4000-a000-000000000002', v_user_id, 'Emergency fund', 300000.00, 184000.00, '2028-01-01', 2000.00, 2),
    ('c0000000-0000-4000-a000-000000000003', v_user_id, 'Goa trip', 25000.00, 3000.00, '2026-12-01', 3000.00, 3)
  ON CONFLICT DO NOTHING;

END $$;

-- TRANSACTIONS AND REFLECTIONS
-- We need ~600 transactions over 6 months ending DEMO_TODAY (2026-04-15).
-- Instead of generating all 600 individually, we will generate bulk transactions dynamically
-- using generate_series and random functions.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-a000-000000000001';
  v_demo_today date := '2026-04-15'::date;
  v_start_date date := v_demo_today - interval '180 days';
  v_txn_id uuid;
  v_diwali_bonus_id uuid := gen_random_uuid();
  v_tax_refund_id uuid := gen_random_uuid();
  v_merchant text;
  v_amount numeric;
  v_direction text;
  v_is_significant boolean;
  v_cat text;
BEGIN
  -- Insert regular ~600 small transactions (groceries, transport, food delivery, coffee)
  FOR i IN 1..600 LOOP
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

  -- Diwali Bonus (October 2025 relative date -> ~6 months ago relative to April)
  -- 2026-04-15 minus 6 months = 2025-10-15. Let's make it exactly Oct 20, 2025 relative.
  -- The spec: "Diwali bonus ₹50,000 in Oct 2025 relative date"
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

  -- Pre-labeled reflections (5 rows: 3 glad, 2 regret)
  -- 1. Glad - Myntra
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, v_demo_today - interval '10 days', 2500, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'glad');

  -- 2. Regret - Myntra
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, v_demo_today - interval '15 days', 3200, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 3. Regret - Myntra (to get 100% regret rate as requested in spec... wait, if I have 1 glad and 2 regrets, it's not 100%. Spec: "merchant_stats showing Myntra regret_rate=100 and Amazon regret_rate=0". I will adjust the first glad to something else.)
  UPDATE public.transactions SET merchant = 'Zara' WHERE id = (SELECT transaction_id FROM public.reflections WHERE label = 'glad' LIMIT 1);
  -- Now Myntra has 1 regret. Let's add another regret for Myntra.
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, v_demo_today - interval '20 days', 4500, 'debit', 'Myntra', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'regret');

  -- 4. Glad - Amazon
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, v_demo_today - interval '12 days', 1500, 'debit', 'Amazon', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'glad');

  -- 5. Glad - Amazon
  v_txn_id := gen_random_uuid();
  INSERT INTO public.transactions (id, user_id, occurred_at, amount, direction, merchant, category, is_significant)
  VALUES (v_txn_id, v_user_id, v_demo_today - interval '22 days', 800, 'debit', 'Amazon', 'Shopping', true);
  INSERT INTO public.reflections (user_id, transaction_id, label) VALUES (v_user_id, v_txn_id, 'glad');

  -- Update merchant stats explicitly for demo certainty
  INSERT INTO public.merchant_stats (user_id, merchant, total_transactions, total_labeled, glad_count, regret_count, neutral_count, regret_rate)
  VALUES 
    (v_user_id, 'Myntra', 2, 2, 0, 2, 0, 100.00),
    (v_user_id, 'Amazon', 2, 2, 2, 0, 0, 0.00);

  -- Monthly Rituals (Jan/Feb/Mar 2026 completed, April pending)
  INSERT INTO public.monthly_rituals (user_id, month_year, status, income_confirmed, safe_to_spend_locked) VALUES
    (v_user_id, '2026-01', 'completed', 68500, 12000),
    (v_user_id, '2026-02', 'completed', 68500, 11500),
    (v_user_id, '2026-03', 'completed', 68500, 12200),
    (v_user_id, '2026-04', 'pending', null, null);

END $$;
