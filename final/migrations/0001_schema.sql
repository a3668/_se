-- 課程 → 章節 → 題目

CREATE TABLE courses (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE CHECK (slug <> '' AND slug NOT GLOB '*[^a-z0-9-]*'), -- 網址用,例如 os
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE chapters (
  id         INTEGER PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (course_id, title)
);

CREATE INDEX idx_chapters_course ON chapters (course_id, sort_order);

CREATE TABLE questions (
  id         INTEGER PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  number     INTEGER NOT NULL,          -- 原始題號;同一題號可能有多個小題
  type       TEXT NOT NULL CHECK (type IN ('choice', 'essay', 'truefalse')),
  content    TEXT NOT NULL,             -- 題目 Markdown;選擇題選項為 "(A) ..." 獨立行
  answer     TEXT,                      -- 詳解或參考答案 Markdown
  -- 標準答案:選擇題為選項代號(如 'ACD'、'245'),是非題為 'T' / 'F',問答題一律 NULL
  correct    TEXT CHECK (
    (type = 'essay' AND correct IS NULL)
    OR (type = 'truefalse' AND correct IN ('T', 'F'))
    OR (type = 'choice' AND correct <> '' AND correct NOT GLOB '*[^A-Z0-9]*')
  )
);

CREATE INDEX idx_questions_chapter ON questions (chapter_id, number, id);
CREATE INDEX idx_questions_type ON questions (type);

-- 全文搜尋:trigram 斷詞可以搜尋中文與英文的任意子字串(至少 3 個字元)
CREATE VIRTUAL TABLE questions_fts USING fts5 (
  content,
  answer,
  content = 'questions',
  content_rowid = 'id',
  tokenize = 'trigram'
);

CREATE TRIGGER questions_fts_insert AFTER INSERT ON questions BEGIN
  INSERT INTO questions_fts (rowid, content, answer) VALUES (new.id, new.content, new.answer);
END;

CREATE TRIGGER questions_fts_delete AFTER DELETE ON questions BEGIN
  INSERT INTO questions_fts (questions_fts, rowid, content, answer)
  VALUES ('delete', old.id, old.content, old.answer);
END;

CREATE TRIGGER questions_fts_update AFTER UPDATE ON questions BEGIN
  INSERT INTO questions_fts (questions_fts, rowid, content, answer)
  VALUES ('delete', old.id, old.content, old.answer);
  INSERT INTO questions_fts (rowid, content, answer) VALUES (new.id, new.content, new.answer);
END;
