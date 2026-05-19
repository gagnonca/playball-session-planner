-- Mirror the iOS team roster (`_players`) onto the team row so the web
-- game editor can pick captain and available players from the same set
-- that exists on the phone. Stored as a normalized JSONB array of
-- { id, name, tintHex } — game.payload.availablePlayers and
-- game.payload.captainID already reference these IDs.

alter table teams add column if not exists players jsonb not null default '[]'::jsonb;
