-- In your Supabase dashboard, create a storage bucket called 'assets'
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true);