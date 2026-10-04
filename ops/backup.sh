#!/bin/sh
# Nightly Postgres backups for the prod VM (docker-compose.prod.yml `backup`
# service). Each run writes a gzipped pg_dump to /backups, prunes dumps older
# than BACKUP_RETENTION_DAYS, and — if BACKUP_S3_BUCKET is set — copies the
# new dump off the VM to S3-compatible storage (e.g. a private R2 bucket),
# since a backup that lives only on the same disk doesn't survive losing it.
#
# Restore (on the VM):
#   gunzip -c backups/runtrips-<timestamp>.sql.gz \
#     | docker compose -f docker-compose.prod.yml exec -T postgres psql -U runtrips -d runtrips
set -eu

: "${PGHOST:=postgres}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"
export PGHOST

dump() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  file="$BACKUP_DIR/runtrips-$ts.sql.gz"
  # Write to a temp name first so a failed/partial dump never looks like a good
  # one. pg_dump compresses itself (-Z, plain SQL inside the gzip) rather than
  # piping into gzip, so its own exit status is what gets checked — a pipe
  # would report gzip's success even when the dump failed.
  if ! pg_dump --no-owner --no-privileges -Z 6 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$file.partial"; then
    rm -f "$file.partial"
    echo "[backup] pg_dump FAILED at $ts" >&2
    return 1
  fi
  mv "$file.partial" "$file"
  echo "[backup] wrote $file ($(du -h "$file" | cut -f1))"

  find "$BACKUP_DIR" -name 'runtrips-*.sql.gz' -mtime +"$BACKUP_RETENTION_DAYS" -print -delete

  if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    aws s3 cp "$file" "s3://$BACKUP_S3_BUCKET/postgres/" ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"}
    echo "[backup] uploaded to s3://$BACKUP_S3_BUCKET/postgres/"
  fi
}

if [ "${1:-}" = "--once" ]; then
  dump
  exit $?
fi

if [ -n "${BACKUP_S3_BUCKET:-}" ] && ! command -v aws >/dev/null 2>&1; then
  apk add --no-cache aws-cli >/dev/null
fi

mkdir -p "$BACKUP_DIR"
while true; do
  dump || true  # keep the loop alive; the failure is in the logs
  sleep "$BACKUP_INTERVAL_SECONDS"
done
