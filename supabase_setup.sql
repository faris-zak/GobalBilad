-- =============================================
--  GobalBilad — Supabase Database Setup
--  Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. STORES TABLE
-- One store per owner. The store ID matches the auth user ID.
CREATE TABLE IF NOT EXISTS stores (
  id          UUID PRIMARY KEY,          -- matches auth.users.id
  name        TEXT NOT NULL,
  description TEXT,
  phone       TEXT,
  instagram   TEXT,
  category    TEXT DEFAULT 'grocery',    -- grocery, bakery, meat, dairy, sweets, drinks
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
-- Each product belongs to a store
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       NUMERIC(10, 3) NOT NULL,   -- 3 decimal places for Omani Baisa
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
--  ROW LEVEL SECURITY (RLS)
--  Required for Supabase auth to work properly
-- =============================================

-- Enable RLS on both tables
ALTER TABLE stores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- STORES policies:
-- Anyone can READ stores (public browsing)
CREATE POLICY "Public can view stores"
  ON stores FOR SELECT USING (true);

-- Only the owner (matching auth user) can INSERT their store
CREATE POLICY "Owner can create store"
  ON stores FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Only the owner can UPDATE their store
CREATE POLICY "Owner can update store"
  ON stores FOR UPDATE
  USING (auth.uid() = id);

-- PRODUCTS policies:
-- Anyone can READ products
CREATE POLICY "Public can view products"
  ON products FOR SELECT USING (true);

-- Only the store owner can INSERT products into their store
CREATE POLICY "Owner can add products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = store_id);

-- Only the store owner can UPDATE their products
CREATE POLICY "Owner can update products"
  ON products FOR UPDATE
  USING (auth.uid() = store_id);

-- Only the store owner can DELETE their products
CREATE POLICY "Owner can delete products"
  ON products FOR DELETE
  USING (auth.uid() = store_id);

-- =============================================
--  SAMPLE DATA (optional — for testing)
--  Remove or comment out before going live
-- =============================================

-- NOTE: You'll need a real UUID from an auth user to insert stores.
-- These are just examples. Create a test account first, copy the UUID,
-- then replace 'YOUR_USER_UUID_HERE' below.

/*
INSERT INTO stores (id, name, description, phone, instagram, category) VALUES
  ('YOUR_USER_UUID_HERE', 'Al-Noor Bakery', 'Fresh bread and Omani sweets daily', '96812345678', 'https://instagram.com/alnoor', 'bakery'),
  ('YOUR_USER_UUID_HERE', 'Al-Baraka Grocery', 'Your neighbourhood grocery store', '96887654321', null, 'grocery');
*/
