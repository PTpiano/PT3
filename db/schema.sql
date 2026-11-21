-- ═══════════════════════════════════════════════════════════════
-- Schema completo del sito — consolidato dalle migrazioni Supabase
-- (supabase/migrations/*.sql) e da types/supabase.ts.
-- Compatibile con PostgreSQL 14+ e PGlite.
-- RLS assente: l'accesso è solo via API route (auth JWT in app/utils/auth.ts).
-- ═══════════════════════════════════════════════════════════════

-- ── Albums ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL DEFAULT 'Peppe Taglieri',
  description TEXT,
  cover_url TEXT,
  back_cover_url TEXT,
  release_date DATE,
  year INTEGER,
  genre VARCHAR(100),
  duration INTEGER,
  is_featured BOOLEAN DEFAULT FALSE,
  is_latest BOOLEAN DEFAULT FALSE,
  spotify_url TEXT,
  apple_music_url TEXT,
  bandcamp_url TEXT,
  youtube_url TEXT,
  soundcloud_url TEXT,
  -- Store
  price_cd NUMERIC,
  price_vinyl NUMERIC,
  price_digital NUMERIC,
  price_hires NUMERIC(10,2),
  price_tape NUMERIC(10,2),
  stock_cd INTEGER DEFAULT 0,
  stock_vinyl INTEGER DEFAULT 0,
  stock_tape INTEGER,
  is_on_offer BOOLEAN DEFAULT FALSE,
  discount_percent INTEGER DEFAULT 0,
  -- Visibilità nello shop: false = album bozza, nascosto ai visitatori.
  published BOOLEAN DEFAULT TRUE,
  -- Configurazione shop completa (formati abilitati, prezzi, file di
  -- download per formato). JSONB perché la forma cambia per album.
  -- Se NULL il sito usa i campi price_*/stock_* (comportamento storico).
  shop_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_featured ON albums(is_featured);
CREATE INDEX IF NOT EXISTS idx_albums_latest ON albums(is_latest);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date);

-- ── Tracks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  duration INTEGER,
  track_number INTEGER NOT NULL,
  audio_url TEXT,
  lyrics TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  -- false = brano bozza: esiste nell'album ma non viene riprodotto.
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_track_number ON tracks(track_number);
CREATE INDEX IF NOT EXISTS idx_tracks_featured ON tracks(is_featured) WHERE is_featured = true;

-- ── Album photos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS album_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  category VARCHAR(50) CHECK (category IN ('RECORDING', 'STUDIO', 'INSTRUMENTS', 'BACKSTAGE', 'ARTWORK', 'OTHER')) DEFAULT 'OTHER',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_sort_order ON album_photos(album_id, sort_order);

-- ── Gallery folders ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  cover TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Gallery images ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  src TEXT NOT NULL,
  category TEXT CHECK (category IN ('LIVE', 'STUDIO', 'BACKSTAGE')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  featured BOOLEAN DEFAULT FALSE,
  type VARCHAR(10) DEFAULT 'image' CHECK (type IN ('image', 'video')),
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_type ON images(type);
CREATE INDEX IF NOT EXISTS idx_images_folder ON images(folder_id);

-- ── Tour dates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  time TEXT NOT NULL,
  ticket_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_dates_city ON tour_dates USING btree (lower(city));

-- ── Social ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'spotify', 'facebook', 'twitter', 'tiktok')),
  post_type TEXT NOT NULL DEFAULT 'image',
  title TEXT,
  caption TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  external_url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  views TEXT,
  duration TEXT,
  date_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Contact messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'booking',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);

-- ── Orders (Stripe) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  customer_email TEXT,
  shipping_address JSONB,
  total_amount INTEGER,
  status TEXT CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  album_id UUID REFERENCES albums(id),
  format TEXT,
  quantity INTEGER,
  price INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ── Live performances / studio sessions ────────────────────────
CREATE TABLE IF NOT EXISTS live_performances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  duration INTEGER,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  duration INTEGER,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Settings (key/value JSON — sostituisce data/*.json) ────────
-- Su Vercel il filesystem è read-only: site-status e social-config
-- vivono qui invece che su file.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Trigger updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['albums', 'tracks', 'album_photos', 'folders', 'images',
                           'social_accounts', 'social_posts', 'live_performances', 'studio_sessions']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
       CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END $$;
