-- Desfaz a migração de dados 20261012120000_grupo_2022_dados.
-- Pensado para logo a seguir à migração (antes de se usar o grupo): tudo o que estiver no grupo "2022"
-- volta a ficar sem grupo, e o grupo e as suas pertenças são removidos. Nenhum valor de jogo é tocado.
-- NÃO correr sem autorização explícita. Correr no SQL Editor do Neon, no branch certo.
BEGIN;

UPDATE "Session"     SET "groupId" = NULL WHERE "groupId" = 'grupo_2022';
UPDATE "Settlement"  SET "groupId" = NULL WHERE "groupId" = 'grupo_2022';
UPDATE "ActivityLog" SET "groupId" = NULL WHERE "groupId" = 'grupo_2022';
DELETE FROM "Membership" WHERE "groupId" = 'grupo_2022';
DELETE FROM "Group" WHERE "id" = 'grupo_2022';
-- Permite voltar a aplicar a migração num deploy futuro.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261012120000_grupo_2022_dados';

COMMIT;
