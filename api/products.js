const { sql } = require('@vercel/postgres');
async function ensureProductsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id serial PRIMARY KEY,
      category text NOT NULL,
      title text NOT NULL,
      description text,
      price numeric(10,2) NOT NULL DEFAULT 0,
      sold_by text,
      qty_label text,
      image_url text,
      variants jsonb DEFAULT '[]'::jsonb,
      menu_tags text[],
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
  `;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_tags text[]`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb`;
  // Set on any product whose price was generated rather than confirmed by staff
  // (new seasonal items, sizes derived by multiplying a base price). Admin
  // filters on this to review pricing before the item goes on sale.
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_price_review boolean DEFAULT false`;
}

async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key text PRIMARY KEY,
      value text,
      updated_at timestamptz DEFAULT now()
    );
  `;
}

const PUBLIC_SETTING_KEYS = new Set([
  'shabbos_enabled', 'purim_enabled', 'dairy_enabled', 'shavuos_enabled',
  'shabbos_disabled_until', 'dairy_disabled_until',
  'shavuos_open_time', 'shavuos_cutoff_time',
  'shabbos_close_days_before', 'shabbos_close_time',
  'rosh_hashanah_enabled', 'rosh_hashanah_open_time', 'rosh_hashanah_cutoff_time'
]);
const ROSH_HASHANAH_SEED_KEY = 'rosh_hashanah_seeded_at';
const DEFAULT_SHABBOS_CLOSE_DAYS_BEFORE = '3';
const DEFAULT_SHABBOS_CLOSE_TIME = '23:59';

function normalizeSettingValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

async function readSettings(keys) {
  if (!keys.length) return {};
  const result = await sql`
    SELECT key, value
    FROM site_settings
    WHERE key = ANY(${keys});
  `;
  const settings = {};
  result.rows.forEach((row) => {
    settings[row.key] = row.value === 'false' ? false : row.value === 'true' ? true : row.value;
  });
  return settings;
}

function getPauseTimestamp(settings, key) {
  const value = String(settings[key] || '').trim();
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isMenuEnabled(settings, enabledKey, pausedUntilKey, now) {
  const timestamp = getPauseTimestamp(settings, pausedUntilKey);
  if (timestamp !== null) {
    return timestamp <= now.getTime();
  }
  return settings[enabledKey] !== false;
}

const legacyMenu = require('../data/shabbos-menu.json');
const dairyMenu = require('../data/dairy-menu.json');
const shavuosMenu = require('../data/shavuos-menu.json');
const roshHashanahMenu = require('../data/rosh-hashanah-menu.json');
const legacyShavuosSauceVariantTitles = [
  'Penne Alla Vodka Sauce - 1 Litre',
  'Penne Alla Vodka Sauce - 500 ml',
  'Fettuccine Sauce - 1 Litre',
  'Fettuccine Sauce - 500 ml',
  'Mushroom Cream Sauce - 1 Litre',
  'Mushroom Cream Sauce - 500 ml'
];

function normalizeProductVariants(value) {
  let variants = value;
  if (typeof variants === 'string') {
    try {
      variants = JSON.parse(variants);
    } catch (_err) {
      variants = [];
    }
  }
  if (!Array.isArray(variants)) return [];
  return variants
    .map((variant) => ({
      label: String(variant?.label || variant?.soldBy || '').trim(),
      price: Number(variant?.price) || 0,
      soldBy: String(variant?.soldBy || variant?.label || '').trim()
    }))
    .filter((variant) => variant.label && variant.price > 0);
}

async function removeLegacyShavuosSauceVariantRows() {
  await sql`
    UPDATE products
    SET
      active = false,
      menu_tags = COALESCE(array_remove(menu_tags, 'shavuos'), ARRAY[]::text[])
    WHERE category = 'Sauces'
      AND title = ANY(${legacyShavuosSauceVariantTitles});
  `;
}

async function seedLegacyMenu() {
  const { rows } = await sql`SELECT COUNT(*)::int AS count FROM products;`;
  const count = rows?.[0]?.count || 0;
  if (count > 0) return;
  if (!Array.isArray(legacyMenu)) return;
  for (const category of legacyMenu) {
    const categoryName = category?.category || 'Uncategorized';
    const items = Array.isArray(category?.items) ? category.items : [];
    for (const item of items) {
      const title = item?.title || '';
      if (!title) continue;
      await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, menu_tags, active)
        VALUES (
          ${categoryName},
          ${title},
          ${item.description || ''},
          ${Number(item.price) || 0},
          ${item.soldBy || ''},
          ${item.qtyLabel || ''},
          ${item.image || ''},
          ${sql`ARRAY['shabbos']::text[]`},
          true
        );
      `;
    }
  }
}

