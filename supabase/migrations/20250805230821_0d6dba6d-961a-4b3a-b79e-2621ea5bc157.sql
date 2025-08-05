-- Allow unauthenticated users to register as cameras for events
-- This enables guest camera access without requiring login

-- Update cameras table policies to allow guest registration
DROP POLICY IF EXISTS "Event owners and directors can register cameras" ON public.cameras;

-- New policy: Allow anyone to register cameras (guest access)
CREATE POLICY "Anyone can register cameras for events"
ON public.cameras
FOR INSERT
WITH CHECK (
  -- Verify the event exists and is active (scheduled or live)
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = cameras.event_id 
    AND (events.status = 'scheduled'::event_status OR events.status = 'live'::event_status)
  )
);

-- Allow unauthenticated users to update camera status (for streaming)
CREATE POLICY "Anyone can update camera status for streaming"
ON public.cameras
FOR UPDATE
USING (
  -- Allow updates to is_live, is_active, stream_url, stream_key columns
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = cameras.event_id 
    AND (events.status = 'scheduled'::event_status OR events.status = 'live'::event_status)
  )
);

-- Keep the existing policies for authenticated users (event owners/directors)
CREATE POLICY "Event owners and directors can manage cameras"
ON public.cameras
FOR ALL
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = cameras.event_id 
    AND (
      events.owner_id = auth.uid() 
      OR has_role(auth.uid(), 'director'::app_role) 
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Update the register-camera edge function configuration to not require JWT
-- This will be handled in the supabase config