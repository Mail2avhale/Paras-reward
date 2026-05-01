import React, { useState } from 'react';
import { X, Eye, ChevronRight } from 'lucide-react';

/**
 * Non-blocking, collapsible Impersonation indicator.
 *
 * Mobile behaviour (<sm):
 *  - Expanded: shows a single-line compact orange bar on top (sticky).
 *  - Collapsed: shrinks to a small floating pill on bottom-right
 *    (above the BottomNav) so TopBar / menu is fully usable.
 *
 * Desktop behaviour (>=sm):
 *  - Compact sticky bar (does not wrap, doesn't push layout much).
 *
 * The user can toggle collapsed state anytime. Exit button is always
 * reachable from both states.
 */
const ImpersonationBanner = ({ user, onExit }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        data-testid="impersonation-pill"
        aria-label="Expand impersonation controls"
        className="fixed bottom-20 right-3 z-[9999] flex items-center gap-1.5 bg-orange-500 text-white pl-3 pr-2 py-1.5 rounded-full shadow-lg hover:bg-orange-600 active:scale-95 transition-all text-xs font-semibold"
      >
        <Eye className="h-3.5 w-3.5" />
        <span>IMP</span>
        <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-80" />
      </button>
    );
  }

  return (
    <div
      data-testid="impersonation-banner"
      className="w-full bg-orange-500 text-white sticky top-0 z-[100] shadow-md"
    >
      <div className="max-w-screen-xl mx-auto flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm">
        <Eye className="h-4 w-4 shrink-0 text-white/90" />
        <span className="font-semibold truncate">
          <span className="hidden sm:inline">IMPERSONATION MODE · </span>
          <span className="sm:hidden">IMP · </span>
          {user.name}
          {user.mobile ? ` (${user.mobile})` : ''}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onExit}
          data-testid="impersonation-exit-btn"
          className="bg-white text-orange-700 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md font-semibold text-[11px] sm:text-xs hover:bg-orange-50 transition-colors whitespace-nowrap"
        >
          Exit
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          data-testid="impersonation-collapse-btn"
          aria-label="Hide impersonation banner"
          className="text-white/90 hover:text-white hover:bg-white/10 rounded-md p-1 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