async function seedDairyMenu() {
  if (!Array.isArray(dairyMenu)) return;
  for (const category of dairyMenu) {
    const categoryName = category?.category || 'Uncategorized';
    const items = Array.isArray(category?.items) ? category.items : [];
    for (const item of items) {
      const title = item?.title || '';
      if (!title) continue;
      const updated = await sql`
        UPDATE products
        SET
          description = CASE WHEN COALESCE(description, '') = '' THEN ${item.description || ''} ELSE description END,
          price = CASE WHEN COALESCE(price, 0) = 0 THEN ${Number(item.price) || 0} ELSE price END,
          sold_by = CASE WHEN COALESCE(sold_by, '') = '' THEN ${item.soldBy || ''} ELSE sold_by END,
          qty_label = CASE WHEN COALESCE(qty_label, '') = '' THEN ${item.qtyLabel || 'Order Qty'} ELSE qty_label END,
          menu_tags = CASE
            -- NULL/empty means "Shabbos" by the legacy convention (the Shabbos
            -- query matches shabbos-tagged OR NULL). Writing only 'dairy' here
            -- would silently drop the product off the Shabbos menu — that is
            -- exactly what took the live menu down on 2026-08-17.
            WHEN menu_tags IS NULL OR cardinality(menu_tags) = 0 THEN ARRAY['shabbos', 'dairy']::text[]
            WHEN NOT ('dairy' = ANY(menu_tags)) THEN array_append(menu_tags, 'dairy')
            ELSE menu_tags
          END
        WHERE category = ${categoryName}
          AND title = ${title};
      `;
      if ((updated.rowCount || 0) > 0) continue;
      await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, menu_tags, active)
        VALUES (
          ${categoryName},
          ${title},
          ${item.description || ''},
          ${Number(item.price) || 0},
          ${item.soldBy || ''},
          ${item.qtyLabel || 'Order Qty'},
          ${item.image || ''},
          ${sql`ARRAY['dairy']::text[]`},
          true
        );
      `;
    }
  }
}

async function seedShavuosMenu() {
  if (!Array.isArray(shavuosMenu)) return;
  for (const category of shavuosMenu) {
    const categoryName = category?.category || 'Uncategorized';
    const items = Array.isArray(category?.items) ? category.items : [];
    for (const item of items) {
      const title = item?.title || '';
      if (!title) continue;
      const variants = normalizeProductVariants(item?.variants);
      const updated = await sql`
        UPDATE products
        SET
          description = CASE WHEN COALESCE(description, '') = '' THEN ${item.description || ''} ELSE description END,
          price = CASE WHEN COALESCE(price, 0) = 0 THEN ${Number(item.price) || 0} ELSE price END,
          sold_by = CASE WHEN COALESCE(sold_by, '') = '' THEN ${item.soldBy || ''} ELSE sold_by END,
          qty_label = CASE WHEN COALESCE(qty_label, '') = '' THEN ${item.qtyLabel || 'Order Qty'} ELSE qty_label END,
          image_url = CASE WHEN COALESCE(image_url, '') = '' THEN ${item.image || ''} ELSE image_url END,
          variants = CASE
            WHEN variants IS NULL OR variants = '[]'::jsonb THEN ${JSON.stringify(variants)}::jsonb
            ELSE variants
          END,
          menu_tags = CASE
            -- See the note in seedDairyMenu: NULL means Shabbos, so it must be
            -- made explicit rather than overwritten.
            WHEN menu_tags IS NULL OR cardinality(menu_tags) = 0 THEN ARRAY['shabbos', 'shavuos']::text[]
            WHEN NOT ('shavuos' = ANY(menu_tags)) THEN array_append(menu_tags, 'shavuos')
            ELSE menu_tags
          END
        WHERE category = ${categoryName}
          AND title = ${title};
      `;
      if ((updated.rowCount || 0) > 0) continue;
      await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, variants, menu_tags, active)
        VALUES (
          ${categoryName},
          ${title},
          ${item.description || ''},
          ${Number(item.price) || 0},
          ${item.soldBy || ''},
          ${item.qtyLabel || 'Order Qty'},
          ${item.image || ''},
          ${JSON.stringify(variants)}::jsonb,
          ${sql`ARRAY['shavuos']::text[]`},
          true
        );
      `;
    }
  }
  await removeLegacyShavuosSauceVariantRows();
}

