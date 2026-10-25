-- Editable customer message templates.
--
-- The wording of every WhatsApp and SMS the business sends lived in code, so
-- changing a sentence meant a deploy. These are the owner's words about their
-- own food; they should be editable in the admin like anything else.
--
-- Rows are seeded only where missing, and the code keeps its own defaults, so
-- an empty table, an unreachable database, or a key that has not been seeded
-- all fall back to the shipped wording rather than sending an empty message.

BEGIN;

CREATE TABLE IF NOT EXISTS message_templates (
  key text PRIMARY KEY,
  -- Shown on the button that sends it, so the admin controls that wording too.
  label text NOT NULL,
  body text NOT NULL,
  -- Lets a seasonal message be switched off without deleting what was written.
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO message_templates (key, label, body) VALUES
  ('confirmed', 'Confirm order',
   E'Hi {name}, it''s Palate.\n\nWe''ve got your order #{order}{window}{total}.\nWe''ll message you again when it''s ready.\n\nAny questions, just reply here or call {phone}.'),
  ('ready', 'Ready for pickup',
   E'Hi {name}, your Palate order #{order} is ready for pickup.\n\nSee you soon — and if you''re running late, just let us know here.'),
  ('out_for_delivery', 'Out for delivery',
   E'Hi {name}, your Palate order #{order} is on its way.\n\nPlease make sure someone can take it in. If you need to redirect the driver, reply here.'),
  ('cutoff_reminder', 'Cutoff reminder',
   E'Hi {name}, it''s Palate.\n\nOrdering{window} closes soon. If you''d like anything this week, now''s the time.\n\nOrder here: https://www.palatecateringisrael.com/shabbos'),
  ('holiday_menu', 'RH menu',
   E'Hi {name}, it''s Palate.\n\nOur Rosh Hashanah menu is now up. Have a look while there is still room in the kitchen — we cook to order and the run fills up before Yom Tov.\n\nhttps://www.palatecateringisrael.com/holidays/rosh-hashanah\n\nAny questions, just reply here or call {phone}.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
