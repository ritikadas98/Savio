import React, { useState } from 'react';
import type { ReviewerActionResult } from '../../lib/reviewer-actions';

type ResetActionRowProps = {
  title: string;
  description: string;
  buttonLabel: string;
  confirmCopy: string;
  onConfirm: () => Promise<ReviewerActionResult>;
};

/**
 * Internal sub-component used only by ReviewerConsole. Two-tap interaction:
 *   1. Tap "Reset" → button turns red, confirmCopy appears, label becomes "Confirm Reset"
 *   2. Tap again → RPC fires, button shows "Running…", result message displays inline
 *
 * Result message persists until the user re-enters the row (next tap restarts).
 */
export function ResetActionRow({ title, description, buttonLabel, confirmCopy, onConfirm }: ResetActionRowProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ status: string; message: string } | null>(null);

  const handleClick = async () => {
    if (lastResult) {
      // After a result, the next tap returns to default state
      setLastResult(null);
      return;
    }
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    setIsRunning(true);
    try {
      const result = await onConfirm();
      setLastResult({ status: result.status, message: result.message });
    } catch (err) {
      setLastResult({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsRunning(false);
      setIsConfirming(false);
    }
  };

  const isError = lastResult?.status === 'error';
  // The "this was already a no-op" branches: still success, but worth a softer color
  const isNoOp = lastResult && ['already_pending', 'not_found', 'no_snapshot'].includes(lastResult.status);

  const buttonText = isRunning
    ? 'Running…'
    : lastResult
      ? 'Done'
      : isConfirming
        ? `Confirm ${buttonLabel.toLowerCase()}`
        : buttonLabel;

  const buttonClass = isRunning || lastResult
    ? 'bg-[#8B948E]/30 text-[#5A6B5F] cursor-default'
    : isConfirming
      ? 'bg-[#791F1F] text-white hover:bg-[#791F1F]/90'
      : 'bg-[#0C447C] text-white hover:bg-[#0C447C]/90';

  return (
    <div className="border-t border-black/[0.07] pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#1A1A1A]">{title}</h3>
          <p className="text-sm text-[#5A6B5F] mt-1 leading-relaxed">{description}</p>
          {isConfirming && !lastResult && (
            <p className="text-sm text-[#791F1F] mt-2 italic leading-relaxed">{confirmCopy}</p>
          )}
          {lastResult && (
            <p
              className={`text-sm mt-2 leading-relaxed ${
                isError ? 'text-[#791F1F]' : isNoOp ? 'text-[#5A6B5F]' : 'text-[#2D5016]'
              }`}
            >
              {lastResult.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isRunning}
          className={`flex-shrink-0 min-w-[88px] px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${buttonClass}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
