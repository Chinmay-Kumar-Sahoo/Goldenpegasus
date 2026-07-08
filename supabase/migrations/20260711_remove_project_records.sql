-- Remove 'My Project Records' and all associated data
DELETE FROM dynamic_table_records
WHERE table_id IN (SELECT id FROM dynamic_tables WHERE table_name = 'My Project Records');

DELETE FROM dynamic_tables WHERE table_name = 'My Project Records';
