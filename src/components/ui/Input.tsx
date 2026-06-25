// import React, { useState } from "react";
// import { Eye, EyeOff } from "lucide-react";

// const FormInput = ({
//   label,
//   name,
//   type = "text",
//   value,
//   onChange,
//   onBlur,
//   error,
//   placeholder = "",
//   as = "input", // input | textarea
//   accept,
//   required,
// }:any) => {
//   const [showPassword, setShowPassword] = useState(false);

//   const isPassword = type === "password";

//   const inputType = isPassword
//     ? showPassword
//       ? "text"
//       : "password"
//     : type;

//   const baseClass = `
//     w-full px-3 py-2.5 rounded-xl border 
//     bg-white/80 backdrop-blur-sm
//     text-sm outline-none transition-all duration-200
//     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
//     ${error ? "border-red-500 ring-red-200" : "border-gray-300"}
//   `;

//   return (
//     <div className="w-full">
//       {/* Label */}
//       {label && (
//         <label className="block mb-1.5 text-sm font-medium text-gray-700">
//           {label}
//           {required && <span className="text-red-500 ml-1">*</span>}
//         </label>
//       )}

//       <div className="relative">
//         {/* TEXTAREA */}
//         {as === "textarea" ? (
//           <textarea
//             name={name}
//             value={value || ""}
//             onChange={onChange}
//             onBlur={onBlur}
//             placeholder={placeholder}
//             rows={4}
//             className={baseClass}
//           />
//         ) : type === "file" ? (
//           /* FILE INPUT */
//           <input
//             type="file"
//             name={name}
//             onChange={(e) =>
//               onChange({
//                 target: {
//                   name,
//                   value: e.currentTarget.files[0],
//                 },
//               })
//             }
//             onBlur={onBlur}
//             accept={accept}
//             className={`${baseClass} file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100`}
//           />
//         ) : (
//           /* NORMAL INPUT */
//           <input
//             type={inputType}
//             name={name}
//             value={value || ""}
//             onChange={onChange}
//             onBlur={onBlur}
//             placeholder={placeholder}
//             className={baseClass}
//           />
//         )}

//         {/* 👁 Password Toggle */}
//         {isPassword && (
//           <button
//             type="button"
//             onClick={() => setShowPassword(!showPassword)}
//             className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
//           >
//             {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
//           </button>
//         )}
//       </div>

//       {/* Error */}
//       {error && (
//         <p className="text-red-500 text-xs mt-1">{error}</p>
//       )}
//     </div>
//   );
// };

// export default FormInput;
// import React, { useState } from "react";
// import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";

// interface FormInputProps {
//   label?: string;
//   name: string;
//   type?: string;
//   value: any;
//   onChange: (e: any) => void;
//   onBlur?: (e: any) => void;
//   error?: string;
//   placeholder?: string;
//   as?: "input" | "textarea";
//   accept?: string;
//   required?: boolean;
//   disabled?: boolean;
//   success?: boolean;
//   helperText?: string;
//   icon?: React.ReactNode;
//   className?: string;
// }

// const FormInput: React.FC<FormInputProps> = ({
//   label,
//   name,
//   type = "text",
//   value,
//   onChange,
//   onBlur,
//   error,
//   placeholder = "",
//   as = "input",
//   accept,
//   required = false,
//   disabled = false,
//   success = false,
//   helperText,
//   icon,
//   className = "",
// }) => {
//   const [showPassword, setShowPassword] = useState(false);
//   const [isFocused, setIsFocused] = useState(false);

//   const isPassword = type === "password";
//   const hasError = !!error;
//   const showSuccess = success && !hasError && value;

//   const inputType = isPassword ? (showPassword ? "text" : "password") : type;

//   const getInputClasses = () => {
//     let base = `
//       w-full px-3 py-2.5 rounded-xl
//       bg-white/90 backdrop-blur-sm
//       text-gray-800 text-sm outline-none transition-all duration-200
//       border-2
//     `;

//     if (disabled) {
//       base += " bg-gray-50 cursor-not-allowed opacity-70";
//     } else {
//       base += " hover:shadow-sm";
//     }

