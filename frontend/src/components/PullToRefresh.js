/**
 * PullToRefresh.js
 * --------------------------------------------------------------
 * Tiny dependency-free pull-to-refresh for any scrollable page.
 *
 *   <PullToRefresh onRefresh={async () => loadData()}>
 *     <YourContent />
 *   </PullToRefresh>
 *
 * Only activates when the user starts the gesture at the top of
 * the page (window.scrollY === 0), so it never fights with the
 * normal scroll. Works on web touch + Capacitor WebView.
 */
import { useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { hapticTap, hapticSuccess } from "@/utils/nativeUx";

const TRIGGER_DISTANCE = 70;   // px pulled before refresh fires
const MAX_PULL = 110;          // hard cap for indicator translate

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const armed = useRef(false);

  const onTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    armed.current = true;
  }, [disabled, refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!armed.current || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Apply a friction curve so the indicator slows as it grows
    const eased = Math.min(MAX_PULL, dy * 0.55);
    setPull(eased);
    if (eased > 4) e.preventDefault?.();
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!armed.current) return;
    armed.current = false;
    startY.current = null;
    if (pull >= TRIGGER_DISTANCE && !refreshing) {
      hapticTap();
      setRefreshing(true);
      try {
        await Promise.resolve(onRefresh?.());
        hapticSuccess();
      } catch (_) {
        /* swallow — let caller toast */
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  const indicatorHeight = refreshing ? 48 : pull;
  const ready = pull >= TRIGGER_DISTANCE;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{ touchAction: refreshing ? "none" : "pan-y" }}
    >
      <div
        aria-hidden
        style={{
          height: indicatorHeight,
          transition: refreshing || pull === 0 ? "height 220ms ease-out" : "none",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ready || refreshing ? "#10b981" : "#94a3b8",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}
        data-testid="ptr-indicator"
      >
        {refreshing ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            REFRESHING…
          </span>
        ) : pull > 0 ? (
          ready ? "RELEASE TO REFRESH" : "PULL TO REFRESH"
        ) : null}
      </div>
      {children}
    </div>
  );
}
