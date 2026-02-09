-- ============================================
-- Add category-based images to all drills
-- 20 verified Unsplash images across 11 categories
-- Each category cycles through 2-3 images for variety
-- Column: name (not title), categories match production data
-- ============================================

-- Add image_url column if not exists
ALTER TABLE drills ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ball Mastery (Solo) - 30 drills, 3 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 3
    WHEN 0 THEN 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=500&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Ball Mastery (Solo)'
) n WHERE d.id = n.id;

-- Conditioning - 8 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1470224114660-3f6686c562eb?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Conditioning'
) n WHERE d.id = n.id;

-- Defending - 10 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Defending'
) n WHERE d.id = n.id;

-- Dribbling & 1v1 - 18 drills, 3 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 3
    WHEN 0 THEN 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=500&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1600679472829-3044539ce8ed?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Dribbling & 1v1'
) n WHERE d.id = n.id;

-- Finishing & Shooting - 14 drills, 3 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 3
    WHEN 0 THEN 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=500&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Finishing & Shooting'
) n WHERE d.id = n.id;

-- First Touch - 15 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'First Touch'
) n WHERE d.id = n.id;

-- Goalkeeper - 6 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Goalkeeper'
) n WHERE d.id = n.id;

-- Passing & Receiving - 18 drills, 3 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 3
    WHEN 0 THEN 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=500&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Passing & Receiving'
) n WHERE d.id = n.id;

-- Speed & Agility - 10 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1516475429286-465d815a0df7?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Speed & Agility'
) n WHERE d.id = n.id;

-- Tactical / Game Intelligence - 10 drills, 2 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 2
    WHEN 0 THEN 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Tactical / Game Intelligence'
) n WHERE d.id = n.id;

-- Warm-Up - 15 drills, 3 images
UPDATE drills d SET image_url = n.img
FROM (
  SELECT id, CASE (ROW_NUMBER() OVER (ORDER BY name))::int % 3
    WHEN 0 THEN 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=500&q=80'
    WHEN 1 THEN 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=500&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=500&q=80'
  END as img FROM drills WHERE category = 'Warm-Up'
) n WHERE d.id = n.id;
