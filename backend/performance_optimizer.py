"""
Performance Optimizer for Paras Rewards Platform
Implements Circuit Breaker, Connection Health Check, and Fast-Fail patterns
For 3000+ users production environment
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Any, Callable
from functools import wraps

# Circuit Breaker States
CLOSED = "closed"  # Normal operation
OPEN = "open"      # Failing fast, not attempting operations
HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit Breaker Pattern for Database Operations
    - CLOSED: Normal operation, all requests go through
    - OPEN: Service is failing, reject requests immediately (fast fail)
    - HALF_OPEN: Testing recovery, allow limited requests
    """
    
    def __init__(
        self,
        name: str = "db",
        failure_threshold: int = 5,      # Number of failures before opening
        success_threshold: int = 2,       # Successes needed to close from half-open
        timeout: float = 30.0,            # Seconds before trying again (half-open)
        expected_exception: tuple = (Exception,)
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        
        self.state = CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_success_time: Optional[float] = None
        
    def _should_allow_request(self) -> bool:
        """Check if request should be allowed based on circuit state"""
        if self.state == CLOSED:
            return True
        
        if self.state == OPEN:
            # Check if timeout has passed
            if self.last_failure_time and (time.time() - self.last_failure_time) > self.timeout:
                self.state = HALF_OPEN
                self.success_count = 0
                logging.info(f"Circuit {self.name}: OPEN -> HALF_OPEN (testing recovery)")
                return True
            return False
        
        # HALF_OPEN: allow request to test
        return True
    
    def record_success(self):
        """Record a successful operation"""
        self.last_success_time = time.time()
        self.failure_count = 0
        
        if self.state == HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CLOSED
                logging.info(f"Circuit {self.name}: HALF_OPEN -> CLOSED (recovered)")
    
    def record_failure(self):
        """Record a failed operation"""
        self.last_failure_time = time.time()
        self.failure_count += 1
        self.success_count = 0
        
        if self.state == CLOSED and self.failure_count >= self.failure_threshold:
            self.state = OPEN
            logging.warning(f"Circuit {self.name}: CLOSED -> OPEN (too many failures)")
        elif self.state == HALF_OPEN:
            self.state = OPEN
            logging.warning(f"Circuit {self.name}: HALF_OPEN -> OPEN (recovery failed)")
    
    def get_status(self) -> dict:
        """Get current circuit breaker status"""
        return {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": datetime.fromtimestamp(self.last_failure_time).isoformat() if self.last_failure_time else None,
            "last_success": datetime.fromtimestamp(self.last_success_time).isoformat() if self.last_success_time else None
        }


# Global circuit breaker instance
db_circuit = CircuitBreaker(
    name="mongodb",
    failure_threshold=3,     # Open after 3 failures
    success_threshold=2,     # Need 2 successes to close
    timeout=10.0             # Try again after 10 seconds
)


async def fast_db_operation(operation: Callable, timeout_seconds: float = 5.0, fallback: Any = None):
    """
    Execute database operation with:
    - Circuit breaker protection
    - Hard timeout (no retries)
    - Fast fail for better user experience
    
    Args:
        operation: Async callable to execute
        timeout_seconds: Maximum time to wait
        fallback: Value to return on failure (default raises exception)
    """
    # Check circuit breaker
    if not db_circuit._should_allow_request():
        logging.warning(f"Circuit OPEN - fast failing request")
        if fallback is not None:
            return fallback
        raise Exception("Service temporarily unavailable - please try again")
    
    try:
        # Execute with timeout
        result = await asyncio.wait_for(operation(), timeout=timeout_seconds)
        db_circuit.record_success()
        return result
    except asyncio.TimeoutError:
        db_circuit.record_failure()
        logging.error(f"Database operation timed out after {timeout_seconds}s")
        if fallback is not None:
            return fallback
        raise Exception("Request timed out - please try again")
    except Exception as e:
        db_circuit.record_failure()
        logging.error(f"Database operation failed: {str(e)[:100]}")
        if fallback is not None:
            return fallback
        raise


class RequestTimer:
    """Context manager to track and log slow requests"""
    
    def __init__(self, operation_name: str, slow_threshold_ms: float = 1000):
        self.operation_name = operation_name
        self.slow_threshold_ms = slow_threshold_ms
        self.start_time = None
        
    async def __aenter__(self):
        self.start_time = time.time()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        elapsed_ms = (time.time() - self.start_time) * 1000
        if elapsed_ms > self.slow_threshold_ms:
            logging.warning(f"SLOW REQUEST: {self.operation_name} took {elapsed_ms:.0f}ms")
        return False


def get_circuit_status() -> dict:
    """Get status of all circuit breakers"""
    return {
        "mongodb": db_circuit.get_status(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


def reset_circuit():
    """Reset circuit breaker to closed state (for admin use)"""
    global db_circuit
    db_circuit.state = CLOSED
    db_circuit.failure_count = 0
    db_circuit.success_count = 0
    logging.info("Circuit breaker reset to CLOSED")
