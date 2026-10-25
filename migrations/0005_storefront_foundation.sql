BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  menu text NOT NULL DEFAULT 'shabbos',
  name text NOT NULL,
  slug text NOT NULL,
  description text DEFAULT '',
  hero_image_url text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu, slug)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id integer REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS serves text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_from timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_until timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_tags text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_price_review boolean NOT NULL DEFAULT false;

INSERT INTO categories (menu, name, slug, hero_image_url, sort_order)
SELECT
  'shabbos',
  category,
  trim(both '-' from regexp_replace(lower(category), '[^a-z0-9]+', '-', 'g')),
  COALESCE((array_agg(image_url ORDER BY id) FILTER (WHERE COALESCE(image_url, '') <> ''))[1], ''),
  dense_rank() OVER (ORDER BY min(id)) - 1
FROM products
GROUP BY category
ON CONFLICT (menu, slug) DO NOTHING;

UPDATE products p
SET category_id = c.id,
    slug = COALESCE(NULLIF(p.slug, ''), trim(both '-' from regexp_replace(lower(p.title), '[^a-z0-9]+', '-', 'g')))
FROM categories c
WHERE c.menu = 'shabbos' AND c.name = p.category;

CREATE INDEX IF NOT EXISTS products_category_sort_idx ON products (category_id, sort_order, id);
CREATE INDEX IF NOT EXISTS products_menu_tags_idx ON products USING gin (menu_tags);

CREATE TABLE IF NOT EXISTS product_variants (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label text NOT NULL,
  sold_by text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  sku text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, label)
);

INSERT INTO product_variants (product_id, label, sold_by, price, sort_order)
SELECT p.id, variant.value->>'label', COALESCE(variant.value->>'soldBy', variant.value->>'label', ''), (variant.value->>'price')::numeric, variant.ordinality - 1
FROM products p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) WITH ORDINALITY AS variant(value, ordinality)
WHERE COALESCE(variant.value->>'label', '') <> '' AND COALESCE(variant.value->>'price', '') ~ '^[0-9]+(\.[0-9]+)?$'
ON CONFLICT (product_id, label) DO NOTHING;

CREATE TABLE IF NOT EXISTS bundles (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  image_url text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  serves text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_items (
  id serial PRIMARY KEY,
  bundle_id integer NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  variant_id integer REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  swap_group text,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_windows (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  event_type text NOT NULL DEFAULT 'shabbos',
  event_date date NOT NULL,
  opens_at timestamptz,
  cutoff_at timestamptz NOT NULL,
  pickup_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_windows_active_date_idx ON order_windows (active, event_date);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  fee numeric(10,2) NOT NULL DEFAULT 0,
  minimum_order numeric(10,2) NOT NULL DEFAULT 0,
  free_delivery_threshold numeric(10,2),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO delivery_zones (name, slug, fee, minimum_order, free_delivery_threshold, sort_order) VALUES
  ('Beit Shemesh / RBS', 'beit-shemesh', 20, 0, 500, 0),
  ('Jerusalem', 'jerusalem', 100, 0, 1000, 1),
  ('Modiin', 'modiin', 100, 0, 1000, 2)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS hero_slides (
  id serial PRIMARY KEY,
  eyebrow text DEFAULT '',
  headline text NOT NULL,
  body text DEFAULT '',
  image_url text NOT NULL,
  cta_label text NOT NULL,
  cta_href text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_window_id integer REFERENCES order_windows(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
