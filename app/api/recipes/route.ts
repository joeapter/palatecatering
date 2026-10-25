import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { isAdminRequest } from "@/lib/admin-auth";
import { isKitchenRequest } from "@/lib/kitchen-session";

/**
 * Recipes, shared by the admin and the kitchen.
 *
 * Both can read and write. That is deliberate: the person who knows how a dish
 * is actually made is usually the one cooking it, and a recipe book only the
 * office can edit goes stale. Nothing here exposes pricing or customer data, so
 * kitchen access costs nothing.
 */
export const dynamic = "force-dynamic";

function allowed(request: Request) {
  return isAdminRequest(request) || isKitchenRequest(request);
}

function clean(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

/** Empty string and a missing value both mean "no number", not zero. */
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [recipes, ingredients, products] = await Promise.all([
      sql`
        SELECT r.id, r.product_id, r.base_quantity, r.base_unit, r.method, r.notes, r.updated_at,
               p.title, p.image_url, p.sold_by, c.name AS category
        FROM recipes r
        JOIN products p ON p.id = r.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.title;
      `,
      sql`SELECT id, recipe_id, name, quantity, unit, note, sort_order FROM recipe_ingredients ORDER BY recipe_id, sort_order, id;`,
      // Only dishes without a recipe can be added, so the picker offers exactly
      // those rather than letting someone choose and then be refused.
      sql`
        SELECT p.id, p.title, p.sold_by, c.name AS category
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.active = true
          AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.product_id = p.id)
        ORDER BY p.title
        LIMIT 500;
      `,
    ]);

    const byRecipe = new Map<number, unknown[]>();
    for (const row of ingredients.rows) {
      const list = byRecipe.get(row.recipe_id) || [];
      list.push(row);
      byRecipe.set(row.recipe_id, list);
    }

    return NextResponse.json({
      recipes: recipes.rows.map((r) => ({ ...r, ingredients: byRecipe.get(r.id) || [] })),
      availableProducts: products.rows,
    });
  } catch (error) {
    console.error("Recipe load failed", error);
    return NextResponse.json({ error: "Could not load recipes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!allowed(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const who = isAdminRequest(request) ? "admin" : "kitchen";

    if (body.action === "create") {
      const productId = Number(body.productId);
      if (!productId) return NextResponse.json({ error: "Choose a dish." }, { status: 400 });
      try {
        const { rows } = await sql`
          INSERT INTO recipes (product_id, base_quantity, base_unit, updated_by)
          VALUES (${productId}, ${numberOrNull(body.baseQuantity) ?? 1}, ${clean(body.baseUnit, 80) || null}, ${who})
          RETURNING id;
        `;
        return NextResponse.json({ ok: true, id: rows[0].id });
      } catch {
        // The unique constraint is the real guard against two people adding the
        // same dish at once; the picker only hides it.
        return NextResponse.json({ error: "That dish already has a recipe." }, { status: 409 });
      }
    }

    if (body.action === "update") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Unknown recipe." }, { status: 400 });
      await sql`
        UPDATE recipes SET
          base_quantity = COALESCE(${numberOrNull(body.baseQuantity)}, base_quantity),
          base_unit = ${clean(body.baseUnit, 80) || null},
          method = ${clean(body.method, 8000) || null},
          notes = ${clean(body.notes, 2000) || null},
          updated_at = now(),
          updated_by = ${who}
        WHERE id = ${id};
      `;
      return NextResponse.json({ ok: true });
    }

    /** Ingredients are replaced wholesale — simpler and atomic than diffing rows. */
    if (body.action === "saveIngredients") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Unknown recipe." }, { status: 400 });
      const list = Array.isArray(body.ingredients) ? body.ingredients.slice(0, 100) : [];

      await sql`DELETE FROM recipe_ingredients WHERE recipe_id = ${id};`;
      let order = 0;
      for (const raw of list) {
        const name = clean(raw?.name, 160);
        if (!name) continue;
        await sql`
          INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, note, sort_order)
          VALUES (${id}, ${name}, ${numberOrNull(raw?.quantity)}, ${clean(raw?.unit, 40) || null}, ${clean(raw?.note, 200) || null}, ${order});
        `;
        order += 1;
      }
      await sql`UPDATE recipes SET updated_at = now(), updated_by = ${who} WHERE id = ${id};`;
      return NextResponse.json({ ok: true, saved: order });
    }

    if (body.action === "delete") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "Unknown recipe." }, { status: 400 });
      await sql`DELETE FROM recipes WHERE id = ${id};`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Recipe save failed", error);
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
}
