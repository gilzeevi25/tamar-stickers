"""Google ID token verification + email allowlist for FastAPI routes."""

from __future__ import annotations

import os
from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


@lru_cache(maxsize=1)
def _client_id() -> str:
    value = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not value:
        raise RuntimeError("GOOGLE_CLIENT_ID is not set")
    return value


@lru_cache(maxsize=1)
def _allowed_emails() -> frozenset[str]:
    raw = os.environ.get("ALLOWED_EMAILS", "")
    return frozenset(e.strip().lower() for e in raw.split(",") if e.strip())


@lru_cache(maxsize=1)
def _request_session() -> google_requests.Request:
    return google_requests.Request()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_user(authorization: str | None = Header(default=None)) -> str:
    """Verify the Google ID token and enforce the email allowlist.

    Returns the verified email so handlers can log it.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized("missing_bearer_token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise _unauthorized("missing_bearer_token")

    try:
        claims = id_token.verify_oauth2_token(
            token, _request_session(), _client_id()
        )
    except ValueError:
        raise _unauthorized("invalid_token") from None

    if not claims.get("email_verified"):
        raise _unauthorized("email_not_verified")

    email = str(claims.get("email", "")).lower()
    if not email or email not in _allowed_emails():
        raise _unauthorized("email_not_allowed")

    return email


VerifiedUser = Depends(verify_user)
