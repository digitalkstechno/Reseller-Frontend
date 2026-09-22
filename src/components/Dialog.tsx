'use client';

import { useEffect, useState, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Dialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
}: DialogProps) {
  const sizeClasses = {
    sm: 'md:w-1/4 md:max-w-[25vw]',
    md: 'md:w-1/3 md:max-w-[40vw]',
    lg: 'md:w-1/2 md:max-w-[50vw]',
    xl: 'md:w-2/3 md:max-w-[75vw]',
  };
  const [mounted, setMounted] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
      const t = setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(t);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleBackdropClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop - no blur for GPU performance */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={handleBackdropClose}
      />

      {/* Sliding Dialog - GPU-accelerated via translate3d */}
      <div
        style={{ willChange: 'transform' }}
        className={`
          relative h-full w-full ${sizeClasses[size]} bg-white shadow-2xl flex flex-col
          animate-in slide-in-from-right duration-200 ease-out
        `}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-secondary px-6 py-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>

          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/50"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}



interface CenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function CenterDialog({
  isOpen,
  onClose,
  children,
}: CenterDialogProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
    >
      {/* Backdrop - no blur for GPU performance */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
      />

      {/* Center Modal - GPU-accelerated */}
      <div
        style={{ willChange: 'transform, opacity' }}
        className={`relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 transition-all duration-200 ease-out
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content Only */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}