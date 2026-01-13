import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DarkMessageModalProps {
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'error' | 'warning' | 'info' | 'success';
  autoCloseDelay?: number; // Auto-close delay in milliseconds
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
  autoCloseDelay
}) => {
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
    onConfirm?.();
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
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center animate-fade-in" onClick={handleCancel}>
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
        </div>
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
          {type === 'confirm' && (
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
let modalRoot: HTMLElement | null = null;

const getModalRoot = () => {
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'dark-modal-root';
    document.body.appendChild(modalRoot);
  }
  return modalRoot;
};

export const showDarkAlert = (message: string, title: string = 'Notice', variant: 'error' | 'warning' | 'info' | 'success' = 'info'): Promise<void> => {
  return new Promise((resolve) => {
    const Modal = () => {
      const [isVisible, setIsVisible] = useState(true);

      const handleConfirm = () => {
        setIsVisible(false);
        setTimeout(resolve, 300);
      };

      if (!isVisible) return null;

      return createPortal(
        <DarkMessageModal
          type="alert"
          title={title}
          message={message}
          onConfirm={handleConfirm}
          variant={variant}
        />,
        getModalRoot()
      );
    };

    const modalElement = React.createElement(Modal);
    
    // Create a temporary React root to render the modal
    // @ts-ignore - dynamic import for React 18 createRoot
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(getModalRoot());
      root.render(modalElement);
    });
  });
};

export const showDarkConfirm = (message: string, title: string = 'Confirm Action', variant: 'error' | 'warning' | 'info' | 'success' = 'info'): Promise<boolean> => {
  return new Promise((resolve) => {
    const Modal = () => {
      const [isVisible, setIsVisible] = useState(true);

      const handleConfirm = () => {
        setIsVisible(false);
        setTimeout(() => resolve(true), 300);
      };

      const handleCancel = () => {
        setIsVisible(false);
        setTimeout(() => resolve(false), 300);
      };

      if (!isVisible) return null;

      return createPortal(
        <DarkMessageModal
          type="confirm"
          title={title}
          message={message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          variant={variant}
        />,
        getModalRoot()
      );
    };

    const modalElement = React.createElement(Modal);
    
    // Create a temporary React root to render the modal
    // @ts-ignore - dynamic import for React 18 createRoot
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(getModalRoot());
      root.render(modalElement);
    });
  });
};

export default DarkMessageModal;