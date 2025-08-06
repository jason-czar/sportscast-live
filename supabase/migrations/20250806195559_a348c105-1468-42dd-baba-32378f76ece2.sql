-- Create table for managing YouTube stream key pool
CREATE TABLE public.youtube_stream_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  assigned_event_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_stream_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage stream keys
CREATE POLICY "Admins can manage YouTube stream keys" 
ON public.youtube_stream_keys 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert the stream keys from your screenshots
INSERT INTO public.youtube_stream_keys (stream_key) VALUES 
  ('d6k5-24cf-vr21-3gm6-9e47'),
  ('3xsg-ezxy-8jy0-eza4-34wv'),
  ('y76z-p2b3-y346-d2md-apbg');

-- Create function to automatically assign stream keys
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic stream key assignment
CREATE TRIGGER assign_youtube_stream_key_trigger
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_youtube_stream_key();

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_youtube_stream_keys_updated_at
  BEFORE UPDATE ON public.youtube_stream_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();