-- عدّاد رسائل المساعد لكل مستخدم باليوم.
CREATE TABLE IF NOT EXISTS agent_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
