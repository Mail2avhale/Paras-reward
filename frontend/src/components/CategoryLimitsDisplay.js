/**
 * CategoryLimitsDisplay - DEPRECATED
 * Category-wise limits have been removed.
 * This component shows a notice that limits are now unlimited.
 */

import { Info } from 'lucide-react';

const CategoryLimitsDisplay = ({ userId, onLimitCheck }) => {
  // Always return unlimited
  if (onLimitCheck) {
    onLimitCheck({ allowed: true, unlimited: true });
  }
  
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-emerald-600" />
        <p className="text-sm text-emerald-700">
          No redemption limits - redeem as per your PRC balance
        </p>
      </div>
    </div>
  );
};

export default CategoryLimitsDisplay;
