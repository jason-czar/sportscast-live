-- Fix security warning by adding search_path to function
CREATE OR REPLACE FUNCTION public.assign_youtube_stream_key()
RETURNS TRIGGER AS $$
DECLARE
  available_key TEXT;
BEGIN
  -- Only assign for live events that don't already have a key
  IF NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live') AND NEW.youtube_stream_key IS NULL THEN
    -- Find an available stream key
    SELECT stream_key INTO available_key
    FROM public.youtube_stream_keys 
    WHERE is_active = false 
    ORDER BY created_at 
    LIMIT 1;
    
    -- If we found an available key, assign it
    IF available_key IS NOT NULL THEN
      -- Mark the key as active and assign to this event
      UPDATE public.youtube_stream_keys 
      SET is_active = true, assigned_event_id = NEW.id, updated_at = now()
      WHERE stream_key = available_key;
      
      -- Update the event with the assigned key
      NEW.youtube_stream_key = available_key;
    END IF;
  END IF;
  
  -- Release stream key when event ends
  IF NEW.status = 'ended' AND OLD.status = 'live' AND NEW.youtube_stream_key IS NOT NULL THEN
    UPDATE public.youtube_stream_keys 
    SET is_active = false, assigned_event_id = NULL, updated_at = now()
    WHERE stream_key = NEW.youtube_stream_key;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;