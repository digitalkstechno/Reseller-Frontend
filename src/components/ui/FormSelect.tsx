import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ChevronDown, X, Check } from "lucide-react";

// ─── Shared Types ──────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  color?: string;   // optional color dot for labels/tags
  disabled?: boolean;
}

// ─── Base border/ring utility ──────────────────────────────────────────────────

function getBorderClasses(hasError: boolean, isFocused: boolean, disabled: boolean): string {
  if (disabled) return "border-gray-200 bg-gray-50/50 opacity-60 cursor-not-allowed";
  if (hasError) return "border-red-500 ring-2 ring-red-50";
  if (isFocused) return "border-secondary ring-2 ring-blue-50";
  return "border-gray-200 hover:border-gray-400 shadow-sm hover:shadow-md";
}

// ─── Portal Dropdown Hook ──────────────────────────────────────────────────────
function useDropdownPosition(ref: React.RefObject<any>, isOpen: boolean) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return coords;
}

// ─── FormSelect (single) ───────────────────────────────────────────────────────

interface FormSelectProps {
  label?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e?: any) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Select option",
  error,
  required = false,
  disabled = false,
  helperText,
  icon,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const coords = useDropdownPosition(triggerRef, isOpen);

  const hasError = !!error;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        // Check if the click was inside the portal (options list)
        const portal = document.getElementById(`portal-${name || 'select'}`);
        if (portal && portal.contains(e.target as Node)) return;

        setIsOpen(false);
        setIsFocused(false);
        if (onBlur) {
          onBlur({
            target: { name: name || "" },
            persist: () => {},
          });
        }
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onBlur, name]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    setIsFocused(true);
  };

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setIsFocused(false);
    if (onBlur) {
      onBlur({
        target: { name: name || "" },
        persist: () => {},
      });
    }
  };

  const triggerClasses = `
    w-full flex items-center justify-between
    px-4 py-2.5 rounded-xl border
    bg-white transition-all duration-300
    outline-none select-none
    ${disabled ? "" : "cursor-pointer"}
    ${icon ? "pl-11" : ""}
    ${getBorderClasses(hasError, isFocused || isOpen, disabled)}
    ${className}
  `;

  return (
    <div className="w-full relative">
      {label && (
        <label className="block text-sm font-bold text-gray-700 mb-1.5 px-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none group-hover:text-secondary transition-colors">
            {icon}
          </div>
        )}

        <div
          ref={triggerRef}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          onClick={handleToggle}
          className={triggerClasses}
        >
          <span className={`block truncate text-sm ${selected ? "text-gray-900 font-medium" : "text-gray-400"}`}>
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.color && (
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: selected.color }} />
                )}
                {selected.label}
              </span>
            ) : placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform duration-300 ease-out ${isOpen ? "rotate-180 text-secondary" : ""}`}
          />
        </div>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            id={`portal-${name || 'select'}`}
            className="fixed z-[9999]"
            style={{
              top: `${coords.top + 4}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
          >
            <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
              <ul className="max-h-64 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200">
                {options.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-gray-400 text-center">No options found</li>
                ) : (
                  options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <li
                        key={option.value}
                        onClick={() => handleSelect(option)}
                        className={`
                          flex items-center justify-between px-4 py-2.5 text-sm transition-all
                          ${option.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}
                          ${isSelected ? "bg-blue-50/50 text-secondary font-bold" : "text-gray-600"}
                        `}
                      >
                        <span className="flex items-center gap-2.5">
                          {option.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />}
                          {option.label}
                        </span>
                        {isSelected && <Check size={16} className="text-secondary" />}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
      </div>

      {hasError && (
        <div className="mt-1.5 flex items-center gap-1.5 px-1 animate-in slide-in-from-top-1 duration-200">
          <AlertCircle size={14} className="text-red-500" />
          <p className="text-red-500 text-xs font-medium">{error}</p>
        </div>
      )}
      {helperText && !hasError && (
        <p className="mt-1.5 text-[11px] text-gray-400 px-1 italic">{helperText}</p>
      )}
    </div>
  );
};

// ─── FormMultiSelect ───────────────────────────────────────────────────────────