//     if (icon) base += " pl-10";
//     if (isPassword) base += " pr-10";

//     if (hasError) {
//       // ✅ Dark red border
//       base += " border-red-700 ring-2 ring-red-300 focus:border-red-700 focus:ring-red-300";
//     } else if (showSuccess) {
//       // ✅ Dark green border
//       base += " border-green-700 ring-2 ring-green-300 focus:border-green-700 focus:ring-green-300";
//     } else if (isFocused) {
//       // ✅ Dark blue border
//       base += " border-blue-700 ring-2 ring-blue-300";
//     } else {
//       // ✅ Dark gray default border
//       base += " border-gray-500 hover:border-gray-700";
//     }

//     return `${base} ${className}`;
//   };

//   const getFileInputClasses = () => {
//     let classes = `
//       w-full px-3 py-2 rounded-xl border-2
//       bg-white/90 backdrop-blur-sm
//       text-sm outline-none transition-all duration-200
//       file:mr-3 file:py-2 file:px-4 file:rounded-lg
//       file:border-0 file:text-sm file:font-medium
//       file:bg-blue-50 file:text-blue-700
//       hover:file:bg-blue-100
//     `;

//     if (disabled) {
//       classes += " bg-gray-50 cursor-not-allowed opacity-70";
//     } else {
//       classes += " cursor-pointer";
//     }

//     if (hasError) {
//       classes += " border-red-700 ring-2 ring-red-300";
//     } else if (showSuccess) {
//       classes += " border-green-700 ring-2 ring-green-300";
//     } else if (isFocused) {
//       classes += " border-blue-700 ring-2 ring-blue-300";
//     } else {
//       classes += " border-gray-500 hover:border-gray-700";
//     }

//     return classes;
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.currentTarget.files?.[0];
//     onChange({
//       target: {
//         name,
//         value: file || null,
//       },
//     });
//   };

//   return (
//     <div className="w-full mb-4">
//       {/* Label */}
//       {label && (
//         <div className="flex items-center justify-between mb-2">
//           <label className="text-sm font-semibold text-gray-700">
//             {label}
//             {required && <span className="text-red-700 ml-1">*</span>}
//           </label>
//           {helperText && !hasError && (
//             <span className="text-xs text-gray-500">{helperText}</span>
//           )}
//         </div>
//       )}

//       <div className="relative">
//         {/* Left Icon */}
//         {icon && (
//           <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
//             {icon}
//           </div>
//         )}

//         {/* Input Field */}
//         {as === "textarea" ? (
//           <textarea
//             name={name}
//             value={value || ""}
//             onChange={onChange}
//             onBlur={(e) => {
//               setIsFocused(false);
//               onBlur?.(e);
//             }}
//             onFocus={() => setIsFocused(true)}
//             placeholder={placeholder}
//             rows={4}
//             disabled={disabled}
//             className={getInputClasses()}
//           />
//         ) : type === "file" ? (
//           <input
//             type="file"
//             name={name}
//             onChange={handleFileChange}
//             onBlur={onBlur}
//             accept={accept}
//             disabled={disabled}
//             className={getFileInputClasses()}
//           />
//         ) : (
//           <input
//             type={inputType}
//             name={name}
//             value={value || ""}
//             onChange={onChange}
//             onBlur={(e) => {
//               setIsFocused(false);
//               onBlur?.(e);
//             }}
//             onFocus={() => setIsFocused(true)}
//             placeholder={placeholder}
//             disabled={disabled}
//             className={getInputClasses()}
//           />
//         )}

//         {/* Password Toggle Button */}
//         {isPassword && (
//           <button
//             type="button"
//             onClick={() => setShowPassword(!showPassword)}
//             disabled={disabled}
//             className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
//           >
//             {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
//           </button>
//         )}

//         {/* Success Icon */}
//         {showSuccess && !hasError && !isPassword && (
//           <div className="absolute right-3 top-1/2 -translate-y-1/2">
//             <CheckCircle size={18} className="text-green-700" />
//           </div>
//         )}
//       </div>

