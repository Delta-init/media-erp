"""
AES-256-GCM encryption for OAuth access/refresh tokens stored in MongoDB.
The 32-byte key is read from settings.encryption_key (64 hex chars).
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings


def _key() -> bytes:
    return bytes.fromhex(settings.encryption_key)


def encrypt(plaintext: str) -> str:
    """Encrypts plaintext → base64(12-byte nonce || ciphertext+tag)."""
    nonce = os.urandom(12)
    ct = AESGCM(_key()).encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt(token: str) -> str:
    """Decrypts base64(nonce || ciphertext+tag) → plaintext."""
    raw = base64.b64decode(token)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(_key()).decrypt(nonce, ct, None).decode()
