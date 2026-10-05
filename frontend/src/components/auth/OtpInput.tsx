// ============================================================================
// File: frontend/src/components/auth/OtpInput.tsx
// Description: 6-digit individual digit input box component with auto-focus
// ============================================================================

import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1); // Take last typed char
    if (!/^\d*$/.test(char)) return; // Allow numbers only

    const newOtp = value.split('');
    newOtp[index] = char;
    const combined = newOtp.join('');
    onChange(combined);

    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d+$/.test(pasted)) {
      const sliced = pasted.slice(0, length);
      onChange(sliced);
      const targetIndex = Math.min(sliced.length, length - 1);
      inputsRef.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-11 h-13 text-center text-xl font-bold font-mono bg-white border-2 border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none transition-all disabled:bg-slate-50"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};
