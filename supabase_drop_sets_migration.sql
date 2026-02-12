-- Add parent_set_number column to sets table for drop set tracking
-- Drops are stored as separate rows linked to their parent set via parent_set_number
-- NULL means it's a regular set; a value means it's a drop sub-row of that parent set number

ALTER TABLE sets ADD COLUMN parent_set_number INTEGER DEFAULT NULL;
