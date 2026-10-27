import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(() => {});
let nextId = 0;

const ICONS = {
  success: <CheckCircle2 size={16} />,
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <XCircle size={16} />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = 'info') => {
      const normalizedType = type === 'warn' ? 'warning' : type;
      const id = ++nextId;
      setToasts((list) => [...list.slice(-3), { id, message, type: normalizedType }]);
      window.setTimeout(() => dismiss(id), 4600);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon" aria-hidden="true">
              {ICONS[toast.type] || ICONS.info}
            </span>
            <span className="toast-msg">{toast.message}</span>
            <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
