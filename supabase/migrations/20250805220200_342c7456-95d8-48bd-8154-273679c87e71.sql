-- Add stream_url column to cameras table
ALTER TABLE public.cameras 
ADD COLUMN stream_url text;