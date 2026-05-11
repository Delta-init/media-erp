"""
OAuth2 shared helpers: PKCE (RFC 7636) + in-memory state nonce store.
The state store is replaced with Redis in Phase 3 (feature 3.2).
"""
import hashlib
import base64
import secrets
from typing import Optional, Tuple


def generate_pkce_pair() -> Tuple[str, str]:
    """Return (code_verifier, code_challenge) per RFC 7636 S256 method."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def generate_state() -> str:
    """Return a cryptographically random URL-safe state token."""
    return secrets.token_urlsafe(32)


# In-memory store: state → {connector_id, user_id, code_verifier, platform, …}
# Process-local only — fine for single-worker dev; Phase 3 replaces with Redis.
_state_store: dict[str, dict] = {}


def store_state(state: str, **payload) -> None:
    _state_store[state] = payload


def consume_state(state: str) -> Optional[dict]:
    """Pop and return the payload for the given state, or None if not found."""
    return _state_store.pop(state, None)
