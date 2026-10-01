// Mirrors backend/app/core/security.py's STRONG_PASSWORD_PATTERN.
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,128}$/;
