-- 0007_fix_rls_policies.sql

-- 1. commitments
DROP POLICY IF EXISTS "users read own commitments" ON public.commitments;
DROP POLICY IF EXISTS "users insert own commitments" ON public.commitments;
DROP POLICY IF EXISTS "users update own commitments" ON public.commitments;
DROP POLICY IF EXISTS "users delete own commitments" ON public.commitments;

CREATE POLICY "users read own commitments" ON public.commitments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = commitments.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own commitments" ON public.commitments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = commitments.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own commitments" ON public.commitments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = commitments.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own commitments" ON public.commitments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = commitments.user_id AND auth_user_id = auth.uid())
);

-- 2. goals
DROP POLICY IF EXISTS "users read own goals" ON public.goals;
DROP POLICY IF EXISTS "users insert own goals" ON public.goals;
DROP POLICY IF EXISTS "users update own goals" ON public.goals;
DROP POLICY IF EXISTS "users delete own goals" ON public.goals;

CREATE POLICY "users read own goals" ON public.goals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = goals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own goals" ON public.goals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = goals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own goals" ON public.goals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = goals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own goals" ON public.goals FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = goals.user_id AND auth_user_id = auth.uid())
);

-- 3. transactions
DROP POLICY IF EXISTS "users read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "users insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "users update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "users delete own transactions" ON public.transactions;

CREATE POLICY "users read own transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = transactions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own transactions" ON public.transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = transactions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own transactions" ON public.transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = transactions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own transactions" ON public.transactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = transactions.user_id AND auth_user_id = auth.uid())
);

-- 4. reflections
DROP POLICY IF EXISTS "users read own reflections" ON public.reflections;
DROP POLICY IF EXISTS "users insert own reflections" ON public.reflections;
DROP POLICY IF EXISTS "users update own reflections" ON public.reflections;
DROP POLICY IF EXISTS "users delete own reflections" ON public.reflections;

CREATE POLICY "users read own reflections" ON public.reflections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = reflections.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own reflections" ON public.reflections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = reflections.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own reflections" ON public.reflections FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = reflections.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own reflections" ON public.reflections FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = reflections.user_id AND auth_user_id = auth.uid())
);

-- 5. merchant_stats
DROP POLICY IF EXISTS "users read own merchant_stats" ON public.merchant_stats;
DROP POLICY IF EXISTS "users insert own merchant_stats" ON public.merchant_stats;
DROP POLICY IF EXISTS "users update own merchant_stats" ON public.merchant_stats;
DROP POLICY IF EXISTS "users delete own merchant_stats" ON public.merchant_stats;

CREATE POLICY "users read own merchant_stats" ON public.merchant_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = merchant_stats.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own merchant_stats" ON public.merchant_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = merchant_stats.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own merchant_stats" ON public.merchant_stats FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = merchant_stats.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own merchant_stats" ON public.merchant_stats FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = merchant_stats.user_id AND auth_user_id = auth.uid())
);

-- 6. monthly_rituals
DROP POLICY IF EXISTS "users read own monthly_rituals" ON public.monthly_rituals;
DROP POLICY IF EXISTS "users insert own monthly_rituals" ON public.monthly_rituals;
DROP POLICY IF EXISTS "users update own monthly_rituals" ON public.monthly_rituals;
DROP POLICY IF EXISTS "users delete own monthly_rituals" ON public.monthly_rituals;

CREATE POLICY "users read own monthly_rituals" ON public.monthly_rituals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = monthly_rituals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own monthly_rituals" ON public.monthly_rituals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = monthly_rituals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own monthly_rituals" ON public.monthly_rituals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = monthly_rituals.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own monthly_rituals" ON public.monthly_rituals FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = monthly_rituals.user_id AND auth_user_id = auth.uid())
);

-- 7. windfalls
DROP POLICY IF EXISTS "users read own windfalls" ON public.windfalls;
DROP POLICY IF EXISTS "users insert own windfalls" ON public.windfalls;
DROP POLICY IF EXISTS "users update own windfalls" ON public.windfalls;
DROP POLICY IF EXISTS "users delete own windfalls" ON public.windfalls;

CREATE POLICY "users read own windfalls" ON public.windfalls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = windfalls.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own windfalls" ON public.windfalls FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = windfalls.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own windfalls" ON public.windfalls FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = windfalls.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own windfalls" ON public.windfalls FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = windfalls.user_id AND auth_user_id = auth.uid())
);

-- 8. chat_messages
DROP POLICY IF EXISTS "users read own chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users insert own chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users update own chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "users delete own chat_messages" ON public.chat_messages;

CREATE POLICY "users read own chat_messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = chat_messages.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = chat_messages.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own chat_messages" ON public.chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = chat_messages.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own chat_messages" ON public.chat_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = chat_messages.user_id AND auth_user_id = auth.uid())
);

-- 9. saved_decisions
DROP POLICY IF EXISTS "users read own saved_decisions" ON public.saved_decisions;
DROP POLICY IF EXISTS "users insert own saved_decisions" ON public.saved_decisions;
DROP POLICY IF EXISTS "users update own saved_decisions" ON public.saved_decisions;
DROP POLICY IF EXISTS "users delete own saved_decisions" ON public.saved_decisions;

CREATE POLICY "users read own saved_decisions" ON public.saved_decisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = saved_decisions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users insert own saved_decisions" ON public.saved_decisions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = saved_decisions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users update own saved_decisions" ON public.saved_decisions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = saved_decisions.user_id AND auth_user_id = auth.uid())
);
CREATE POLICY "users delete own saved_decisions" ON public.saved_decisions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = saved_decisions.user_id AND auth_user_id = auth.uid())
);
