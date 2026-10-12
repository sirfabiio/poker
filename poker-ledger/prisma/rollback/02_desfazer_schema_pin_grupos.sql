-- Remove as tabelas e colunas acrescentadas pelas migrações pin_auth e groups
-- (correr depois de 01_desfazer_grupo_2022.sql e de voltar a pôr no ar a versão anterior da app).
-- Apaga PINs, sessões de login, grupos e pertenças. Os dados de jogo (sessões, buy-ins, contas) não são tocados.
-- NÃO correr sem autorização explícita.
BEGIN;

ALTER TABLE "ActivityLog" DROP CONSTRAINT IF EXISTS "ActivityLog_groupId_fkey";
ALTER TABLE "Settlement"  DROP CONSTRAINT IF EXISTS "Settlement_groupId_fkey";
ALTER TABLE "Session"     DROP CONSTRAINT IF EXISTS "Session_groupId_fkey";
DROP INDEX IF EXISTS "ActivityLog_groupId_createdAt_idx";
DROP INDEX IF EXISTS "Session_groupId_idx";
DROP INDEX IF EXISTS "Settlement_groupId_idx";
ALTER TABLE "ActivityLog" DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "Settlement"  DROP COLUMN IF EXISTS "groupId";
ALTER TABLE "Session"     DROP COLUMN IF EXISTS "groupId";
DROP TABLE IF EXISTS "Membership";
DROP TABLE IF EXISTS "Group";
DROP TYPE IF EXISTS "GroupRole";

DROP TABLE IF EXISTS "AuthSession";
ALTER TABLE "Player" DROP COLUMN IF EXISTS "pinHash";
ALTER TABLE "Player" DROP COLUMN IF EXISTS "failedPinAttempts";
ALTER TABLE "Player" DROP COLUMN IF EXISTS "lockedUntil";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN ('20261011231633_pin_auth', '20261012000823_groups', '20261012120000_grupo_2022_dados');

COMMIT;