// RETIRED — do not call this, and do not reinstate it.
//
// The Rosh Hashanah menu is now owned by migrations/0013, which creates its own
// products (slug prefix `rh26-`) with proper half/full pan variants.
//
// This seeder tagged existing Shabbos products as Rosh Hashanah, and because a
// NULL menu_tags means "Shabbos" by the legacy convention, writing a tag onto
// those rows silently removed ~60 products from the Shabbos menu and 404'd every
// /shabbos/<category> page. Kept here only so that history is legible.
// eslint-disable-next-line no-unused-vars
async function seedRoshHashanahMenu() {
  if (!Array.isArray(roshHashanahMenu)) return;

  const marker = await sql`
    SELECT value FROM site_settings WHERE key = ${ROSH_HASHANAH_SEED_KEY};
  `;
  if (marker.rows.length > 0 && marker.rows[0].value) return;

  for (const category of roshHashanahMenu) {
    const categoryName = category?.category || 'Uncategorized';
    const items = Array.isArray(category?.items) ? category.items : [];
    for (const item of items) {
      const title = item?.title || '';
      if (!title) continue;
      const variants = normalizeProductVariants(item?.variants);
      const needsReview = item?.needsPriceReview === true;

      // Existing products keep their staff-set price, description and photo —
      // this only appends the tag so they appear on the Rosh Hashanah menu.
      const updated = await sql`
        UPDATE products
        SET
          description = CASE WHEN COALESCE(description, '') = '' THEN ${item.description || ''} ELSE description END,
          price = CASE WHEN COALESCE(price, 0) = 0 THEN ${Number(item.price) || 0} ELSE price END,
          sold_by = CASE WHEN COALESCE(sold_by, '') = '' THEN ${item.soldBy || ''} ELSE sold_by END,
          qty_label = CASE WHEN COALESCE(qty_label, '') = '' THEN ${item.qtyLabel || 'Order Qty'} ELSE qty_label END,
          image_url = CASE WHEN COALESCE(image_url, '') = '' THEN ${item.image || ''} ELSE image_url END,
          variants = CASE
            WHEN variants IS NULL OR variants = '[]'::jsonb THEN ${JSON.stringify(variants)}::jsonb
            ELSE variants
          END,
          menu_tags = CASE
            -- A NULL/empty menu_tags means Shabbos by the legacy convention:
            -- the Shabbos query matches products tagged shabbos OR tagged NULL.
            -- Writing only rosh-hashanah here would silently drop the product
            -- off the Shabbos menu, so Shabbos must be made explicit.
            WHEN menu_tags IS NULL OR cardinality(menu_tags) = 0 THEN ARRAY['shabbos', 'rosh-hashanah']::text[]
            WHEN NOT ('rosh-hashanah' = ANY(menu_tags)) THEN array_append(menu_tags, 'rosh-hashanah')
            ELSE menu_tags
          END
        WHERE category = ${categoryName}
          AND title = ${title};
      `;
      if ((updated.rowCount || 0) > 0) continue;

      await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, variants, menu_tags, needs_price_review, active)
        VALUES (
          ${categoryName},
          ${title},
          ${item.description || ''},
          ${Number(item.price) || 0},
          ${item.soldBy || ''},
          ${item.qtyLabel || 'Order Qty'},
          ${item.image || ''},
          ${JSON.stringify(variants)}::jsonb,
          ARRAY['rosh-hashanah']::text[],
          ${needsReview},
          ${!needsReview}
        );
      `;
    }
  }

  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${ROSH_HASHANAH_SEED_KEY}, ${new Date().toISOString()}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  `;
}

function formatPublicSettings(settings) {
  const now = new Date();
  const rawShabbosCloseDays = settings.shabbos_close_days_before;
  const rawShabbosCloseTime = settings.shabbos_close_time || '';
  const hasLegacyMidnightClose = String(rawShabbosCloseDays) === '2' && (!rawShabbosCloseTime || rawShabbosCloseTime === '00:00');
  const shabbosCloseDaysBefore = hasLegacyMidnightClose
    ? DEFAULT_SHABBOS_CLOSE_DAYS_BEFORE
    : (rawShabbosCloseDays ?? DEFAULT_SHABBOS_CLOSE_DAYS_BEFORE);
  const shabbosCloseTime = hasLegacyMidnightClose
    ? DEFAULT_SHABBOS_CLOSE_TIME
    : (rawShabbosCloseTime || DEFAULT_SHABBOS_CLOSE_TIME);

  return {
    shabbos_enabled: isMenuEnabled(settings, 'shabbos_enabled', 'shabbos_disabled_until', now),
    purim_enabled: settings.purim_enabled !== false,
    dairy_enabled: isMenuEnabled(settings, 'dairy_enabled', 'dairy_disabled_until', now),
    shavuos_enabled: settings.shavuos_enabled !== false,
    shabbos_disabled_until: settings.shabbos_disabled_until || '',
    dairy_disabled_until: settings.dairy_disabled_until || '',
    shavuos_open_time: settings.shavuos_open_time || '',
    shavuos_cutoff_time: settings.shavuos_cutoff_time || '',
    rosh_hashanah_enabled: settings.rosh_hashanah_enabled !== false,
    rosh_hashanah_open_time: settings.rosh_hashanah_open_time || '',
    rosh_hashanah_cutoff_time: settings.rosh_hashanah_cutoff_time || '',
    shabbos_close_days_before: shabbosCloseDaysBefore,
    shabbos_close_time: shabbosCloseTime
  };
}

function requireAdminKey(req) {
  const adminKey = req.headers['x-admin-key'] || req.body?.key || '';
  return Boolean(process.env.ADMIN_PASSWORD && adminKey === process.env.ADMIN_PASSWORD);
}

module.exports = async (req, res) => {
  try {
    await ensureProductsTable();
    await ensureSettingsTable();
  } catch (err) {
    console.error('Products table error', err);
    res.status(500).send('Server Error');
    return;
  }

  if (req.method === 'GET') {
    try {
      let url;
      try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      } catch (err) {
        url = null;
      }
      const settingsFlag = url ? (url.searchParams.get('settings') || '') : '';
      if (settingsFlag) {
        const isPublic = (url?.searchParams.get('public') || '').toLowerCase();
        const isPublicRequest = isPublic === '1' || isPublic === 'true';
        if (!isPublicRequest && !requireAdminKey(req)) {
          res.status(401).send('Unauthorized');
          return;
        }
        const settings = await readSettings(Array.from(PUBLIC_SETTING_KEYS));
        res.status(200).json({ settings: formatPublicSettings(settings) });
        return;
      }

      await seedLegacyMenu();
      await seedDairyMenu();
      await seedShavuosMenu();
      // Rosh Hashanah is no longer seeded from JSON — migrations/0013 owns that
      // menu. See the note on seedRoshHashanahMenu below.
      let menu = '';
      if (url) {
        menu = (url.searchParams.get('menu') || '').trim().toLowerCase();
      }
      let rows = [];
      if (menu) {
        if (menu === 'shabbos') {
          const result = await sql`
            SELECT id, category, title, description, price, sold_by, qty_label, image_url, variants, active, menu_tags, needs_price_review
            FROM products
            WHERE active AND (menu_tags @> ARRAY['shabbos']::text[] OR menu_tags IS NULL)
            ORDER BY id;
          `;
          rows = result.rows;
        } else {
          const result = await sql`
            SELECT id, category, title, description, price, sold_by, qty_label, image_url, variants, active, menu_tags, needs_price_review
            FROM products
            WHERE active AND menu_tags @> ARRAY[${menu}]::text[]
            ORDER BY id;
          `;
          rows = result.rows;
        }
      } else if (requireAdminKey(req)) {
        // Include inactive seasonal drafts in the authenticated admin catalog.
        const result = await sql`
          SELECT id, category, title, description, price, sold_by, qty_label, image_url, variants, active, menu_tags, needs_price_review
          FROM products
          ORDER BY id;
        `;
        rows = result.rows;
      } else {
        const result = await sql`
          SELECT id, category, title, description, price, sold_by, qty_label, image_url, variants, active, menu_tags, needs_price_review
          FROM products
          WHERE active
          ORDER BY id;
        `;
        rows = result.rows;
      }
      const categories = [];
      rows.forEach(row => {
        let bucket = categories.find(c => c.category === row.category);
        if (!bucket) {
          bucket = { category: row.category, items: [] };
          categories.push(bucket);
        }
        bucket.items.push({
          id: row.id,
          category: row.category,
          title: row.title,
          description: row.description,
          price: Number(row.price) || 0,
          soldBy: row.sold_by || '',
          qtyLabel: row.qty_label || '',
          image: row.image_url || '',
          variants: normalizeProductVariants(row.variants),
          menuTags: row.menu_tags || [],
          needsPriceReview: row.needs_price_review === true,
          active: row.active
        });
      });
      res.status(200).json({ categories });
    } catch (error) {
      console.error('Products fetch error', error);
      res.status(500).send('Server Error');
    }
    return;
  }

  if (!requireAdminKey(req)) {
    res.status(401).send('Unauthorized');
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (req.method === 'POST') {
    if (body.settings) {
      if (!requireAdminKey(req)) {
        res.status(401).send('Unauthorized');
        return;
      }
      const entries = Object.entries(body.settings || {}).filter(([key]) => PUBLIC_SETTING_KEYS.has(key));
      if (!entries.length) {
        res.status(400).send('No valid settings provided');
        return;
      }
      try {
        for (const [key, value] of entries) {
          const normalized = normalizeSettingValue(value);
          await sql`
            INSERT INTO site_settings (key, value, updated_at)
            VALUES (${key}, ${normalized}, now())
            ON CONFLICT (key)
            DO UPDATE SET value = ${normalized}, updated_at = now();
          `;
        }
        const settings = await readSettings(Array.from(PUBLIC_SETTING_KEYS));
        res.status(200).json({ settings: formatPublicSettings(settings) });
      } catch (error) {
        console.error('Settings update error', error);
        res.status(500).send('Server Error');
      }
      return;
    }
    const { category, title, description = '', price = 0, soldBy = '', qtyLabel = '', imageUrl = '', variants = null, menuTags = null, active = true } = body;
    if (!category || !title) {
      res.status(400).send('Category and title are required');
      return;
    }
    const tags = Array.isArray(menuTags) && menuTags.length ? menuTags : ['shabbos'];
    const productVariants = normalizeProductVariants(variants);
    try {
      const result = await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, variants, menu_tags, active)
        VALUES (${category}, ${title}, ${description}, ${Number(price) || 0}, ${soldBy}, ${qtyLabel}, ${imageUrl}, ${JSON.stringify(productVariants)}::jsonb, ${tags}, ${Boolean(active)})
        RETURNING id, category, title, description, price, sold_by, qty_label, image_url, variants, menu_tags, active;
      `;
      res.status(201).json({ product: result.rows[0] });
    } catch (error) {
      console.error('Product create error', error);
      res.status(500).send('Server Error');
    }
    return;
  }

  if (req.method === 'PUT') {
    const { id, category, title, description, price, soldBy, qtyLabel, imageUrl, variants, menuTags, active, needsPriceReview } = body;
    if (!id) {
      res.status(400).send('Product id required');
      return;
    }
    const updates = [];
    if (category !== undefined) updates.push(sql`UPDATE products SET category = ${category} WHERE id = ${id}`);
    if (title !== undefined) updates.push(sql`UPDATE products SET title = ${title} WHERE id = ${id}`);
    if (description !== undefined) updates.push(sql`UPDATE products SET description = ${description} WHERE id = ${id}`);
    if (price !== undefined) updates.push(sql`UPDATE products SET price = ${Number(price) || 0} WHERE id = ${id}`);
    if (soldBy !== undefined) updates.push(sql`UPDATE products SET sold_by = ${soldBy} WHERE id = ${id}`);
    if (qtyLabel !== undefined) updates.push(sql`UPDATE products SET qty_label = ${qtyLabel} WHERE id = ${id}`);
    if (imageUrl !== undefined) updates.push(sql`UPDATE products SET image_url = ${imageUrl} WHERE id = ${id}`);
    if (variants !== undefined) updates.push(sql`UPDATE products SET variants = ${JSON.stringify(normalizeProductVariants(variants))}::jsonb WHERE id = ${id}`);
    if (menuTags !== undefined) updates.push(sql`UPDATE products SET menu_tags = ${Array.isArray(menuTags) ? menuTags : []} WHERE id = ${id}`);
    if (active !== undefined) updates.push(sql`UPDATE products SET active = ${Boolean(active)} WHERE id = ${id}`);

    // Confirming a price is the review. An explicit flag still wins, so admin
    // can re-flag an item without changing what it costs.
    if (needsPriceReview !== undefined) {
      updates.push(sql`UPDATE products SET needs_price_review = ${Boolean(needsPriceReview)} WHERE id = ${id}`);
    } else if (price !== undefined) {
      updates.push(sql`UPDATE products SET needs_price_review = false WHERE id = ${id}`);
    }

    if (!updates.length) {
      res.status(400).send('No product fields to update');
      return;
    }

    try {
      for (const query of updates) {
        await query;
      }
      const result = await sql`
        SELECT id, category, title, description, price, sold_by, qty_label, image_url, variants, menu_tags, active, needs_price_review
        FROM products
        WHERE id = ${id};
      `;
      const product = result.rows[0];
      if (!product) {
        res.status(404).send('Product not found');
        return;
      }
      res.status(200).json({ product });
    } catch (error) {
      console.error('Product update error', error);
      res.status(500).send('Server Error');
    }
    return;
  }

  if (req.method === 'DELETE') {
    let deleteUrl;
    try {
      deleteUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch (_err) {
      deleteUrl = null;
    }
    const id = body.id || deleteUrl?.searchParams.get('id');
    if (!id) {
      res.status(400).send('Product id required');
      return;
    }
    try {
      const result = await sql`
        UPDATE products
        SET active = false
        WHERE id = ${id}
        RETURNING id;
      `;
      if (!result.rows.length) {
        res.status(404).send('Product not found');
        return;
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Product delete error', error);
      res.status(500).send('Server Error');
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  res.status(405).send('Method Not Allowed');
};
