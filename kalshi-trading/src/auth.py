"""RSA-SHA256 PSS authentication for Kalshi API (WebSocket and REST)."""

import base64
import time

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey

WEBSOCKET_PATH = "/trade-api/ws/v2"


def make_auth_headers(
    kalshi_id: str,
    private_key_pem: str,
    method: str = "GET",
    path: str = WEBSOCKET_PATH,
) -> dict[str, str]:
    timestamp = str(int(time.time() * 1000))
    message = (timestamp + method + path).encode()

    loaded = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    if not isinstance(loaded, RSAPrivateKey):
        raise RuntimeError("KALSHI_KEY must be an RSA private key")
    signature = loaded.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=32,
        ),
        hashes.SHA256(),
    )

    return {
        "KALSHI-ACCESS-KEY": kalshi_id,
        "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
    }
