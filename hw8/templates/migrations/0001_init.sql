CREATE TABLE questions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter TEXT NOT NULL,                -- 章節名稱
  number  INTEGER NOT NULL,             -- 題號
  type    TEXT NOT NULL CHECK (type IN ('choice', 'essay', 'truefalse')),
  content TEXT NOT NULL,                -- 題目 Markdown
  correct TEXT,                         -- 標準答案:選擇題為大寫字母(如 'B'、'ACD'),是非題為 'T' / 'F',問答題為 NULL
  answer  TEXT                          -- 詳解或參考答案 Markdown
);

CREATE INDEX idx_questions_chapter ON questions (chapter, number);
