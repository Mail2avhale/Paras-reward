import React from 'react';

function ListSkeleton({ items = 5 }) {
  return (
    <div className="space-y-4">
      {[...Array(items)].map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
          <div className="flex items-start gap-4">
            {/* Icon/Image placeholder */}
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
            
            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            
            {/* Action button placeholder */}
            <div className="w-20 h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListSkeleton;
