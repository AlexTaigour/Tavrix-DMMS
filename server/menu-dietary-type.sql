ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS dietary_type text NOT NULL DEFAULT 'unspecified'
  CHECK (dietary_type IN ('veg', 'non_veg', 'unspecified'));
