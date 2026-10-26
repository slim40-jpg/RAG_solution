"""Cloud tasks — submit coding tasks to Free.ai's GPU fleet from the terminal.

API: https://free.ai/api/v1/tasks/code/  (Bearer auth with a Free.ai API key
from https://free.ai/developer/ — the free tier works).
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx

from free_code import __version__
from free_code.config import load_config

DEFAULT_TIMEOUT = 30.0
DOWNLOAD_TIMEOUT = 300.0
POLL_INTERVAL = 5.0

LOGIN_HINT = (
    "No Free.ai API key configured.\n"
    "Run [bold]free-code login[/bold] and paste an API key from "
    "[link=https://free.ai/developer/]https://free.ai/developer/[/link] "
    "(the free tier works)."
)


class CloudError(Exception):
    """A cloud task API call failed."""


class AuthRequired(CloudError):
    """No token configured, or the server rejected it (401)."""


def _error_message(resp: httpx.Response) -> str:
    """Extract a human-readable error message from an API response."""
    try:
        data = resp.json()
        if isinstance(data, dict):
            for key in ("error", "detail", "message"):
                if data.get(key):
                    return str(data[key])
    except Exception:
        pass
    body = resp.text.strip()
    return body[:300] if body else f"HTTP {resp.status_code}"


class CloudClient:
    """Synchronous client for the Free.ai cloud task API."""

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = config or load_config()
        base = self.config.get("sync_url") or "https://free.ai/api"
        self.base = str(base).rstrip("/")
        self.token = self.config.get("token")

    @property
    def headers(self) -> Dict[str, str]:
        headers = {
            "User-Agent": f"free-code/{__version__}",
            "Content-Type": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _url(self, path: str = "") -> str:
        return f"{self.base}/v1/tasks/code/{path}"

    def _check_auth(self) -> None:
        if not self.token:
            raise AuthRequired(LOGIN_HINT)

    def _check_response(self, resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise AuthRequired(LOGIN_HINT)
        if resp.status_code == 429:
            raise CloudError(_error_message(resp))

    def submit(
        self,
        prompt: str,
        repo_url: Optional[str] = None,
        model: str = "qwen-coder-32b",
    ) -> Dict[str, Any]:
        """Submit a cloud task. Returns the created task dict (id, queue position)."""
        self._check_auth()
        payload: Dict[str, Any] = {
            "prompt": prompt,
            "repo_url": repo_url,
            "model": model,
            "notify_email": True,
        }
        try:
            resp = httpx.post(
                self._url(),
                json=payload,
                headers=self.headers,
                timeout=DEFAULT_TIMEOUT,
            )
        except httpx.HTTPError as e:
            raise CloudError(f"Cannot reach Free.ai: {e}") from e
        self._check_response(resp)
        if resp.status_code not in (200, 201, 202):
            raise CloudError(f"API error {resp.status_code}: {_error_message(resp)}")
        data = resp.json()
        return _unwrap_task(data)

    def get(self, task_id: str) -> Dict[str, Any]:
        """Fetch a single task's current state."""
        self._check_auth()
        try:
            resp = httpx.get(
                self._url(f"{task_id}/"),
                headers=self.headers,
                timeout=DEFAULT_TIMEOUT,
            )
        except httpx.HTTPError as e:
            raise CloudError(f"Cannot reach Free.ai: {e}") from e
        self._check_response(resp)
        if resp.status_code != 200:
            raise CloudError(f"API error {resp.status_code}: {_error_message(resp)}")
        data = resp.json()
        return _unwrap_task(data)

    def list(self) -> List[Dict[str, Any]]:
        """List recent cloud tasks."""
        self._check_auth()
        try:
            resp = httpx.get(
                self._url(),
                headers=self.headers,
                timeout=DEFAULT_TIMEOUT,
            )
        except httpx.HTTPError as e:
            raise CloudError(f"Cannot reach Free.ai: {e}") from e
        self._check_response(resp)
        if resp.status_code != 200:
            raise CloudError(f"API error {resp.status_code}: {_error_message(resp)}")
        data = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("tasks", "results", "data"):
                if isinstance(data.get(key), list):
                    return data[key]
        return []

    def download_output(self, output_url: str, dest_dir: str) -> Path:
        """Download the task's output zip into dest_dir and unzip it there.

        Returns the directory the archive was extracted into.
        """
        url = urljoin("https://free.ai/", output_url)
        dest = Path(dest_dir).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        zip_path = dest / "free-code-task-output.zip"
        try:
            with httpx.stream(
                "GET",
                url,
                headers=self.headers,
                timeout=DOWNLOAD_TIMEOUT,
                follow_redirects=True,
            ) as resp:
                if resp.status_code != 200:
                    raise CloudError(f"Download failed: HTTP {resp.status_code}")
                with open(zip_path, "wb") as f:
                    for chunk in resp.iter_bytes():
                        f.write(chunk)
        except httpx.HTTPError as e:
            raise CloudError(f"Download failed: {e}") from e
        try:
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(dest)
        except zipfile.BadZipFile as e:
            raise CloudError(f"Output is not a valid zip archive: {zip_path}") from e
        zip_path.unlink(missing_ok=True)
        return dest


def task_id_of(task: Dict[str, Any]) -> str:
    """Best-effort task id from an API response."""
    return str(task.get("id") or task.get("task_id") or "")


def _unwrap_task(data: Any) -> Dict[str, Any]:
    """Both endpoints wrap the task: submit returns {"task": {...},
    "poll_url": ...} and detail returns {"ok": true, "task": {...}}."""
    if not isinstance(data, dict):
        return {}
    inner = data.get("task")
    return inner if isinstance(inner, dict) else data


def queue_position_of(task: Dict[str, Any]) -> Optional[int]:
    """Best-effort queue position from an API response."""
    for key in ("queue_position", "position"):
        value = task.get(key)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
    return None
