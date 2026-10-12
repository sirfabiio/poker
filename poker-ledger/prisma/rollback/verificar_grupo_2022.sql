-- Só leitura. Correr em "teste-migracao" depois da migração: confirma o grupo "2022".
SELECT 'grupo 2022 existe' AS verificacao, (count(*) = 1)::text AS resultado FROM "Group" WHERE "id" = 'grupo_2022' AND "name" = '2022'
UNION ALL SELECT 'todos os jogadores sao membros', ((SELECT count(*) FROM "Membership" WHERE "groupId" = 'grupo_2022') = (SELECT count(*) FROM "Player"))::text
UNION ALL SELECT 'admins do grupo', coalesce(string_agg(p."name", ', '), '(nenhum)') FROM "Membership" m JOIN "Player" p ON p."id" = m."playerId" WHERE m."groupId" = 'grupo_2022' AND m."role" = 'ADMIN'
UNION ALL SELECT 'sessoes sem grupo', count(*)::text FROM "Session" WHERE "groupId" IS NULL
UNION ALL SELECT 'fechos sem grupo', count(*)::text FROM "Settlement" WHERE "groupId" IS NULL
UNION ALL SELECT 'atividade sem grupo', count(*)::text FROM "ActivityLog" WHERE "groupId" IS NULL;
