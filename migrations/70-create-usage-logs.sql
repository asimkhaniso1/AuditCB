-- Create API Usage Logs table
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    feature TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10, 6) DEFAULT 0, -- Store cost with high precision
    success BOOLEAN DEFAULT TRUE,
    model TEXT,
    user_id UUID, -- Optional link to user
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add RLS policies
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
CREATE POLICY "Allow insert for authenticated users" 
ON public.api_usage_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow admins to view all logs
-- Note: Requires a way to identify admins, usually via a custom claim or a users table lookup
-- For now, we'll allow users to view their own logs if user_id matches auth.uid()
CREATE POLICY "Allow users to view own logs" 
ON public.api_usage_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
