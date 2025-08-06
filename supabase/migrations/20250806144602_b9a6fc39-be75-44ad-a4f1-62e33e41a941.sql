-- Update the streaming_type check constraint to include 'livekit'
ALTER TABLE public.events 
DROP CONSTRAINT IF EXISTS events_streaming_type_check;

-- Add the updated constraint that includes 'livekit'
ALTER TABLE public.events 
ADD CONSTRAINT events_streaming_type_check 
CHECK (streaming_type = ANY (ARRAY['mobile'::text, 'telegram'::text, 'livekit'::text]));