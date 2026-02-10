import React from 'react';

function StatsSkeleton({ count = 4 }) {
  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
          {/* Header with icon */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          </div>
          
          {/* Main stat number */}
          <div className="h-10 bg-gray-200 rounded w-3/4 mb-3"></div>
          
          {/* Sub text */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </>
  );
}

export default StatsSkeleton;
