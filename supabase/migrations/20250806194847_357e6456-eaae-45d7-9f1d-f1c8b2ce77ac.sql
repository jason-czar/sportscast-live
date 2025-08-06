-- Add YouTube stream key field to events table for multi-stream support
ALTER TABLE public.events 
ADD COLUMN youtube_stream_key TEXT;

-- Add Twitch stream key field as well for completeness
ALTER TABLE public.events 
ADD COLUMN twitch_stream_key TEXT;