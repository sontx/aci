from __future__ import annotations

import base64
import hashlib
import hmac
import os
from dataclasses import dataclass
from typing import Dict, Optional

import aws_encryption_sdk  # type: ignore
import boto3  # type: ignore
from aws_cryptographic_material_providers.mpl import (  # type: ignore
    AwsCryptographicMaterialProviders,
)
from aws_cryptographic_material_providers.mpl.config import MaterialProvidersConfig  # type: ignore
from aws_cryptographic_material_providers.mpl.models import CreateAwsKmsKeyringInput  # type: ignore
from aws_cryptographic_material_providers.mpl.references import IKeyring  # type: ignore
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from aci.common import config

# ---- Wire format constants ---------------------------------------------------
MAGIC = b"ACI"  # 3 bytes as a quick sanity check
FORMAT_VER = 1  # 1 byte
NONCE_LEN = 12  # 96-bit nonce for AES-GCM
TAG_LEN = 16  # AES-GCM tag length (implicit at end of ct)
_HDR_PREFIX = MAGIC + bytes([FORMAT_VER])


# Header layout (after MAGIC+VER):
#  - key_id_len: 1 byte
#  - key_id: key_id_len bytes (utf-8)
#  - nonce: 12 bytes
# Then: ciphertext||tag


# ---- Errors ------------------------------------------------------------------
class EncryptionError(Exception):
    pass


class DecryptionError(Exception):
    pass


class UnknownKeyError(DecryptionError):
    pass


# ---- Key material ------------------------------------------------------------
@dataclass(frozen=True)
class KeyMaterial:
    key_id: str  # human-readable ID, e.g. '2025-08-01'
    key_bytes: bytes  # 16, 24, or 32 bytes for AES-128/192/256


def _decode_key_material(raw: str) -> bytes:
    """
    Accept keys in hex or base64. Raise if size is not valid for AES-GCM.
    """
    raw = raw.strip()
    kb: Optional[bytes] = None
    # Try hex
    try:
        kb = bytes.fromhex(raw)
    except ValueError:
        pass
    if kb is None:
        # Try base64 (std or urlsafe)
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                kb = decoder(raw)
                break
            except Exception:
                kb = None
    if kb is None:
        raise ValueError("Key must be hex or base64 encoded")
    if len(kb) not in (16, 24, 32):
        raise ValueError("AES-GCM key must be 16/24/32 bytes")
    return kb


# ---- Key store with rotation -------------------------------------------------
class KeyStore:
    """
    Holds a set of keys and the current key_id used for new encryptions.
    keys: mapping of key_id -> raw AES key bytes.
    """

    def __init__(self, keys: Dict[str, bytes], current_key_id: str):
        if current_key_id not in keys:
            raise ValueError("current_key_id must exist in keys")
        self._keys = dict(keys)
        self._current = current_key_id

    @property
    def current_key_id(self) -> str:
        return self._current

    def set_current(self, key_id: str) -> None:
        if key_id not in self._keys:
            raise ValueError("Unknown key_id")
        self._current = key_id

    def add_key(self, key_id: str, key_b64_or_hex: str) -> None:
        kb = _decode_key_material(key_b64_or_hex)
        self._keys[key_id] = kb

    def get(self, key_id: str) -> bytes:
        try:
            return self._keys[key_id]
        except KeyError:
            raise UnknownKeyError(f"Key id '{key_id}' not found")

    def current_aesgcm(self) -> tuple[str, AESGCM]:
        key_id = self._current
        return key_id, AESGCM(self._keys[key_id])

    def aesgcm_for(self, key_id: str) -> AESGCM:
        return AESGCM(self.get(key_id))


