import React from "react";

/**
 * Badge — structure-only component.
 *
 * Badge file ma koi color nathi.
 * Color (bg, text, border) calling file ma className through pass karo.
 *
 * Usage example:
 *   import Badge from "@/components/Badge";
 *
 *   // Paid  → green
 *   <Badge label="Paid"    className="bg-green-50 text-green-700 border-green-200" />
 *
 *   // Pending → orange
 *   <Badge label="Pending" className="bg-orange-50 text-orange-600 border-orange-200" />
 *
 *   // Unpaid → grey
 *   <Badge label="Unpaid"  className="bg-gray-100 text-gray-500 border-gray-200" />
 *
 *   // Inactive → red
 *   <Badge label="Inactive" className="bg-red-50 text-red-600 border-red-200" />
 */
export interface BadgeProps {
  /** Text to display inside the badge */
  label: string;
  /**
   * Tailwind classes for color — bg, text, border.
   * The calling file decides the color.
   */
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ label, className = "" }) => {
  return (
    <span
      className={`inline-flex items-center justify-center px-[10px] py-[4px] rounded-full text-xs font-semibold border ${className}`}
    >
      {label}
    </span>
  );
};

export default Badge;
