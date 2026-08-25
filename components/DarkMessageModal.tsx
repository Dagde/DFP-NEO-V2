import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

type DarkMessageVariant = 'error' | 'warning' | 'info' | 'success';
type DarkMessageType = 'alert' | 'confirm' | 'prompt';

export interface DarkMessageModalProps {
  type: DarkMessageType;
  title: string;
  message: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: DarkMessageVariant;
  autoCloseDelay?: number; // Auto-close delay in milliseconds
  inputLabel?: string;
  inputType?: string;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
}

const DarkMessageModal: React.FC<DarkMessageModalProps> = ({
  type,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'info',
  autoCloseDelay,
  inputLabel,
  inputType = 'text',
  inputPlaceholder = '',
  inputDefaultValue = ''
}) => {
  const [inputValue, setInputValue] = useState(inputDefaultValue);

  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          borderColor: 'border-red-500/50',
          headerBg: 'bg-red-900/20',
          titleColor: 'text-red-400',
          iconColor: 'text-red-400',
          confirmBg: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          borderColor: 'border-amber-500/50',
          headerBg: 'bg-amber-900/20',
          titleColor: 'text-amber-400',
          iconColor: 'text-amber-400',
          confirmBg: 'bg-amber-600 hover:bg-amber-700'
        };
      case 'success':
        return {
          borderColor: 'border-green-500/50',
          headerBg: 'bg-green-900/20',
          titleColor: 'text-green-400',
          iconColor: 'text-green-400',
          confirmBg: 'bg-green-600 hover:bg-green-700'
        };
      default:
        return {
          borderColor: 'border-sky-500/50',
          headerBg: 'bg-sky-900/20',
          titleColor: 'text-sky-400',
          iconColor: 'text-sky-400',
          confirmBg: 'bg-sky-600 hover:bg-sky-700'
        };
    }
  };

  const styles = getVariantStyles();

  const getIcon = () => {
    switch (variant) {
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'success':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const handleConfirm = () => {
    onConfirm?.(type === 'prompt' ? inputValue : undefined);
  };

    // Auto-close functionality
    useEffect(() => {
      if (autoCloseDelay && autoCloseDelay > 0) {
        const timer = setTimeout(() => {
          handleConfirm();
        }, autoCloseDelay);

        return () => clearTimeout(timer);
      }
    }, [autoCloseDelay]);

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[10000] flex items-center justify-center animate-fade-in" onClick={handleCancel}>
      <div className={`bg-gray-800 rounded-lg shadow-xl w-full max-w-md border ${styles.borderColor}`} onClick={e => e.stopPropagation()}>
        <div className={`p-4 border-b border-gray-700 ${styles.headerBg} flex items-center space-x-3`}>
          <span className={styles.iconColor}>
            {getIcon()}
          </span>
          <h2 className={`text-xl font-bold ${styles.titleColor}`}>{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-300 whitespace-pre-line">
            {message}
          </p>
          {type === 'prompt' && (
            <div className="mt-4">
              {inputLabel && (
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {inputLabel}
                </label>
              )}
              <input
                autoFocus
                type={inputType}
                value={inputValue}
                placeholder={inputPlaceholder}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleConfirm();
                  if (event.key === 'Escape') handleCancel();
                }}
                className="w-full rounded-md border border-cyan-500/50 bg-gray-950 px-3 py-2 text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
          {(type === 'confirm' || type === 'prompt') && (
            <button 
              onClick={handleCancel} 
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className={`px-4 py-2 text-white rounded-md transition-colors text-sm font-semibold ${styles.confirmBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Utility functions for global use
const mountModal = (renderModal: (cleanup: () => void) => React.ReactElement) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const cleanup = () => {
    setTimeout(() => {
      root.unmount();
      host.remove();
    }, 300);
  };
  root.render(renderModal(cleanup));
};

export const showDarkAlert = (message: string, title: string = 'Notice', variant: DarkMessageVariant = 'info'): Promise<void> => {
  return new Promise((resolve) => {
    mountModal((cleanup) => {
      const Modal = () => {
      const [isVisible, setIsVisible] = useState(true);

      const handleConfirm = () => {
        setIsVisible(false);
        cleanup();
        setTimeout(resolve, 300);
      };

      if (!isVisible) return null;

      return (
        <DarkMessageModal
          type="alert"
          title={title}
          message={message}
          onConfirm={handleConfirm}
          variant={variant}
        />
      );
    };

      return <Modal />;
    });
  });
};

export const showDarkConfirm = (message: string, title: string = 'Confirm Action', variant: DarkMessageVariant = 'info'): Promise<boolean> => {
  return new Promise((resolve) => {
    mountModal((cleanup) => {
      const Modal = () => {
      const [isVisible, setIsVisible] = useState(true);

      const handleConfirm = () => {
        setIsVisible(false);
        cleanup();
        setTimeout(() => resolve(true), 300);
      };

      const handleCancel = () => {
        setIsVisible(false);
        cleanup();
        setTimeout(() => resolve(false), 300);
      };

      if (!isVisible) return null;

      return (
        <DarkMessageModal
          type="confirm"
          title={title}
          message={message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          variant={variant}
        />
      );
    };

      return <Modal />;
    });
  });
};

export interface DarkPromptOptions {
  title?: string;
  message: string;
  variant?: DarkMessageVariant;
  confirmText?: string;
  cancelText?: string;
  inputLabel?: string;
  inputType?: string;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
}

export const showDarkPrompt = ({
  title = 'Input Required',
  message,
  variant = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  inputLabel,
  inputType = 'text',
  inputPlaceholder = '',
  inputDefaultValue = '',
}: DarkPromptOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    mountModal((cleanup) => {
      const Modal = () => {
        const [isVisible, setIsVisible] = useState(true);

        const handleConfirm = (value?: string) => {
          setIsVisible(false);
          cleanup();
          setTimeout(() => resolve(value ?? ''), 300);
        };

        const handleCancel = () => {
          setIsVisible(false);
          cleanup();
          setTimeout(() => resolve(null), 300);
        };

        if (!isVisible) return null;

        return (
          <DarkMessageModal
            type="prompt"
            title={title}
            message={message}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            confirmText={confirmText}
            cancelText={cancelText}
            variant={variant}
            inputLabel={inputLabel}
            inputType={inputType}
            inputPlaceholder={inputPlaceholder}
            inputDefaultValue={inputDefaultValue}
          />
        );
      };

      return <Modal />;
    });
  });
};

export default DarkMessageModal;
