import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function CategorizationBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      const { count: c } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .is('category', null);
      if (!cancelled) setCount(c ?? 0);
    }
    fetchCount();
    return () => { cancelled = true; };
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#E4ECE6]/60 text-sm mb-3">
      <div className="flex items-center gap-2 text-[#0C447C]">
        <Tag size={16} />
        <span>{count} transactions need categorization</span>
      </div>
      <span className="text-xs italic text-[#5A6B5F]">coming in V2</span>
    </div>
  );
}
