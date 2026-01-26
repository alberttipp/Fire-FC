-- ============================================================
-- FIX CHAT MESSAGES TABLE
-- Run this to allow demo users to send messages
-- ============================================================

-- Drop the foreign key constraint on sender_id
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- Make sure sender_id allows NULL
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
