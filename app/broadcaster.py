import asyncio
from collections import defaultdict
import uuid


class Broadcaster:
    """Manages in-memory pub/sub queues for Server-Sent Events (SSE).
    
    Each poll has a set of subscriber asyncio.Queue objects.
    When a vote is cast, updated results are pushed to each subscriber queue.
    Streams hold zero database connections while waiting for events.
    """

    def __init__(self) -> None:
        self._subscribers: dict[uuid.UUID, set[asyncio.Queue[str]]] = defaultdict(set)

    def subscribe(self, poll_id: uuid.UUID) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers[poll_id].add(queue)
        return queue

    def unsubscribe(self, poll_id: uuid.UUID, queue: asyncio.Queue[str]) -> None:
        if poll_id in self._subscribers:
            self._subscribers[poll_id].discard(queue)
            if not self._subscribers[poll_id]:
                del self._subscribers[poll_id]

    def broadcast(self, poll_id: uuid.UUID, message: str) -> None:
        if poll_id not in self._subscribers:
            return

        for queue in list(self._subscribers[poll_id]):
            queue.put_nowait(message)


broadcaster = Broadcaster()
