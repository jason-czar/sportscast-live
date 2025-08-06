-- Update user role to director so they can start streams
UPDATE public.user_roles 
SET role = 'director'::app_role 
WHERE user_id = '20c5c7d1-974b-44ae-8e0e-023085f93e2e';