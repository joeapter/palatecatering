BEGIN;

-- Editable site copy and imagery, so headlines and photos can be changed from
-- the admin instead of by editing code and redeploying.
CREATE TABLE IF NOT EXISTS site_content (
  key         text PRIMARY KEY,
  page        text NOT NULL,
  label       text NOT NULL,          -- what this is, in plain language
  help        text DEFAULT '',        -- where it appears
  type        text NOT NULL DEFAULT 'text',  -- text | longtext | image
  value       text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_content_page_idx ON site_content (page, sort_order);

INSERT INTO site_content (key, page, label, help, type, value, sort_order) VALUES
  ('home.announcement','Home','Announcement bar','The thin green strip above the header, on every page.','text','Pickup in Beit Shemesh · Delivery across Jerusalem and surrounding areas',1),
  ('home.categories_heading','Home','Category section heading','Above the category tiles.','text','Shop the Shabbos menu',2),
  ('home.recommendations_heading','Home','Recommendations heading','Above the recommended items row.','text','This week we would order',3),
  ('shabbos.intro','Shabbos','Shabbos menu intro','Under the Shabbos heading.','longtext','Everything for the table, cooked this week and ready to collect or delivered before Shabbos.',1),
  ('packages.intro','Packages','Packages intro','Under the Packages heading.','longtext','Full Shabbos menus put together the way we would cook them at home — so you can order once instead of choosing thirty dishes.',1),
  ('catering.intro','Catering','Event catering intro','Under the Event catering heading.','longtext','Under our Elevate Events brand we handle the whole occasion — menus from the Palate kitchen, plus décor, florals, lighting, signage, rentals and a team on the day.',1),
  ('footer.tagline','Global','Footer tagline','The line under the logo in the footer.','text','Delicious Mehadrin food, prepared with care for Shabbos tables, Yom Tov, and simchas.',1),
  ('global.phone','Global','Phone number','Used in the header, footer and every call button.','text','058-728-0062',2)
ON CONFLICT (key) DO NOTHING;

-- Feature flags. Packages can be hidden entirely until the owner is ready to
-- sell them, without removing the code.
INSERT INTO site_settings (key, value, updated_at) VALUES
  ('packages_enabled', 'true', now()),
  ('holidays_enabled', 'true', now())
ON CONFLICT (key) DO NOTHING;

-- A fuller hero rotation. Images are chosen from photographs whose filenames
-- describe them, so each slide's picture actually matches its words; anything
-- generic is left for the owner to pick in the admin.
INSERT INTO hero_slides (eyebrow, headline, body, image_url, cta_label, cta_href, active, sort_order) VALUES
  ('Every week','Shabbos, handled.','The whole table cooked this week — salatim, fish, soup, mains and kugels. Order by Wednesday, collect or have it delivered before candle lighting.','/assets/Shabbos/Balsamic Glazed Brisket.jpg','Order for Shabbos','/shabbos',true,1),
  ('Rosh Hashanah','A new year, already cooked.','The holiday takeout menu is open — silan spiced assado, Korean BBQ short ribs, pomegranate salmon and the sides to go with them.','/assets/Shabbos/Sweet and Saucy Brisket.jpeg','See the Rosh Hashanah menu','/holidays/rosh-hashanah',true,2),
  ('Start the meal','Fourteen salatim, made fresh.','Chummus, techina, charred cabbage, roasted beets — the part of the table people actually reach for.','/assets/Shabbos/Chummus.jpg','Browse salatim','/shabbos/salatim',true,3),
  ('Simchas','Your simcha, and none of the work.','Bris, bar and bat mitzvah, sheva brachos — menus, décor, staffing and a team who clear up afterwards.','/assets/bris/pancake-station.jpg','Plan an event','/catering',true,4),
  ('Friday night','Soup that tastes like it should.','Slow-simmered chicken soup by the litre, and five more besides.','/assets/Shabbos/Chicken-Soup.jpg','See the soups','/shabbos/soups',true,5)
ON CONFLICT DO NOTHING;

COMMIT;
