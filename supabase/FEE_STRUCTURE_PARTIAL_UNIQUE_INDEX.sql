-- Migration: make fee structure uniqueness apply only to active (non-archived) rows
-- This allows a new fee structure to be created for the same class/year/term
-- after the old row has been archived.

ALTER TABLE public.fee_structures
DROP CONSTRAINT IF EXISTS fee_structures_class_id_academic_year_term_key;

CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_unique_active_idx
ON public.fee_structures (class_id, academic_year, term)
WHERE archived = false;
