-- Contagens e totais dos dados de jogo (valores em cêntimos). Só leitura.
-- Correr no SQL Editor do Neon em "backup-pre-grupos" e em "teste-migracao": os resultados têm de ser iguais.
SELECT 'jogadores' AS metrica, count(*)::text AS valor FROM "Player"
UNION ALL SELECT 'jogadores ativos', count(*)::text FROM "Player" WHERE "active"
UNION ALL SELECT 'sessoes', count(*)::text FROM "Session"
UNION ALL SELECT 'sessoes fechadas (com fecho)', count(*)::text FROM "Session" WHERE "settlementId" IS NOT NULL
UNION ALL SELECT 'jogadores em sessoes', count(*)::text FROM "SessionPlayer"
UNION ALL SELECT 'buy-ins (n.º)', count(*)::text FROM "BuyIn"
UNION ALL SELECT 'buy-ins (soma)', coalesce(sum("amount"), 0)::text FROM "BuyIn"
UNION ALL SELECT 'cash-outs (soma)', coalesce(sum("cashOut"), 0)::text FROM "SessionPlayer"
UNION ALL SELECT 'ajustes (soma)', coalesce(sum("adjustment"), 0)::text FROM "SessionPlayer"
UNION ALL SELECT 'fechos de contas', count(*)::text FROM "Settlement"
UNION ALL SELECT 'transferencias (n.º)', count(*)::text FROM "Transfer"
UNION ALL SELECT 'transferencias (soma)', coalesce(sum("amount"), 0)::text FROM "Transfer"
UNION ALL SELECT 'transferencias pagas', count(*)::text FROM "Transfer" WHERE "paid"
UNION ALL SELECT 'registos de atividade', count(*)::text FROM "ActivityLog"
UNION ALL SELECT 'resultado por jogador (impressao digital)', md5(coalesce(string_agg(x, ',' ORDER BY x), ''))
FROM (
  SELECT sp."playerId" || ':' || (coalesce(sp."cashOut", 0) + sp."adjustment" - coalesce(sum(b."amount"), 0)) AS x
  FROM "SessionPlayer" sp LEFT JOIN "BuyIn" b ON b."sessionPlayerId" = sp."id"
  GROUP BY sp."id"
) t;
