-- Full-text index for the shows archive. Apply once with Wrangler D1 migrations.
CREATE VIRTUAL TABLE IF NOT EXISTS shows_fts USING fts5(
  name, category, summary, descriptionFa, source, style, effects, layout,
  elements, materials, colors, lighting,
  content='shows', content_rowid='num',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER IF NOT EXISTS shows_fts_ai AFTER INSERT ON shows BEGIN
  INSERT INTO shows_fts(rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
  VALUES (new.num, new.name, new.category, new.summary, new.descriptionFa, new.source, new.style, new.effects, new.layout, new.elements, new.materials, new.colors, new.lighting);
END;

CREATE TRIGGER IF NOT EXISTS shows_fts_ad AFTER DELETE ON shows BEGIN
  INSERT INTO shows_fts(shows_fts, rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
  VALUES ('delete', old.num, old.name, old.category, old.summary, old.descriptionFa, old.source, old.style, old.effects, old.layout, old.elements, old.materials, old.colors, old.lighting);
END;

CREATE TRIGGER IF NOT EXISTS shows_fts_au AFTER UPDATE ON shows BEGIN
  INSERT INTO shows_fts(shows_fts, rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
  VALUES ('delete', old.num, old.name, old.category, old.summary, old.descriptionFa, old.source, old.style, old.effects, old.layout, old.elements, old.materials, old.colors, old.lighting);
  INSERT INTO shows_fts(rowid, name, category, summary, descriptionFa, source, style, effects, layout, elements, materials, colors, lighting)
  VALUES (new.num, new.name, new.category, new.summary, new.descriptionFa, new.source, new.style, new.effects, new.layout, new.elements, new.materials, new.colors, new.lighting);
END;

INSERT INTO shows_fts(shows_fts) VALUES ('rebuild');
