-- Backfill order_items.digital_product_id using multiple matching strategies
-- 1) Match by design_id against digital_products metadata/generation inputs/generated content
-- 2) Fallback: if exactly one purchased digital_product references the order_id, link all items for that order
-- Uses (array_agg(dp.id))[1] instead of MIN(uuid) to avoid invalid casts

DO $$
DECLARE v_updated_design INT := 0;
DECLARE v_updated_fallback INT := 0;
BEGIN
  -- Strategy 1: direct match by design_id
  WITH candidates AS (
    SELECT 
      oi.id AS order_item_id,
      (array_agg(dp.id))[1] AS dp_id
    FROM order_items oi
    JOIN digital_products dp
      ON (
        (dp.metadata ->> 'custom_design_id') IS NOT NULL AND dp.metadata ->> 'custom_design_id' = oi.design_id::text
      )
      OR (
        (dp.generation_inputs ->> 'design_id') IS NOT NULL AND dp.generation_inputs ->> 'design_id' = oi.design_id::text
      )
      OR (
        (dp.generated_content ->> 'design_id') IS NOT NULL AND dp.generated_content ->> 'design_id' = oi.design_id::text
      )
    WHERE oi.digital_product_id IS NULL
    GROUP BY oi.id
  )
  UPDATE order_items oi
  SET digital_product_id = c.dp_id
  FROM candidates c
  WHERE oi.id = c.order_item_id;

  GET DIAGNOSTICS v_updated_design = ROW_COUNT;

  -- Strategy 2: fallback by unique digital product per order
  WITH one_dp_order AS (
    SELECT 
      o.id AS order_id,
      (array_agg(dp.id))[1] AS dp_id
    FROM orders o
    JOIN digital_products dp 
      ON dp.metadata ->> 'order_id' = o.id::text
    WHERE dp.status = 'purchased'
    GROUP BY o.id
    HAVING COUNT(*) = 1
  ),
  targets AS (
    SELECT oi.id AS order_item_id, odo.dp_id
    FROM order_items oi
    JOIN one_dp_order odo ON odo.order_id = oi.order_id
    WHERE oi.digital_product_id IS NULL
  )
  UPDATE order_items oi
  SET digital_product_id = t.dp_id
  FROM targets t
  WHERE oi.id = t.order_item_id;

  GET DIAGNOSTICS v_updated_fallback = ROW_COUNT;

  RAISE NOTICE 'Backfill digital_product_id: matched_by_design_id=%, updated_by_order_fallback=%, total_updated=%',
    v_updated_design, v_updated_fallback, (v_updated_design + v_updated_fallback);
END $$;

