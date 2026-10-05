from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for domain errors. `code` is a stable machine-readable
    string the frontend maps to a localized message — the backend never
    returns localized text for these."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "APP_ERROR"

    def __init__(self, message: str = "", details: dict | None = None):
        self.message = message or self.code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class ValidationAppError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"

    def __init__(self, message: str = "", retry_after: int | None = None):
        super().__init__(message)
        # Seconds until the window resets — sent as a Retry-After header.
        self.headers = {"Retry-After": str(retry_after)} if retry_after else {}


class ServiceNotConfiguredError(AppError):
    """A third-party integration (Stripe, R2, …) has no credentials in this
    environment — a clear 503 rather than the SDK's own auth error as a 500."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "SERVICE_NOT_CONFIGURED"


class InvalidCredentialsError(UnauthorizedError):
    code = "INVALID_CREDENTIALS"


class TripFullError(ConflictError):
    code = "TRIP_FULL"


class AdminAccountError(ForbiddenError):
    code = "ADMIN_ACCOUNT"


class TripNotBookableError(ConflictError):
    code = "TRIP_NOT_BOOKABLE"


class EmailAlreadyRegisteredError(ConflictError):
    code = "EMAIL_ALREADY_REGISTERED"


# One sign-in method per account: an account made with a password signs in
# with that password, one made with Google signs in with Google. Trying the
# other way is refused with a code that tells the person which to use.
class UseGoogleSignInError(ConflictError):
    code = "USE_GOOGLE_SIGN_IN"


class UsePasswordSignInError(ConflictError):
    code = "USE_PASSWORD_SIGN_IN"


class GoogleAccountNotRegisteredError(NotFoundError):
    """Google sign-in from the *log in* form for a Google account that has
    never signed up here."""

    code = "GOOGLE_ACCOUNT_NOT_REGISTERED"


def _error_response(status_code: int, code: str, message: str, details: dict) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "details": details},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        response = _error_response(exc.status_code, exc.code, exc.message, exc.details)
        response.headers.update(getattr(exc, "headers", {}))
        return response

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error_response(
            422,
            "VALIDATION_ERROR",
            "Request validation failed.",
            # jsonable_encoder: errors raised by custom validators carry the
            # original exception object in `ctx`, which plain JSON can't encode.
            {"errors": jsonable_encoder(exc.errors())},
        )
