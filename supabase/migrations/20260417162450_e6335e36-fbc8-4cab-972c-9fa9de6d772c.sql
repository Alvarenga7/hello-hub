
DROP POLICY IF EXISTS "Public read clinic logos" ON storage.objects;
CREATE POLICY "Authenticated read clinic logos list" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-logos' AND auth.uid() IS NOT NULL);
