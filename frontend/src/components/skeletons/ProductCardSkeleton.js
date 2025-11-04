import React from 'react';

function ProductCardSkeleton({ count = 6 }) {
  return (
    <>
      {[...Array(count)].map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
          {/* Product Image */}
          <div className="h-48 bg-gray-200"></div>
          
          {/* Product Info */}
          <div className="p-4 space-y-3">
            {/* Title */}
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            
            {/* Description */}
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            </div>
            
            {/* Price and Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="h-9 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default ProductCardSkeleton;
