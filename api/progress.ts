import { createClient } from "@libsql/client";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  }
  const client = createClient({ url, authToken });

  try {
    const { user_id, question_id, action } = req.body || {};
    if (!user_id || !question_id || !action) {
      return res.status(400).json({ error: "user_id, question_id, action are required" });
    }

    // Ensure progress row exists
    await client.execute({
      sql: `INSERT INTO user_question_progress (user_id, question_id) VALUES (?, ?)
            ON CONFLICT(user_id, question_id) DO NOTHING`,
      args: [user_id, question_id],
    });

    // Ensure daily stats table exists
    await client.execute(`CREATE TABLE IF NOT EXISTS user_daily_stats (
      user_id TEXT NOT NULL,
      date NUMERIC NOT NULL,
      solved_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )`);

    // Fetch current state and question difficulty and previous solved_at
    const curRes = await client.execute({
      sql: `SELECT uqp.is_solved, uqp.is_starred, uqp.solved_at, q.difficulty
            FROM user_question_progress uqp
            JOIN questions q ON q.question_id = uqp.question_id
            WHERE uqp.user_id = ? AND uqp.question_id = ?`,
      args: [user_id, question_id],
    });
    const cur = (curRes.rows?.[0] || {}) as any;
    const wasSolved = Number(cur?.is_solved || 0) ? 1 : 0;
    const wasStarred = Number(cur?.is_starred || 0) ? 1 : 0;
    const prevSolvedAt = cur?.solved_at as string | null | undefined;
    const difficulty: string = (cur?.difficulty || "");

    let nowSolved = wasSolved;
    let nowStarred = wasStarred;

    if (action === "star") nowStarred = 1;
    else if (action === "unstar") nowStarred = 0;
    else if (action === "solve") nowSolved = 1;
    else if (action === "unsolve") nowSolved = 0;
    else return res.status(400).json({ error: "Invalid action" });

    await client.execute({
      sql: `UPDATE user_question_progress
            SET is_starred = ?, is_solved = ?, solved_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE user_id = ? AND question_id = ?`,
      args: [nowStarred, nowSolved, nowSolved, user_id, question_id],
    });

    // Update users counts only when solved state changes
    if (nowSolved !== wasSolved) {
      // Ensure a users row exists for this user (defaults, unverified allowed)
      await client.execute({
        sql: `INSERT OR IGNORE INTO users (
                user_id, app_username, leetcode_username, is_verified,
                easy_solved, medium_solved, hard_solved, total_solved,
                current_streak, longest_streak, last_solved_date
              ) VALUES (?, NULL, NULL, 0, 0, 0, 0, 0, 0, 0, NULL)`,
        args: [user_id],
      });

      const diffCol = difficulty?.toLowerCase() === "easy" ? "easy_solved"
        : difficulty?.toLowerCase() === "medium" ? "medium_solved"
        : difficulty?.toLowerCase() === "hard" ? "hard_solved" : null;

      if (nowSolved === 1) {
        // Always update total and streak on solve (independent of difficulty)
        const newCurrentExpr = `CASE
            WHEN last_solved_date IS NULL THEN 1
            WHEN DATE(last_solved_date) = DATE('now') THEN CASE WHEN current_streak > 0 THEN current_streak ELSE 1 END
            WHEN DATE(last_solved_date) = DATE('now','-1 day') THEN current_streak + 1
            ELSE 1
          END`;
        // Increment today's daily count
        await client.execute({
          sql: `INSERT INTO user_daily_stats (user_id, date, solved_count)
                VALUES (?, DATE('now'), 1)
                ON CONFLICT(user_id, date) DO UPDATE SET solved_count = solved_count + 1`,
          args: [user_id],
        });
        await client.execute({
          sql: `UPDATE users SET 
                  total_solved = total_solved + 1,
                  current_streak = ${newCurrentExpr},
                  longest_streak = CASE WHEN (${newCurrentExpr}) > longest_streak THEN (${newCurrentExpr}) ELSE longest_streak END,
                  last_solved_date = DATE('now')
                WHERE user_id = ?`,
          args: [user_id],
        });
        // Increment difficulty bucket if known
        if (diffCol) {
          await client.execute({
            sql: `UPDATE users SET ${diffCol} = ${diffCol} + 1 WHERE user_id = ?`,
            args: [user_id],
          });
        }
      } else {
        // On unsolve: decrement total and difficulty bucket if known; do not change streak/last_solved_date
        // Decrement the correct daily count using the previous solved_at date
        if (prevSolvedAt) {
          await client.execute({
            sql: `INSERT OR IGNORE INTO user_daily_stats (user_id, date, solved_count) VALUES (?, DATE(?), 0)`,
            args: [user_id, prevSolvedAt],
          });
          await client.execute({
            sql: `UPDATE user_daily_stats SET solved_count = CASE WHEN solved_count > 0 THEN solved_count - 1 ELSE 0 END
                  WHERE user_id = ? AND date = DATE(?)`,
            args: [user_id, prevSolvedAt],
          });
        }
        await client.execute({
          sql: `UPDATE users SET 
                  total_solved = CASE WHEN total_solved > 0 THEN total_solved - 1 ELSE 0 END
                WHERE user_id = ?`,
          args: [user_id],
        });
        if (diffCol) {
          await client.execute({
            sql: `UPDATE users SET ${diffCol} = CASE WHEN ${diffCol} > 0 THEN ${diffCol} - 1 ELSE 0 END
                  WHERE user_id = ?`,
            args: [user_id],
          });
        }
      }

      // Recompute accurate current_streak from daily stats and update last_solved_date as latest solved day
      const streakRes = await client.execute({
        sql: `WITH RECURSIVE streak(n, d) AS (
                SELECT 1, DATE('now')
                WHERE EXISTS(SELECT 1 FROM user_daily_stats WHERE user_id = ? AND date = DATE('now') AND solved_count > 0)
                UNION ALL
                SELECT n + 1, DATE(d, '-1 day')
                FROM streak
                WHERE EXISTS(SELECT 1 FROM user_daily_stats WHERE user_id = ? AND date = DATE(d, '-1 day') AND solved_count > 0)
              )
              SELECT COALESCE(MAX(n), 0) AS cnt`,
        args: [user_id, user_id],
      });
      const currentStreak = Number((streakRes.rows?.[0] as any)?.cnt || 0);
      const lastDateRes = await client.execute({
        sql: `SELECT MAX(date) AS last_date FROM user_daily_stats WHERE user_id = ? AND solved_count > 0`,
        args: [user_id],
      });
      const lastDate = (lastDateRes.rows?.[0] as any)?.last_date ?? null;
      await client.execute({
        sql: `UPDATE users SET 
                current_streak = ?,
                longest_streak = CASE WHEN ? > longest_streak THEN ? ELSE longest_streak END,
                last_solved_date = COALESCE(?, last_solved_date)
              WHERE user_id = ?`,
        args: [currentStreak, currentStreak, currentStreak, lastDate, user_id],
      });
    }

    return res.status(200).json({ ok: true, is_starred: nowStarred, is_solved: nowSolved });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}