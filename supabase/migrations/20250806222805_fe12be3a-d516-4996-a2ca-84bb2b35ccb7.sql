-- Remove Telegram-related columns from events table
ALTER TABLE public.events 
DROP COLUMN IF EXISTS telegram_channel_id,
DROP COLUMN IF EXISTS telegram_invite_link;