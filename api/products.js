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
      menu_tags text[],
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
  `;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_tags text[]`;
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

const PUBLIC_SETTING_KEYS = new Set(['shabbos_enabled', 'purim_enabled', 'dairy_enabled', 'shavuos_enabled']);

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

const legacyMenu = require('../data/shabbos-menu.json');
const dairyMenu = require('../data/dairy-menu.json');
const shavuosMenu = require('../data/shavuos-menu.json');

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
            WHEN menu_tags IS NULL OR cardinality(menu_tags) = 0 THEN ARRAY['dairy']::text[]
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
      const updated = await sql`
        UPDATE products
        SET
          description = ${item.description || ''},
          price = ${Number(item.price) || 0},
          sold_by = ${item.soldBy || ''},
          qty_label = ${item.qtyLabel || 'Order Qty'},
          image_url = ${item.image || ''},
          menu_tags = CASE
            WHEN menu_tags IS NULL OR cardinality(menu_tags) = 0 THEN ARRAY['shavuos']::text[]
            WHEN NOT ('shavuos' = ANY(menu_tags)) THEN array_append(menu_tags, 'shavuos')
            ELSE menu_tags
          END,
          active = true
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
          ${sql`ARRAY['shavuos']::text[]`},
          true
        );
      `;
    }
  }
}

function formatPublicSettings(settings) {
  return {
    shabbos_enabled: settings.shabbos_enabled !== false,
    purim_enabled: settings.purim_enabled !== false,
    dairy_enabled: settings.dairy_enabled !== false,
    shavuos_enabled: settings.shavuos_enabled !== false
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
      let menu = '';
      if (url) {
        menu = (url.searchParams.get('menu') || '').trim().toLowerCase();
      }
      let rows = [];
      if (menu) {
        if (menu === 'shabbos') {
          const result = await sql`
            SELECT id, category, title, description, price, sold_by, qty_label, image_url, active, menu_tags
            FROM products
            WHERE active AND (menu_tags @> ARRAY['shabbos']::text[] OR menu_tags IS NULL)
            ORDER BY id;
          `;
          rows = result.rows;
        } else {
          const result = await sql`
            SELECT id, category, title, description, price, sold_by, qty_label, image_url, active, menu_tags
            FROM products
            WHERE active AND menu_tags @> ARRAY[${menu}]::text[]
            ORDER BY id;
          `;
          rows = result.rows;
        }
      } else {
        const result = await sql`
          SELECT id, category, title, description, price, sold_by, qty_label, image_url, active, menu_tags
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
          menuTags: row.menu_tags || [],
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
    const { category, title, description = '', price = 0, soldBy = '', qtyLabel = '', imageUrl = '', menuTags = null, active = true } = body;
    if (!category || !title) {
      res.status(400).send('Category and title are required');
      return;
    }
    const tags = Array.isArray(menuTags) && menuTags.length ? menuTags : ['shabbos'];
    try {
      const result = await sql`
        INSERT INTO products (category, title, description, price, sold_by, qty_label, image_url, menu_tags, active)
        VALUES (${category}, ${title}, ${description}, ${Number(price) || 0}, ${soldBy}, ${qtyLabel}, ${imageUrl}, ${tags}, ${Boolean(active)})
        RETURNING id, category, title, description, price, sold_by, qty_label, image_url, menu_tags, active;
      `;
      res.status(201).json({ product: result.rows[0] });
    } catch (error) {
      console.error('Product create error', error);
      res.status(500).send('Server Error');
    }
    return;
  }

  if (req.method === 'PUT') {
    const { id, category, title, description, price, soldBy, qtyLabel, imageUrl, menuTags, active } = body;
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
    if (menuTags !== undefined) updates.push(sql`UPDATE products SET menu_tags = ${Array.isArray(menuTags) ? menuTags : []} WHERE id = ${id}`);
    if (active !== undefined) updates.push(sql`UPDATE products SET active = ${Boolean(active)} WHERE id = ${id}`);

    if (!updates.length) {
      res.status(400).send('No product fields to update');
      return;
    }

    try {
      for (const query of updates) {
        await query;
      }
      const result = await sql`
        SELECT id, category, title, description, price, sold_by, qty_label, image_url, menu_tags, active
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
    const { id } = body;
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
