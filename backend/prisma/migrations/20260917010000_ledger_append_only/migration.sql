CREATE OR REPLACE FUNCTION prevent_ledger_entry_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_entry_update
BEFORE UPDATE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();

CREATE TRIGGER prevent_ledger_entry_delete
BEFORE DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation();
