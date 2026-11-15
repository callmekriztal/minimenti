import asyncio
from collections import defaultdict
import uuid


class _ChannelDict(dict):
    """Custom dictionary allowing lookup by either uuid.UUID or str."""

    def __getitem__(self, item):
        return super().__getitem__(str(item))

    def __setitem__(self, key, value):
        super().__setitem__(str(key), value)

    def __contains__(self, item):
        return super().__contains__(str(item))

    def __delitem__(self, key):
        super().__delitem__(str(key))


class Broadcaster:
    """Manages in-memory pub/sub queues for Server-Sent Events (SSE).
    
    Each poll or presentation channel has a set of subscriber asyncio.Queue objects.
    When a vote or slide advance occurs, updated payloads are pushed to subscriber queues.
    Streams hold zero database connections while waiting for events.
    """

    def __init__(self) -> None:
        self._subscribers: dict[uuid.UUID | str, set[asyncio.Queue[str]]] = _ChannelDict()

    def subscribe(self, channel_id: uuid.UUID | str) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        if channel_id not in self._subscribers:
            self._subscribers[channel_id] = set()
        self._subscribers[channel_id].add(queue)
        return queue

    def unsubscribe(self, channel_id: uuid.UUID | str, queue: asyncio.Queue[str]) -> None:
        if channel_id in self._subscribers:
            self._subscribers[channel_id].discard(queue)
            if not self._subscribers[channel_id]:
                del self._subscribers[channel_id]

    def broadcast(self, channel_id: uuid.UUID | str, message: str) -> None:
        if channel_id not in self._subscribers:
            return

        for queue in list(self._subscribers[channel_id]):
            queue.put_nowait(message)


broadcaster = Broadcaster()
