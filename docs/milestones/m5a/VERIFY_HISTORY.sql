BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT k.term,k.country,k.language,s.store_app_id,s.captured_on,s.captured_at,
       s.rank,s.found,s.result_depth,s.collection_status,s.source
FROM public.aso_keyword_rank_snapshots s
JOIN public.aso_keywords k ON k.id=s.keyword_id
WHERE k.country='de' AND s.app_kind='owned' AND s.store_app_id='6785764991'
  AND s.captured_on BETWEEN '2026-10-09' AND '2026-10-15'
ORDER BY k.term,s.captured_on;
COMMIT;
