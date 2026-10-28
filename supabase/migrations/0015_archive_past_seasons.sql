-- Teams the iPhone app marked "past season" (ios.isActive = false) before the
-- API copied that into `archived`. From here on `archived` is the one stored
-- flag and the app reads its past-season state from it, so set it first:
-- otherwise the app would see these as active and move them back.

update teams
set archived = true
where deleted_at is null
  and archived = false
  and ios->>'isActive' = 'false';
