-- Add YouTube OAuth fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT,
ADD COLUMN IF NOT EXISTS youtube_channel_title TEXT;

-- Add YouTube broadcast/stream tracking to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS youtube_broadcast_id TEXT,
ADD COLUMN IF NOT EXISTS youtube_stream_id TEXT;