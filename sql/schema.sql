-- =====================================================
-- جوب البلاد (Gobal Bilad) — Database Schema
-- Al-Maamoura Local Marketplace, Oman
-- Version: 1.0.0
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Users — extends auth.users with profile data
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL DEFAULT '',
  email         TEXT          NOT NULL,
  phone         TEXT,
  role          TEXT          NOT NULL DEFAULT 'customer'
                              CHECK (role IN ('customer', 'store', 'driver', 'admin')),
  location_lat  DECIMAL(10,8),
  location_lng  DECIMAL(11,8),
  location_text TEXT,
  is_blocked    BOOLEAN       DEFAULT FALSE,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Stores — merchant businesses
CREATE TABLE IF NOT EXISTS public.stores (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  name              TEXT        NOT NULL,
  owner_name        TEXT        NOT NULL,
  phone             TEXT        NOT NULL,
  whatsapp          TEXT,
  description       TEXT,
  category          TEXT        DEFAULT 'general',
  location_text     TEXT,
  approved          BOOLEAN     DEFAULT FALSE,
  active            BOOLEAN     DEFAULT TRUE,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Products — items sold by stores
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  description TEXT,
  price       DECIMAL(10,3) NOT NULL CHECK (price >= 0),
  available   BOOLEAN       DEFAULT TRUE,
  image_url   TEXT,
  category    TEXT,
  sort_order  INTEGER       DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Drivers — delivery personnel
CREATE TABLE IF NOT EXISTS public.drivers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  phone             TEXT        NOT NULL,
  available         BOOLEAN     DEFAULT FALSE,
  active            BOOLEAN     DEFAULT TRUE,
  approved          BOOLEAN     DEFAULT FALSE,
  rejection_reason  TEXT,
  total_deliveries  INTEGER     DEFAULT 0,
  retired           BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Orders — customer purchase records
CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  store_id          UUID          REFERENCES public.stores(id) ON DELETE SET NULL,
  driver_id         UUID          REFERENCES public.drivers(id) ON DELETE SET NULL,
  status            TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN (
                                    'pending','confirmed','ready',
                                    'out_for_delivery','delivered','rejected'
                                  )),
  total_price       DECIMAL(10,3) NOT NULL,
  delivery_fee      DECIMAL(10,3) NOT NULL DEFAULT 0,
  customer_name     TEXT          NOT NULL,
  customer_phone    TEXT          NOT NULL,
  location_link     TEXT,
  notes             TEXT,
  is_free_delivery  BOOLEAN       DEFAULT FALSE,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- Order Items — individual lines within an order
CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  TEXT          NOT NULL,
  quantity      INTEGER       NOT NULL CHECK (quantity > 0),
  price         DECIMAL(10,3) NOT NULL CHECK (price >= 0),
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- App Configuration — key/value store for runtime settings
CREATE TABLE IF NOT EXISTS public.app_config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Free Delivery Tracker — one record per user who used their free delivery
CREATE TABLE IF NOT EXISTS public.free_delivery_used (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  used_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_store     ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON public.products(store_id, available);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store       ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver      ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created     ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stores_approved    ON public.stores(approved, active);
CREATE INDEX IF NOT EXISTS idx_drivers_available  ON public.drivers(available, active, approved);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-set updated_at on row modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create user profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    COALESCE(NEW.email, ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_delivery_used ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user owns a store
CREATE OR REPLACE FUNCTION public.owns_store(store_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = store_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is an approved driver
CREATE OR REPLACE FUNCTION public.is_approved_driver()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = auth.uid() AND approved = TRUE AND active = TRUE AND retired = FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- USERS
CREATE POLICY "users: read own"        ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users: update own"      ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users: admin read all"  ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "users: admin update"    ON public.users FOR UPDATE USING (public.is_admin());

-- STORES
CREATE POLICY "stores: public read approved"
  ON public.stores FOR SELECT USING (approved = TRUE AND active = TRUE);

CREATE POLICY "stores: owner read own"
  ON public.stores FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "stores: owner update"
  ON public.stores FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "stores: authenticated insert"
  ON public.stores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "stores: admin all"
  ON public.stores FOR ALL USING (public.is_admin());

-- PRODUCTS
CREATE POLICY "products: public read from approved stores"
  ON public.products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.approved = TRUE AND s.active = TRUE
    )
  );

CREATE POLICY "products: owner manage"
  ON public.products FOR ALL
  USING (public.owns_store(store_id));

CREATE POLICY "products: admin all"
  ON public.products FOR ALL USING (public.is_admin());

-- DRIVERS
CREATE POLICY "drivers: read own"
  ON public.drivers FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "drivers: update own"
  ON public.drivers FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "drivers: insert own"
  ON public.drivers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "drivers: admin all"
  ON public.drivers FOR ALL USING (public.is_admin());

-- ORDERS
CREATE POLICY "orders: customer read own"
  ON public.orders FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "orders: customer insert"
  ON public.orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "orders: store read own"
  ON public.orders FOR SELECT
  USING (public.owns_store(store_id));

CREATE POLICY "orders: store update status"
  ON public.orders FOR UPDATE
  USING (public.owns_store(store_id));

CREATE POLICY "orders: driver read ready"
  ON public.orders FOR SELECT
  USING (
    public.is_approved_driver()
    AND status IN ('ready', 'out_for_delivery')
  );

CREATE POLICY "orders: driver update assigned"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid() AND d.id = driver_id
    )
  );

CREATE POLICY "orders: admin all"
  ON public.orders FOR ALL USING (public.is_admin());

-- ORDER ITEMS
CREATE POLICY "order_items: visible with order access"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (
        o.user_id = auth.uid()
        OR public.owns_store(o.store_id)
        OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.id = o.driver_id)
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "order_items: customer insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

-- APP CONFIG
CREATE POLICY "config: public read"  ON public.app_config FOR SELECT USING (TRUE);
CREATE POLICY "config: admin write"  ON public.app_config FOR ALL USING (public.is_admin());

-- FREE DELIVERY
CREATE POLICY "free_delivery: read own"
  ON public.free_delivery_used FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "free_delivery: insert own"
  ON public.free_delivery_used FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- SEED DATA
-- =====================================================

-- UPDATED SEED DATA FOR SAMAD AL-SHAN (AL MAMURA)
-- =====================================================

INSERT INTO public.app_config (key, value, description) VALUES
  ('launch_date',       NOW()::TEXT,   'Platform launch date — used for free delivery window'),
  ('free_delivery_days','7',           'Days after launch that free delivery is offered'),
  ('max_order_amount',  '50',          'Maximum order total in OMR (orders above are auto-rejected)'),
  ('platform_name',     'جوب البلاد', 'Platform display name'),
  ('area_name',         'المعمورة',   'Name of the covered area'),
  ('area_lat',          '22.8250',    'Coverage area center latitude'),
  ('area_lng',          '58.1510',    'Coverage area center longitude'),
  ('area_radius_km',    '3.5',        'Coverage radius in kilometers')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
