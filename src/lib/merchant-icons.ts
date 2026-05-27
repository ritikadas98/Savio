import {
  Coffee,
  ShoppingBag,
  ShoppingCart,
  Package,
  Car,
  Receipt,
  Tv,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// Phase B2: extracted from RecentTransactionsList per Doc 1.16. Substring
// match against merchant name, order-matters (earlier entries win). Fallback
// Receipt for unknown merchants. Reused by Reflect's UnlabeledTxCard.
const MERCHANT_ICON_MAP: Array<{ keyword: string; icon: LucideIcon }> = [
  { keyword: 'swiggy',    icon: Coffee },
  { keyword: 'zomato',    icon: Coffee },
  { keyword: 'starbucks', icon: Coffee },
  { keyword: 'myntra',    icon: ShoppingBag },
  { keyword: 'zara',      icon: ShoppingBag },
  { keyword: 'amazon',    icon: Package },
  { keyword: 'flipkart',  icon: Package },
  { keyword: 'uber',      icon: Car },
  { keyword: 'ola',       icon: Car },
  { keyword: 'rapido',    icon: Car },
  { keyword: 'blinkit',   icon: ShoppingCart },
  { keyword: 'zepto',     icon: ShoppingCart },
  { keyword: 'instamart', icon: ShoppingCart },
  { keyword: 'netflix',   icon: Tv },
  { keyword: 'spotify',   icon: Tv },
  { keyword: 'salary',    icon: Sparkles },
  { keyword: 'bonus',     icon: Sparkles },
  { keyword: 'refund',    icon: Sparkles },
];

export function getMerchantIcon(merchant: string | null | undefined): LucideIcon {
  if (!merchant) return Receipt;
  const lower = merchant.toLowerCase();
  for (const { keyword, icon } of MERCHANT_ICON_MAP) {
    if (lower.includes(keyword)) return icon;
  }
  return Receipt;
}
