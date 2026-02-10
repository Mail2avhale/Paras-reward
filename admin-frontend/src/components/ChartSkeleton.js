import React from 'react';

function ChartSkeleton({ height = 400 }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Chart Title */}
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-8 w-24 bg-gray-200 rounded"></div>
      </div>
      
      {/* Chart Area */}
      <div 
        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg animate-pulse relative overflow-hidden"
        style={{ height: `${height}px` }}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer-effect"></div>
        
        {/* Fake chart bars/lines */}
        <div className="flex items-end justify-around h-full p-8 gap-4">
          {[60, 80, 45, 90, 70, 85, 55].map((height, index) => (
            <div 
              key={index} 
              className="bg-gray-200 rounded-t w-full"
              style={{ height: `${height}%` }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 animate-pulse">
        {[1, 2, 3].map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="h-3 w-3 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChartSkeleton;
