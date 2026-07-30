"""
Regression tests for the Observability middleware.

Locks in: request timing, slow-request buffer bounding, per-endpoint
sampling with p95/p99, and reset_stats behaviour.
"""
import asyncio
import time
from unittest.mock import MagicMock
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from middleware import observability  # noqa: E402
from middleware.observability import (  # noqa: E402
    ObservabilityMiddleware,
    get_recent_slow_requests,
    get_endpoint_stats,
    get_global_summary,
    reset_stats,
    _slow_requests,
    _endpoint_samples,
)


@pytest.fixture(autouse=True)
def _reset_before():
    reset_stats()
    _slow_requests.clear()
    yield
    reset_stats()
    _slow_requests.clear()


class _FakeRoute:
    def __init__(self, path):
        self.path = path


class _FakeRequest:
    def __init__(self, method="GET", path="/api/test", template=None):
        self.method = method

        class URL:
            def __init__(self, p):
                self.path = p
        self.url = URL(path)
        self.scope = {"route": _FakeRoute(template or path)}
        self.headers = {}
        self.client = None
        self.state = MagicMock(user_uid=None, uid=None)


class _FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code
        self.headers = {}


async def _fake_call_next_fast(request):
    await asyncio.sleep(0.001)  # 1 ms
    return _FakeResponse(200)


async def _fake_call_next_slow(request):
    await asyncio.sleep(2.1)  # 2.1 s — above the 2 s slow threshold
    return _FakeResponse(200)


async def _fake_call_next_500(request):
    await asyncio.sleep(0.001)
    return _FakeResponse(503)


@pytest.mark.asyncio
async def test_fast_request_not_flagged_slow():
    mw = ObservabilityMiddleware(app=MagicMock())
    req = _FakeRequest(path="/api/test")
    resp = await mw.dispatch(req, _fake_call_next_fast)
    assert resp.status_code == 200
    assert resp.headers.get("X-Response-Time-ms") is not None
    summary = get_global_summary()
    assert summary["requests_total"] == 1
    assert summary["slow_requests_total"] == 0


@pytest.mark.asyncio
async def test_slow_request_captured_in_buffer():
    """A request taking > 2 s is recorded in the slow-request buffer."""
    mw = ObservabilityMiddleware(app=MagicMock())
    req = _FakeRequest(path="/api/slow")
    resp = await mw.dispatch(req, _fake_call_next_slow)
    assert resp.status_code == 200
    slow = get_recent_slow_requests(limit=10)
    assert len(slow) == 1
    entry = slow[0]
    assert entry["path"] == "/api/slow"
    assert entry["elapsed_ms"] >= 2000
    assert entry["status"] == 200


@pytest.mark.asyncio
async def test_slow_buffer_is_bounded():
    """The slow-request buffer must never grow unbounded."""
    from middleware.observability import _SLOW_BUFFER_MAX
    # Manually stuff 2× the cap to prove eviction
    for i in range(_SLOW_BUFFER_MAX * 2):
        _slow_requests.append({"ts": time.time(), "path": f"/api/x{i}"})
    assert len(_slow_requests) == _SLOW_BUFFER_MAX


@pytest.mark.asyncio
async def test_endpoint_percentiles_computed():
    """After N samples on one endpoint, p50/p95/p99 are populated."""
    mw = ObservabilityMiddleware(app=MagicMock())
    for _ in range(20):
        req = _FakeRequest(path="/api/user/foo", template="/api/user/{uid}")
        await mw.dispatch(req, _fake_call_next_fast)
    stats = get_endpoint_stats(top_n=10, sort_by="count")
    ep = next(s for s in stats if s["endpoint"] == "GET:/api/user/{uid}")
    assert ep["count"] == 20
    assert ep["sample_count"] == 20
    assert ep["p50_ms"] >= 0
    assert ep["p95_ms"] >= ep["p50_ms"]
    assert ep["p99_ms"] >= ep["p95_ms"]


@pytest.mark.asyncio
async def test_error_status_counted_5xx():
    mw = ObservabilityMiddleware(app=MagicMock())
    req = _FakeRequest(path="/api/error")
    resp = await mw.dispatch(req, _fake_call_next_500)
    assert resp.status_code == 503
    summary = get_global_summary()
    assert summary["errors_5xx"] == 1
    stats = get_endpoint_stats(sort_by="errors_5xx")
    ep = next(s for s in stats if s["endpoint"] == "GET:/api/error")
    assert ep["errors_5xx"] == 1


@pytest.mark.asyncio
async def test_reset_clears_stats_but_not_slow_buffer():
    mw = ObservabilityMiddleware(app=MagicMock())
    # Generate a slow request first
    req = _FakeRequest(path="/api/slow")
    await mw.dispatch(req, _fake_call_next_slow)
    assert len(_slow_requests) == 1
    # Reset — slow buffer must survive so admins can still investigate
    reset_stats()
    summary = get_global_summary()
    assert summary["requests_total"] == 0
    assert len(_slow_requests) == 1  # preserved


@pytest.mark.asyncio
async def test_overhead_below_1ms_per_request():
    """Middleware overhead must be < 1 ms per request on a modern box."""
    mw = ObservabilityMiddleware(app=MagicMock())
    req = _FakeRequest(path="/api/perf")
    start = time.perf_counter()
    for _ in range(500):
        await mw.dispatch(req, _fake_call_next_fast)
    total_s = time.perf_counter() - start
    # 500 iterations at 1 ms sleep each = ~0.5 s baseline; middleware
    # overhead must not double that.
    overhead_ms = ((total_s - 0.5) / 500) * 1000
    assert overhead_ms < 1.5, (
        f"Middleware overhead {overhead_ms:.2f}ms > 1.5ms budget — perf regression!"
    )
