-- Remove YouTube-related columns from profiles table since we're using centralized YouTube account
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS youtube_access_token,
DROP COLUMN IF EXISTS youtube_refresh_token,
DROP COLUMN IF EXISTS youtube_channel_id,
DROP COLUMN IF EXISTS youtube_channel_title;