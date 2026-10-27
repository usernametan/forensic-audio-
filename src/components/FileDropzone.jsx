import { useRef, useState } from 'react';
import { UploadCloud, FileAudio, X, Loader2, Info } from 'lucide-react';
import { ACCEPTED_AUDIO_ACCEPT, ACCEPTED_AUDIO_EXTENSIONS } from '../data/constants';
import { formatBytes } from '../utils/format';

export default function FileDropzone({
  id,
  label,
  description,
  file,
  onFile,
  onRemove,
  disabled = false,
  busy = false,
  busyLabel = 'Processing file…',
  compact = false,
  help,
  children,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div className={`dropzone-wrap ${compact ? 'compact' : ''}`.trim()}>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''} ${disabled ? 'is-disabled' : ''}`.trim()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={file ? `Replace ${file.name}` : label}
        aria-disabled={disabled || busy}
      >
        <span className="upload-icon" aria-hidden="true">
          {busy ? <Loader2 size={compact ? 20 : 26} className="spin" /> : file ? <FileAudio size={compact ? 20 : 26} /> : <UploadCloud size={compact ? 20 : 26} />}
        </span>
        <div className="upload-copy">
          <p className="upload-title">
            {busy ? busyLabel : file ? file.name : label}
          </p>
          <p className="upload-hint">
            {busy
              ? 'Please wait — this operation has not completed yet.'
              : file
                ? `${formatBytes(file.size)} · select or drop another file to replace`
                : description || `Drop audio here or browse · ${ACCEPTED_AUDIO_EXTENSIONS.join(' / ')}`}
          </p>
        </div>
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={ACCEPTED_AUDIO_ACCEPT}
          hidden
          onChange={(event) => {
            const next = event.target.files?.[0];
            event.target.value = '';
            if (next) onFile(next);
          }}
        />
      </div>

      {file && !busy && (
        <div className="file-chip-row">
          <div className="file-chip">
            <FileAudio size={14} aria-hidden="true" />
            <span className="mono truncate" title={file.name}>{file.name}</span>
            <span className="file-chip-size">{formatBytes(file.size)}</span>
            {onRemove && (
              <button
                type="button"
                className="chip-x"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
                aria-label={`Remove ${file.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
      {help && (
        <p className="field-help field-help-icon">
          <Info size={12} aria-hidden="true" /> <span>{help}</span>
        </p>
      )}
      {children}
    </div>
  );
}
