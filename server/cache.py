import threading
import time
from collections import OrderedDict
from concurrent.futures import Future, TimeoutError as FutureTimeout

from .api import ApiError


class SharedCache:
    """Bounded successful reads, with one loader per key across request threads."""

    def __init__(self, ttl, capacity, clock=time.monotonic):
        self.ttl, self.capacity, self.clock = ttl, capacity, clock
        self.lock = threading.Lock()
        self.values = OrderedDict()
        self.pending = {}

    def get(self, key, load):
        with self.lock:
            cached = self.values.get(key)
            if cached and self.clock() - cached[0] < self.ttl:
                self.values.move_to_end(key)
                return cached[1]
            self.values.pop(key, None)
            if key in self.pending:
                future, owner = self.pending[key], False
            else:
                future, owner = Future(), True
                self.pending[key] = future
        if not owner:
            try:
                return future.result(timeout=85)
            except FutureTimeout:
                raise ApiError(503, 'READ_BUSY', '같은 데이터를 조회 중이야. 잠시 후 다시 시도해 줘.') from None
        try:
            value = load()
            with self.lock:
                self.values[key] = (self.clock(), value)
                while len(self.values) > self.capacity:
                    self.values.popitem(last=False)
            future.set_result(value)
            return value
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            with self.lock:
                self.pending.pop(key, None)

    def discard(self, predicate):
        with self.lock:
            for key in list(self.values):
                if predicate(key):
                    del self.values[key]
