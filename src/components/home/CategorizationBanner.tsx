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
    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#E4ECE6]/60 mb-3">
      <div className="flex items-center gap-2" style={{ fontSize: 12.5, color: '#5F5E5A' }}>
        <Tag size={16} />
        <span>{count} transactions need categorization</span>
      </div>
      <span style={{ fontSize: 10, fontStyle: 'italic', color: '#888780' }}>coming in V2</span>
    </div>
  );
}
