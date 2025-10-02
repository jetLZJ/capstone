import { useEffect } from 'react';

export default function Modal({ children, onClose, className = '' }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => {
      if (e.key === 'Escape' && typeof onClose === 'function') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && typeof onClose === 'function') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color:rgba(6,6,20,0.45)] p-4"
      onClick={handleBackdrop}
    >
      <div className={`w-full max-w-4xl h-[90vh] overflow-hidden rounded-3xl ${className}`}>
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </div>
    </div>
  );
}
