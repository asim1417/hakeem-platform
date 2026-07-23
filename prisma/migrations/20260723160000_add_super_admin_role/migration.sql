-- Additive only: add SUPER_ADMIN to UserRole enum.
-- Safe: no column drops, no data deletion. Existing rows keep their roles.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
