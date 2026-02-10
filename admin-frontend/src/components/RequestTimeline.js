import React from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, User, ArrowRight } from 'lucide-react';

/**
 * RequestTimeline Component
 * Shows the timeline of a request from submission to processing
 * Used in both Admin and User facing pages
 */

// SLA thresholds in hours
const SLA_WARNING = 48; // Yellow warning
const SLA_CRITICAL = 96; // Red critical

/**
 * Calculate time difference and return formatted string
 */
export const getTimeDifference = (startDate, endDate) => {
  if (!startDate) return null;
  
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end - start;
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    return `${days}d ${hours}h`;
  }
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMins}m`;
  }
  
  return `${diffMins}m`;
};

/**
 * Get SLA status based on pending time
 */
export const getSLAStatus = (createdAt, status) => {
  if (!createdAt || status !== 'pending') return null;
  
  const created = new Date(createdAt);
  const now = new Date();
  const hoursPending = (now - created) / (1000 * 60 * 60);
  
  if (hoursPending >= SLA_CRITICAL) {
    return { level: 'critical', hours: Math.floor(hoursPending), color: 'red' };
  }
  if (hoursPending >= SLA_WARNING) {
    return { level: 'warning', hours: Math.floor(hoursPending), color: 'yellow' };
  }
  return null;
};

/**
 * SLA Badge Component - Shows warning/critical indicators
 */
export const SLABadge = ({ createdAt, status }) => {
  const sla = getSLAStatus(createdAt, status);
  
  if (!sla) return null;
  
  const isWarning = sla.level === 'warning';
  const isCritical = sla.level === 'critical';
  
  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium animate-pulse ${
        isCritical 
          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      }`}
      title={`Pending for ${sla.hours} hours`}
    >
      <AlertTriangle className="w-3 h-3" />
      {sla.hours}h
    </span>
  );
};

/**
 * Timeline Component - Visual timeline for request processing
 */
const RequestTimeline = ({ 
  createdAt, 
  processedAt, 
  processedBy, 
  status,
  variant = 'default' // 'default' for admin, 'compact' for user
}) => {
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const isProcessed = ['approved', 'completed', 'rejected', 'processing'].includes(status);
  const processingTime = isProcessed && createdAt && processedAt 
    ? getTimeDifference(createdAt, processedAt) 
    : null;
  const pendingTime = !isProcessed && createdAt 
    ? getTimeDifference(createdAt, null) 
    : null;
  
  const slaStatus = getSLAStatus(createdAt, status);

  if (variant === 'compact') {
    // Compact view for user-facing pages
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Submitted</span>
          </div>
          <span className="text-white">{formatDateTime(createdAt)}</span>
        </div>
        
        {isProcessed && processedAt && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              {status === 'rejected' ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
              <span>{status === 'rejected' ? 'Rejected' : 'Processed'}</span>
            </div>
            <span className="text-white">{formatDateTime(processedAt)}</span>
          </div>
        )}
        
        {processingTime && (
          <div className="text-xs text-gray-500 text-right">
            Processing time: {processingTime}
          </div>
        )}
        
        {!isProcessed && pendingTime && (
          <div className={`text-xs text-right ${slaStatus ? 'text-yellow-400' : 'text-gray-500'}`}>
            Pending for: {pendingTime}
          </div>
        )}
      </div>
    );
  }

  // Full timeline view for admin pages
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 mt-4" data-testid="request-timeline">
      <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-purple-400" />
        Request Timeline
      </h4>
      
      <div className="relative">
        {/* Timeline connector line */}
        <div className={`absolute left-[11px] top-6 bottom-6 w-0.5 ${
          isProcessed ? 'bg-gradient-to-b from-green-500 to-green-500/50' : 'bg-gray-700'
        }`} />
        
        {/* Step 1: Submitted */}
        <div className="relative flex items-start gap-4 pb-6">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 z-10">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-white font-medium">Request Submitted</p>
              <p className="text-gray-400 text-sm">{formatDateTime(createdAt)}</p>
            </div>
            <p className="text-gray-500 text-xs mt-1">User submitted the request</p>
          </div>
        </div>
        
        {/* Step 2: Processing/Processed */}
        <div className="relative flex items-start gap-4">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
            isProcessed 
              ? status === 'rejected' 
                ? 'bg-red-500' 
                : 'bg-green-500'
              : slaStatus?.level === 'critical'
                ? 'bg-red-500/50 animate-pulse'
                : slaStatus?.level === 'warning'
                  ? 'bg-yellow-500/50 animate-pulse'
                  : 'bg-gray-600'
          }`}>
            {isProcessed ? (
              status === 'rejected' ? (
                <XCircle className="w-4 h-4 text-white" />
              ) : (
                <CheckCircle className="w-4 h-4 text-white" />
              )
            ) : slaStatus ? (
              <AlertTriangle className="w-4 h-4 text-white" />
            ) : (
              <Clock className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <p className={`font-medium ${
                  isProcessed 
                    ? status === 'rejected' ? 'text-red-400' : 'text-white' 
                    : 'text-gray-400'
                }`}>
                  {isProcessed 
                    ? status === 'rejected' ? 'Request Rejected' : 'Request Processed'
                    : 'Awaiting Processing'
                  }
                </p>
                {!isProcessed && slaStatus && (
                  <SLABadge createdAt={createdAt} status={status} />
                )}
              </div>
              {isProcessed && processedAt && (
                <p className="text-gray-400 text-sm">{formatDateTime(processedAt)}</p>
              )}
            </div>
            
            {/* Processing Details */}
            {isProcessed && (
              <div className="mt-2 space-y-1">
                {processedBy && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <User className="w-3 h-3" />
                    <span>Processed by: <span className="text-white">{processedBy}</span></span>
                  </div>
                )}
                {processingTime && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ArrowRight className="w-3 h-3" />
                    <span>Processing time: <span className="text-green-400">{processingTime}</span></span>
                  </div>
                )}
              </div>
            )}
            
            {/* Pending Warning */}
            {!isProcessed && pendingTime && (
              <div className={`mt-2 text-xs ${
                slaStatus?.level === 'critical' ? 'text-red-400' :
                slaStatus?.level === 'warning' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {slaStatus?.level === 'critical' 
                  ? `⚠️ CRITICAL: Pending for ${pendingTime} - Exceeds SLA!`
                  : slaStatus?.level === 'warning'
                    ? `⚠️ Warning: Pending for ${pendingTime} - Approaching SLA limit`
                    : `Pending for ${pendingTime}`
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestTimeline;