# ---- Encrypt / Decrypt -------------------------------------------------------
class Encryptor:
    def __init__(self, keystore: KeyStore):
        self._ks = keystore

    def encrypt(self, plain_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
        """
        Encrypts data with the current key. Returns bytes with self-describing header.
        """
        key_id, aead = self._ks.current_aesgcm()
        nonce = os.urandom(NONCE_LEN)

        key_id_bytes = key_id.encode("utf-8")
        if len(key_id_bytes) > 255:
            raise EncryptionError("key_id is too long (>255 bytes)")

        header = _HDR_PREFIX + bytes([len(key_id_bytes)]) + key_id_bytes + nonce
        ct = aead.encrypt(nonce, plain_data, aad)
        return header + ct

    def decrypt(self, cipher_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
        """
        Decrypts data produced by `encrypt`. Auto-selects the correct key by key_id.
        """
        try:
            if len(cipher_data) < len(MAGIC) + 1 + 1 + NONCE_LEN + TAG_LEN:
                raise DecryptionError("Ciphertext too short")

            # Check magic + version
            if cipher_data[0:3] != MAGIC or cipher_data[3] != FORMAT_VER:
                raise DecryptionError("Invalid header (magic/version mismatch)")

            pos = 4
            key_id_len = cipher_data[pos]
            pos += 1
            end_key = pos + key_id_len
            key_id = cipher_data[pos:end_key].decode("utf-8")
            pos = end_key

            nonce = cipher_data[pos:pos + NONCE_LEN]
            pos += NONCE_LEN

            ct = cipher_data[pos:]
            if len(ct) < TAG_LEN:
                raise DecryptionError("Ciphertext missing tag")

            aead = self._ks.aesgcm_for(key_id)
            return aead.decrypt(nonce, ct, aad)
        except UnknownKeyError:
            raise
        except Exception as e:
            raise DecryptionError(f"Decryption failed: {e}") from e

    def reencrypt_to_current(self, cipher_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
        """
        If `cipher_data` was encrypted with a non-current key, decrypt and re-encrypt with the current key.
        If already using the current key, returns the input unchanged.
        """
        # Peek current key_id in blob without decrypting
        self.assert_header(cipher_data)
        key_id_in_blob = self.read_key_id(cipher_data)
        if key_id_in_blob == self._ks.current_key_id:
            return cipher_data  # already current

        plain = self.decrypt(cipher_data, aad=aad)
        return self.encrypt(plain, aad=aad)

    # ---- helpers to introspect header ----------------------------------------
    @staticmethod
    def assert_header(buf: bytes) -> None:
        if len(buf) < 5 or buf[0:3] != MAGIC or buf[3] != FORMAT_VER:
            raise DecryptionError("Invalid header")

    @staticmethod
    def read_key_id(buf: bytes) -> str:
        pos = 4
        key_id_len = buf[pos]
        pos += 1
        end_key = pos + key_id_len
        return buf[pos:end_key].decode("utf-8")


# ---- Example configuration binding ------------------------------------------
# Replace these with your own config loader. Keys can be provided as hex or base64.
# For production, store keys in a secure secret manager (e.g., AWS Secrets Manager),
# NOT in source code or plain environment variables.
def load_keystore_from_config() -> KeyStore:
    """
    Example: load from your `aci.common.config`, where:
      - config.ENCRYPTION_KEYS is a dict {key_id: key_material_str}
      - config.CURRENT_KEY_ID is the active key id
    """
    keys: Dict[str, bytes] = {
        key_id: _decode_key_material(kstr)
        for key_id, kstr in config.ENCRYPTION_KEYS.items()
    }
    return KeyStore(keys=keys, current_key_id=config.CURRENT_KEY_ID)


# ---- Public module-level helpers to match your previous API ------------------
# Keep the same function names/signature you already use elsewhere.
keystore = load_keystore_from_config()
_encryptor = Encryptor(keystore)


def encrypt(plain_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
    """
    Encrypt using the current key. Returns header+ciphertext bytes.
    """
    return _encryptor.encrypt(plain_data, aad=aad)


def decrypt(cipher_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
    """
    Decrypt, automatically selecting the key by id from the header.
    """
    return _encryptor.decrypt(cipher_data, aad=aad)


def needs_rotation(cipher_data: bytes) -> bool:
    """
    Fast check: does this blob use a non-current key?
    """
    Encryptor.assert_header(cipher_data)
    key_id_in_blob = Encryptor.read_key_id(cipher_data)
    return key_id_in_blob != keystore.current_key_id


def reencrypt_to_current(cipher_data: bytes, *, aad: Optional[bytes] = None) -> bytes:
    """
    Decrypt and re-encrypt with the current key if needed.
    """
    return _encryptor.reencrypt_to_current(cipher_data, aad=aad)


def hmac_sha256(message: str) -> str:
    return hmac.new(
        config.API_KEY_HASHING_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()