interface FormMultiSelectProps {
  label?: string;
  name?: string;
  value: string[];
  onChange: (values: string[]) => void;
  onBlur?: () => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
  maxSelected?: number;
}

export const FormMultiSelect: React.FC<FormMultiSelectProps> = ({
  label,
  name,
  value = [],
  onChange,
  options,
  placeholder = "Select options",
  error,
  required = false,
  disabled = false,
  helperText,
  icon,
  className = "",
  maxSelected,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const coords = useDropdownPosition(triggerRef, isOpen);

  const hasError = !!error;
  const selectedOptions = options.filter((o) => value.includes(o.value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const portal = document.getElementById(`portal-${name || 'multi'}`);
        if (portal && portal.contains(e.target as Node)) return;
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, name]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    setIsFocused(true);
  };

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    const isSelected = value.includes(option.value);
    if (isSelected) {
      onChange(value.filter((v) => v !== option.value));
    } else {
      if (maxSelected && value.length >= maxSelected) return;
      onChange([...value, option.value]);
    }
  };

  const handleRemoveTag = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const triggerClasses = `
    w-full flex items-center justify-between gap-2
    px-3 py-1.5 rounded-xl border min-h-[46px]
    bg-white transition-all duration-300
    outline-none ring-offset-1
    ${disabled ? "" : "cursor-pointer"}
    ${icon ? "pl-11" : ""}
    ${getBorderClasses(hasError, isFocused || isOpen, disabled)}
    ${className}
  `;

  return (
    <div className="w-full relative">
      {label && (
        <label className="block text-sm font-bold text-gray-700 mb-1.5 px-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none group-hover:text-secondary transition-colors">
            {icon}
          </div>
        )}

        <div
          ref={triggerRef}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          onClick={handleToggle}
          className={triggerClasses}
        >
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {selectedOptions.length === 0 ? (
              <span className="text-gray-400 text-sm">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: option.color ? `${option.color}15` : "#f1f5f9",
                    color: option.color || "#475569",
                    border: `1px solid ${option.color ? `${option.color}30` : "#e2e8f0"}`,
                  }}
                >
                  {option.label}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveTag(e, option.value)}
                      className="ml-0.5 hover:bg-black/5 rounded-full p-0.5 transition-colors"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-1">
            {selectedOptions.length > 0 && !disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform duration-300 ease-out ${isOpen ? "rotate-180 text-secondary" : ""}`}
            />
          </div>
        </div>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <div
            id={`portal-${name || 'multi'}`}
            className="fixed z-[9999]"
            style={{
              top: `${coords.top + 4}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
          >
            <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden">
              {maxSelected && (
                <div className="px-4 py-2 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 flex justify-between">
                  <span>Capacity</span>
                  <span>{value.length}/{maxSelected}</span>
                </div>
              )}
              <ul className="max-h-64 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-gray-200">
                {options.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-gray-400 text-center">No options available</li>
                ) : (
                  options.map((option) => {
                    const isSelected = value.includes(option.value);
                    const isMaxReached = !!maxSelected && value.length >= maxSelected && !isSelected;
                    return (
                      <li
                        key={option.value}
                        onClick={() => !isMaxReached && handleSelect(option)}
                        className={`
                          flex items-center gap-3 px-4 py-2.5 text-sm transition-all
                          ${option.disabled || isMaxReached ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}
                          ${isSelected ? "bg-blue-50/50 text-secondary font-bold" : "text-gray-600"}
                        `}
                      >
                        <div className={`
                          w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                          ${isSelected ? "bg-secondary border-secondary shadow-sm" : "border-gray-200"}
                        `}>
                          {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
                        </div>
                        <span className="flex items-center gap-2">
                          {option.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: option.color }} />}
                          {option.label}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
      </div>

      {hasError && (
        <div className="mt-1.5 flex items-center gap-1.5 px-1 animate-in slide-in-from-top-1 duration-200">
          <AlertCircle size={14} className="text-red-500" />
          <p className="text-red-500 text-xs font-medium">{error}</p>
        </div>
      )}
      {helperText && !hasError && (
        <p className="mt-1.5 text-[11px] text-gray-400 px-1 italic">{helperText}</p>
      )}
    </div>
  );
};

export default FormSelect;