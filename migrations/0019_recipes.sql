-- Recipes, so the kitchen can look up how a dish is made instead of asking.
--
-- Deliberately minimal to begin with. The owner's intent is to prepare the
-- system now and fill it in dish by dish, so the schema has to be comfortable
-- half-empty: every field but the link to a product is optional, and a recipe
-- with a name and nothing else is a valid row rather than an error.

BEGIN;

CREATE TABLE IF NOT EXISTS recipes (
  id serial PRIMARY KEY,
  -- One recipe per dish. The uniqueness is the rule "a product can be chosen
  -- only while it has no recipe yet" — enforced here rather than in a form,
  -- where two people adding at once would slip past it.
  product_id integer NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  -- What the quantities below produce: 1 means the ingredient amounts make one
  -- of whatever the product is sold as. Scaling multiplies from this.
  base_quantity numeric NOT NULL DEFAULT 1,
  -- Free text describing that unit — "1.5 Kg pan", "9x13 tray" — because the
  -- product's own sold-by label is not always what the kitchen cooks in.
  base_unit text,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id serial PRIMARY KEY,
  recipe_id integer NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Nullable on purpose: "salt, to taste" is a real ingredient line and must
  -- not be forced to invent a number that would then be multiplied.
  quantity numeric,
  unit text,
  note text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx
  ON recipe_ingredients (recipe_id, sort_order, id);

COMMIT;
