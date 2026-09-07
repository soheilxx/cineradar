ALTER TABLE reports ADD COLUMN name text CHECK (name IS NULL OR length(name) BETWEEN 2 AND 120);
ALTER TABLE reports ADD COLUMN subject text CHECK (subject IS NULL OR length(subject) BETWEEN 3 AND 160);
