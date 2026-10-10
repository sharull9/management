ALTER TABLE items ALTER COLUMN "stockTracked" SET DEFAULT false;
UPDATE items SET "stockTracked" = false WHERE type = 'SERVICE';
UPDATE item_variants v SET name = concat_ws(' ? ',
  (SELECT name FROM items WHERE id = v."itemId"),
  (SELECT name FROM item_level_values WHERE id = v."level1Id"),
  (SELECT name FROM item_level_values WHERE id = v."level2Id"),
  (SELECT name FROM item_level_values WHERE id = v."level3Id"),
  (SELECT name FROM item_level_values WHERE id = v."level4Id"),
  (SELECT name FROM item_level_values WHERE id = v."level5Id"))
WHERE v.name = '';
