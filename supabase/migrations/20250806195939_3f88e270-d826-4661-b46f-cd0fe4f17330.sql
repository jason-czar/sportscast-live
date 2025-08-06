-- Remove Twitch stream key column since we're only supporting YouTube
ALTER TABLE public.events DROP COLUMN IF EXISTS twitch_stream_key;