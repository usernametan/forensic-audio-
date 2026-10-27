import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', className = '' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={`copy-btn ${className}`.trim()} onClick={copy} disabled={!value}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
