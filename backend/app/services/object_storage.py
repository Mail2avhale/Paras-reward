import asyncio
import logging
import os

import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "paras-reward"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "csv": "text/csv", "txt": "text/plain",
}

_storage_key = None


def mime_for(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return MIME_TYPES.get(ext, "application/octet-stream")


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, path: str, extra_headers: dict = None, **kwargs) -> requests.Response:
    url = f"{STORAGE_URL}/objects/{path}"
    resp = requests.request(method, url, headers={"X-Storage-Key": init_storage(), **(extra_headers or {})}, **kwargs)
    if resp.status_code == 404:
        # Storage key may have gone inactive — mint a fresh one and retry once
        resp = requests.request(method, url, headers={"X-Storage-Key": init_storage(force=True), **(extra_headers or {})}, **kwargs)
    resp.raise_for_status()
    return resp


def _put(path: str, data: bytes, content_type: str) -> str:
    resp = _request("PUT", path, extra_headers={"Content-Type": content_type}, data=data, timeout=120)
    return resp.json()["path"]


def _get(path: str) -> tuple:
    resp = _request("GET", path, timeout=60)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def put_object(subpath: str, data: bytes, content_type: str) -> str:
    """Upload bytes under the app prefix; returns the canonical storage path."""
    return await asyncio.to_thread(_put, f"{APP_NAME}/{subpath}", data, content_type)


async def get_object(path: str) -> tuple:
    return await asyncio.to_thread(_get, path)


async def read_stored_file(path: str) -> tuple:
    """Return (bytes, content_type) for a storage path; legacy on-disk paths are still readable."""
    if path.startswith("/") and os.path.exists(path):
        return await asyncio.to_thread(_read_local, path), mime_for(path)
    return await get_object(path)


def _read_local(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def startup_init():
    try:
        init_storage()
        logging.info("[STORAGE] Object storage initialized")
    except Exception as e:
        logging.error(f"[STORAGE] init failed: {e}")
