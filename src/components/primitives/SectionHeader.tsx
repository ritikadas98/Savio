import { cn } from '../../lib/utils';

type SectionHeaderProps = {
  title: string;
  /** Right-side affordance: "See all →" link, button, etc. */
  action?: React.ReactNode;
  /** uppercase = small-caps eyebrow style; default = sentence-case label */
  variant?: 'default' | 'uppercase';
  className?: string;
};

// Doc 1.16: spec is { padding: '12px 6px 4px', fontSize 13, color T.s, weight 500 }
// per preview line 335. The padding pulls the header inward when rendered above
// a card (outside-card usage like "For you today" / "Patterns this week"), and
// remains intentional when rendered inside a card.
export function SectionHeader({ title, action, variant = 'default', className }: SectionHeaderProps) {
  const titleStyle: React.CSSProperties =
    variant === 'uppercase'
      ? { fontSize: 11, color: '#5F5E5A', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }
      : { fontSize: 13, color: '#5F5E5A', fontWeight: 500 };

  return (
    <div
      className={cn('flex items-center justify-between', className)}
      style={{ padding: '12px 0 4px' }}
    >
      <h2 style={titleStyle}>{title}</h2>
      {action}
    </div>
  );
}
