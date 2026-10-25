BEGIN;

-- Phase 2 needs orderable windows before the Phase 4 window manager exists.
-- These rolling seed rows can be replaced or edited directly in Postgres.
INSERT INTO order_windows (name, slug, event_type, event_date, opens_at, cutoff_at, pickup_slots, delivery_slots)
SELECT
  'Shabbos · ' || to_char(friday::date, 'Mon FMDD'),
  'shabbos-' || to_char(friday::date, 'YYYY-MM-DD'),
  'shabbos',
  friday::date,
  now(),
  ((friday::date - 2) + time '22:00') AT TIME ZONE 'Asia/Jerusalem',
  '["Friday 09:00–11:00", "Friday 11:00–13:00"]'::jsonb,
  '["Friday morning", "Friday afternoon"]'::jsonb
FROM generate_series(
  current_date + ((5 - extract(dow FROM current_date)::integer + 7) % 7),
  current_date + ((5 - extract(dow FROM current_date)::integer + 7) % 7) + 21,
  interval '7 days'
) AS friday
WHERE ((friday::date - 2) + time '22:00') AT TIME ZONE 'Asia/Jerusalem' > now()
ON CONFLICT (slug) DO NOTHING;

INSERT INTO hero_slides (eyebrow, headline, body, image_url, cta_label, cta_href, sort_order)
SELECT 'This week at Palate', 'Good food. Friday handled.', 'Choose the dishes your table loves. We prepare them with care in Beit Shemesh, ready for pickup or delivery.', '/assets/gallery/gallery1.jpg', 'Explore this week''s menu', '/shabbos', 0
WHERE NOT EXISTS (SELECT 1 FROM hero_slides);

INSERT INTO hero_slides (eyebrow, headline, body, image_url, cta_label, cta_href, sort_order)
SELECT 'Event catering', 'Food that lets the occasion lead.', 'Thoughtful menus for simchas, corporate gatherings and celebrations of every size.', '/assets/gallery/image 14.jpeg', 'Explore event catering', '/catering', 1
WHERE (SELECT count(*) FROM hero_slides) = 1;

COMMIT;
