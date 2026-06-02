
// Stream 0E: locked copy per master plan §2.5 #23. Non-italic, T.t color,
// centered, font size 12-13px per §2.5 #24. Master plan supersedes the prior
// italic Tailwind text-micro-tertiary treatment.
export function DisclaimerFooter() {
  return (
    <div className="text-center" style={{ paddingTop: 14, paddingBottom: 12 }}>
      <p style={{ fontSize: 12, color: '#888780', lineHeight: 1.4, margin: 0 }}>
        Savio is decision-support, not financial advice. Verify important calculations independently.
      </p>
    </div>
  );
}