//       {/* Error Message with Icon */}
//       {hasError && (
//         <div className="mt-2 flex items-center gap-1.5">
//           <AlertCircle size={14} className="text-red-700 flex-shrink-0" />
//           <p className="text-red-700 text-xs">{error}</p>
//         </div>
//       )}

//       {/* Success Message */}
//       {success && !hasError && value && !error && (
//         <p className="text-green-700 text-xs mt-2">✓ Valid input</p>
//       )}
//     </div>
//   );
// };

// export default FormInput;

import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle, Check } from "lucide-react";

interface FormInputProps {
  label?: React.ReactNode;
  name: string;
  type?: string;
  value?: any;
  onChange: (e: any) => void;
  onBlur?: (e: any) => void;
  error?: string;
  placeholder?: string;
  as?: "input" | "textarea" | "checkbox";
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  success?: boolean;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
  checked?: boolean; // For checkbox
  checkboxColor?: string; // Custom color for checkbox
  labelClassName?: string; // Custom class for label container
  compact?: boolean; // Compact mode
  isPhone?: boolean; // Mobile input mode
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  placeholder = "",
  as = "input",
  accept,
  required = false,
  disabled = false,
  success = false,
  helperText,
  icon,
  className = "",
  checked,
  checkboxColor = "#1e40af", // Default dark blue color
  labelClassName,
  compact,
  isPhone,
  min,
  max,
  step,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = type === "password";
  const isCheckbox = as === "checkbox";
  const hasError = !!error;
  const showSuccess = success && !hasError && value;

  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  const getInputClasses = () => {
    let base = `
      w-full px-3 py-2.5 rounded-xl
      bg-white/90 backdrop-blur-sm
      text-gray-800 text-sm outline-none transition-all duration-200
      border-2
    `;

    if (disabled) {
      base += " bg-gray-50 cursor-not-allowed opacity-70";
    } else {
      base += " hover:shadow-sm";
    }

    if (icon) base += " pl-10";
    if (isPassword) base += " pr-10";

    if (hasError) {
      base += " border-red-700 ring-2 ring-red-300 focus:border-red-700 focus:ring-red-300";
    } else if (showSuccess) {
      base += " border-green-700 ring-2 ring-green-300 focus:border-green-700 focus:ring-green-300";
    } else if (isFocused) {
      base += " border-blue-700 ring-2 ring-blue-300";
    } else {
      base += " border-gray-500 hover:border-gray-700";
    }

    return `${base} ${className}`;
  };

  const getFileInputClasses = () => {
    let classes = `
      w-full px-3 py-2 rounded-xl border-2
      bg-white/90 backdrop-blur-sm
      text-sm outline-none transition-all duration-200
      file:mr-3 file:py-2 file:px-4 file:rounded-lg
      file:border-0 file:text-sm file:font-medium
      file:bg-blue-50 file:text-blue-700
      hover:file:bg-blue-100
    `;

    if (disabled) {
      classes += " bg-gray-50 cursor-not-allowed opacity-70";
    } else {
      classes += " cursor-pointer";
    }

    if (hasError) {
      classes += " border-red-700 ring-2 ring-red-300";
    } else if (showSuccess) {
      classes += " border-green-700 ring-2 ring-green-300";
    } else if (isFocused) {
      classes += " border-blue-700 ring-2 ring-blue-300";
    } else {
      classes += " border-gray-500 hover:border-gray-700";
    }

    return classes;
  };

  const getCheckboxClasses = () => {
    let classes = `
      appearance-none w-5 h-5 rounded
      border-2 transition-all duration-200
      cursor-pointer relative
      focus:outline-none focus:ring-2 focus:ring-offset-2
    `;

    if (disabled) {
      classes += " cursor-not-allowed opacity-70";
    }

    if (hasError) {
      classes += ` border-red-700 focus:ring-red-300`;
    } else if (checked) {
      classes += ` border-${checkboxColor} bg-${checkboxColor} focus:ring-${checkboxColor}`;
    } else {
      classes += ` border-gray-400 focus:ring-blue-300`;
    }

    return classes;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    onChange({
      target: {
        name,
        value: file || null,
      },
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      target: {
        name,
        value: e.target.checked,
        checked: e.target.checked,
      },
    });
  };



