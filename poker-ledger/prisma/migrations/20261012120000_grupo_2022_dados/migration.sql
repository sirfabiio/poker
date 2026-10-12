-- Migração de dados: junta todo o histórico existente no grupo "2022".
-- * Não altera nenhum valor existente: só cria o grupo, as pertenças e preenche "groupId" onde está vazio.
-- * Idempotente: id fixo do grupo, ids determinísticos das pertenças, ON CONFLICT e WHERE "groupId" IS NULL.
-- * Atómica: um único bloco; se algo falhar, nada fica aplicado (e o deploy falha sem ir para o ar).
-- * Reversível: prisma/rollback/01_desfazer_grupo_2022.sql.
-- Base de dados vazia (instalação nova, testes): não faz nada.
DO $$
DECLARE
  freitas_id TEXT;
  n INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Player") THEN
    RETURN;
  END IF;

  SELECT count(*) INTO n FROM "Player" WHERE "nameKey" = 'freitas';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Migração grupo 2022: esperava exatamente 1 jogador "Freitas" e encontrei %. Nada foi alterado.', n;
  END IF;
  SELECT "id" INTO freitas_id FROM "Player" WHERE "nameKey" = 'freitas';

  INSERT INTO "Group" ("id", "name", "createdAt", "createdByPlayerId")
  VALUES ('grupo_2022', '2022', CURRENT_TIMESTAMP, freitas_id)
  ON CONFLICT ("id") DO NOTHING;

  -- Todos os jogadores existentes ficam membros (a pertença segue o estado ativo/inativo do jogador).
  INSERT INTO "Membership" ("id", "groupId", "playerId", "role", "active", "createdAt")
  SELECT 'm2022_' || p."id", 'grupo_2022', p."id", 'MEMBER', p."active", CURRENT_TIMESTAMP
  FROM "Player" p
  ON CONFLICT ("groupId", "playerId") DO NOTHING;

  UPDATE "Membership" SET "role" = 'ADMIN'
  WHERE "groupId" = 'grupo_2022' AND "playerId" = freitas_id AND "role" <> 'ADMIN';

  UPDATE "Session"     SET "groupId" = 'grupo_2022' WHERE "groupId" IS NULL;
  UPDATE "Settlement"  SET "groupId" = 'grupo_2022' WHERE "groupId" IS NULL;
  -- Só o histórico anterior à migração: eventos pessoais novos (definir PIN, criar perfil) ficam sem grupo.
  UPDATE "ActivityLog" SET "groupId" = 'grupo_2022'
  WHERE "groupId" IS NULL AND "createdAt" <= (SELECT "createdAt" FROM "Group" WHERE "id" = 'grupo_2022');
END $$;
