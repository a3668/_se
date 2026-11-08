CREATE TABLE questions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter TEXT NOT NULL,                -- 章節名稱
  number  INTEGER NOT NULL,             -- 例題編號
  type    TEXT NOT NULL CHECK (type IN ('choice', 'essay', 'truefalse')),
  content TEXT NOT NULL,                -- 題目 Markdown
  answer  TEXT                          -- 答案/詳解 Markdown,之後再補
);

CREATE INDEX idx_questions_chapter ON questions (chapter, number);
