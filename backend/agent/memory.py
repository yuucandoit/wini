"""Structured session memory for conversation continuity.

Stores the last N turns per session with automatic expiry.
"""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_MAX_TURNS = 5
DEFAULT_EXPIRY_SECONDS = 1800  # 30 minutes


@dataclass
class Turn:
    """A single conversation turn."""
    role: str          # 'user' or 'assistant'
    content: str
    timestamp: float = field(default_factory=time.time)


@dataclass  
class Session:
    """A conversation session with bounded turn history."""
    session_id: str
    turns: list[Turn] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    last_active: float = field(default_factory=time.time)
    max_turns: int = DEFAULT_MAX_TURNS
    
    def add_turn(self, role: str, content: str) -> None:
        """Add a turn, evicting oldest if at capacity."""
        self.turns.append(Turn(role=role, content=content))
        if len(self.turns) > self.max_turns:
            self.turns = self.turns[-self.max_turns:]
        self.last_active = time.time()
    
    def get_history(self) -> list[dict[str, str]]:
        """Get turn history as list of dicts for LLM context."""
        return [
            {"role": t.role, "content": t.content}
            for t in self.turns
        ]
    
    def is_expired(self, expiry_seconds: int = DEFAULT_EXPIRY_SECONDS) -> bool:
        """Check if session has expired due to inactivity."""
        return (time.time() - self.last_active) > expiry_seconds


class SessionMemory:
    """In-memory session store with automatic expiry."""
    
    def __init__(
        self,
        max_turns: int = DEFAULT_MAX_TURNS,
        expiry_seconds: int = DEFAULT_EXPIRY_SECONDS,
    ):
        self._sessions: dict[str, Session] = {}
        self._max_turns = max_turns
        self._expiry_seconds = expiry_seconds
    
    def get_or_create(self, session_id: str) -> Session:
        """Get existing session or create new one."""
        self._cleanup_expired()
        if session_id not in self._sessions:
            logger.info(f"Creating new session: {session_id}")
            self._sessions[session_id] = Session(
                session_id=session_id,
                max_turns=self._max_turns,
            )
        return self._sessions[session_id]
    
    def add_turn(self, session_id: str, role: str, content: str) -> None:
        """Add a turn to a session."""
        session = self.get_or_create(session_id)
        session.add_turn(role, content)
    
    def get_history(self, session_id: str) -> list[dict[str, str]]:
        """Get conversation history for a session."""
        if session_id not in self._sessions:
            return []
        session = self._sessions[session_id]
        if session.is_expired(self._expiry_seconds):
            del self._sessions[session_id]
            return []
        return session.get_history()
    
    def _cleanup_expired(self) -> None:
        """Remove expired sessions."""
        expired = [
            sid for sid, s in self._sessions.items()
            if s.is_expired(self._expiry_seconds)
        ]
        for sid in expired:
            del self._sessions[sid]
            logger.info(f"Session expired and removed: {sid}")


# Module-level singleton
_memory_instance: SessionMemory | None = None


def get_memory() -> SessionMemory:
    """Get or create the global session memory singleton."""
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = SessionMemory()
    return _memory_instance
