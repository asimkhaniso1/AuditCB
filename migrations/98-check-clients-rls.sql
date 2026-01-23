-- CHECK EXISTING POLICIES FOR CLIENTS
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- CHECK IF RLS IS ENABLED
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'clients';
