alter table provider_token_audit_events
  drop constraint if exists provider_token_audit_events_event_type_check;

alter table provider_token_audit_events
  add constraint provider_token_audit_events_event_type_check
  check (
    event_type in (
      'refresh_success',
      'refresh_failed',
      'fetch_failed',
      'revoked',
      'archive_success',
      'archive_failed',
      'send_success',
      'send_failed',
      'trash_success',
      'trash_failed'
    )
  );