  if (isCheckbox) {
    return (
      <div className="w-full mb-2 mt-2">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer ${checked ? "" : "border-gray-400"
                }`}
              style={{
                backgroundColor: checked ? checkboxColor : "transparent",
                borderColor: checked ? checkboxColor : "#9CA3AF",
              }}
              onClick={() => {
                if (!disabled) {
                  const newChecked = !(checked || value);
                  onChange({
                    target: {
                      name,
                      value: newChecked,
                      checked: newChecked,
                    },
                  });
                }
              }}
            >
              {checked && (
                <Check size={14} className="text-white stroke-[3]" />
              )}
            </div>

            {/* Hidden actual input for form */}
            <input
              type="checkbox"
              name={name}
              checked={checked || value || false}
              onChange={handleCheckboxChange}
              onBlur={onBlur}
              disabled={disabled}
              className="absolute opacity-0 w-0 h-0"
            />
          </div>

          <div className={`flex-1 ${labelClassName || ''}`}>
            {label && (
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-semibold text-gray-700 cursor-pointer"
                  onClick={() => {
                    if (!disabled) {
                      const newChecked = !(checked || value);
                      onChange({
                        target: {
                          name,
                          value: newChecked,
                          checked: newChecked,
                        },
                      });
                    }
                  }}
                >
                  {label}
                  {required && (
                    <span className="text-red-700 ml-1">*</span>
                  )}
                </label>

                {helperText && !hasError && (
                  <span className="text-xs text-gray-500">
                    {helperText}
                  </span>
                )}
              </div>
            )}

            {hasError && (
              <div className="mt-1 flex items-center gap-1.5">
                <AlertCircle
                  size={12}
                  className="text-red-700 flex-shrink-0"
                />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-4">
      {/* Label */}
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">
            {label}
            {required && <span className="text-red-700 ml-1">*</span>}
          </label>
          {helperText && !hasError && (
            <span className="text-xs text-gray-500">{helperText}</span>
          )}
        </div>
      )}

      <div className="relative">
        {/* Left Icon */}
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none">
            {icon}
          </div>
        )}

        {/* Input Field */}
        {as === "textarea" ? (
          <textarea
            name={name}
            value={value || ""}
            onChange={onChange}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            rows={4}
            disabled={disabled}
            className={getInputClasses()}
          />
        ) : type === "file" ? (
          <input
            type="file"
            name={name}
            onChange={handleFileChange}
            onBlur={onBlur}
            accept={accept}
            disabled={disabled}
            className={getFileInputClasses()}
          />
        ) : isPhone ? (
          <div className="relative flex items-center w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-medium z-10 pointer-events-none select-none">
              +91
            </span>
            <input
              type="tel"
              name={name}
              value={value ? (() => {
                const cleaned = String(value).replace(/\D/g, "");
                if (cleaned.length <= 5) return cleaned;
                return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 10)}`;
              })() : ""}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.length > 10) val = val.slice(0, 10);
                const syntheticEvent = {
                  ...e,
                  target: {
                    ...e.target,
                    name,
                    value: val
                  }
                };
                onChange(syntheticEvent as any);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                onBlur?.(e);
              }}
              onFocus={() => setIsFocused(true)}
              placeholder={placeholder || "00000 00000"}
              disabled={disabled}
              className={`${getInputClasses()} pl-11`}
            />
          </div>
        ) : (
          <input
            type={inputType}
            name={name}
            value={value || ""}
            onChange={onChange}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={getInputClasses()}
          />
        )}

        {/* Password Toggle Button */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
          >
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}

        {/* Success Icon */}
        {showSuccess && !hasError && !isPassword && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <CheckCircle size={18} className="text-green-700" />
          </div>
        )}
      </div>

      {/* Error Message with Icon */}
      {hasError && (
        <div className="mt-2 flex items-center gap-1.5">
          <AlertCircle size={14} className="text-red-700 flex-shrink-0" />
          <p className="text-red-700 text-xs">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && !hasError && value && !error && (
        <p className="text-green-700 text-xs mt-2">✓ Valid input</p>
      )}
    </div>
  );
};

export default FormInput;