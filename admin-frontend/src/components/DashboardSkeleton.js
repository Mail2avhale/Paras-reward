import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-950 pb-24 animate-pulse">
      {/* Header Skeleton */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-800"></div>
            <div>
              <div className="h-4 w-24 bg-gray-800 rounded mb-2"></div>
              <div className="h-3 w-32 bg-gray-800/50 rounded"></div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-800"></div>
        </div>
      </div>

      {/* Balance Card Skeleton */}
      <div className="px-5 mb-6">
        <div className="h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-5">
          <div className="h-4 w-32 bg-gray-700 rounded mb-4"></div>
          <div className="h-10 w-40 bg-gray-700 rounded mb-8"></div>
          <div className="flex gap-4">
            <div className="h-8 w-20 bg-gray-700 rounded"></div>
            <div className="h-8 w-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="px-5 mb-6">
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-20">
              <div className="w-14 h-14 bg-gray-800 rounded-2xl mx-auto mb-2"></div>
              <div className="h-3 w-full bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <div className="w-8 h-8 bg-gray-800 rounded-lg mb-3"></div>
              <div className="h-6 w-20 bg-gray-800 rounded mb-1"></div>
              <div className="h-3 w-16 bg-gray-800/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed Skeleton */}
      <div className="px-5">
        <div className="h-5 w-32 bg-gray-800 rounded mb-4"></div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-800 rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-gray-800/50 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
