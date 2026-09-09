import { readFile } from "node:fs/promises";
import { pool, rows, transaction } from "./db.js";
import { challenges } from "./catalog.js";
import { badgeRules } from "./progression.js";

export async function migrate() {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  // Upgrade the original eight-table MySQL schema in place; no table is dropped.
  const additions = {
    users: {
      eco_points: "INT NOT NULL DEFAULT 0",
      trust_score: "INT NOT NULL DEFAULT 50",
      public_forest: "BOOLEAN NOT NULL DEFAULT FALSE",
    },
    challenges: {
      benefit: "TEXT",
      instructions: "TEXT",
      proof_requirements: "TEXT",
      estimated_time: "VARCHAR(80)",
      proof_required: "BOOLEAN NOT NULL DEFAULT TRUE",
      impact_type: "VARCHAR(40)",
      impact_value: "DECIMAL(10,3)",
      impact_unit: "VARCHAR(30)",
      impact_note: "VARCHAR(500)",
    },
    challenge_completions: {
      proof_url: "VARCHAR(255)",
      description: "TEXT",
      location: "VARCHAR(200)",
      submitted_at: "TIMESTAMP NULL",
      reviewed_at: "TIMESTAMP NULL",
      reviewed_by: "INT UNSIGNED",
      rejection_reason: "VARCHAR(500)",
      created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      points_snapshot: "INT UNSIGNED NOT NULL DEFAULT 0",
      proof_required: "BOOLEAN NOT NULL DEFAULT TRUE",
      proof_hash: "CHAR(64)",
      review_flags: "VARCHAR(500)",
      impact_type: "VARCHAR(40)",
      impact_value: "DECIMAL(10,3)",
      impact_unit: "VARCHAR(30)",
      impact_note: "VARCHAR(500)",
    },
    badges: {
      requirement_type: "VARCHAR(30)",
      requirement_value: "INT",
      icon: "VARCHAR(30) DEFAULT 'leaf'",
      kind: "VARCHAR(20) NOT NULL DEFAULT 'verified'",
    },
    user_badges: { legacy: "BOOLEAN NOT NULL DEFAULT FALSE" },
  };
  for (const [table, columns] of Object.entries(additions)) {
    const existing = new Set(
      (
        await rows(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
          [table],
        )
      ).map((c) => c.COLUMN_NAME),
    );
    for (const [name, type] of Object.entries(columns))
      if (!existing.has(name))
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
  await pool.query(
    "ALTER TABLE challenges MODIFY category VARCHAR(20) NOT NULL",
  );
  await pool.query(
    "ALTER TABLE challenge_completions MODIFY status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'",
  );
  const constraints = new Set(
    (
      await rows(
        "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()",
      )
    ).map((r) => r.CONSTRAINT_NAME),
  );
  if (!constraints.has("valid_trust"))
    await pool.query(
      "ALTER TABLE users ADD CONSTRAINT valid_trust CHECK (trust_score BETWEEN 0 AND 100)",
    );
  if (!constraints.has("valid_verification_status"))
    await pool.query(
      "ALTER TABLE challenge_completions ADD CONSTRAINT valid_verification_status CHECK (status IN ('completed','LEGACY','IN_PROGRESS','PENDING','APPROVED','REJECTED'))",
    );
  const indexes = new Set(
    (
      await rows(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='challenge_completions'",
      )
    ).map((r) => r.INDEX_NAME),
  );
  if (!indexes.has("review_queue"))
    await pool.query(
      "ALTER TABLE challenge_completions ADD INDEX review_queue(status,submitted_at)",
    );
  if (!indexes.has("proof_lookup"))
    await pool.query(
      "ALTER TABLE challenge_completions ADD INDEX proof_lookup(proof_hash)",
    );
  const [reviewerFK] = await rows(
    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='challenge_completions' AND COLUMN_NAME='reviewed_by' AND REFERENCED_TABLE_NAME='users'",
  );
  if (!reviewerFK)
    await pool.query(
      "ALTER TABLE challenge_completions ADD CONSTRAINT reviewer_user FOREIGN KEY(reviewed_by) REFERENCES users(id)",
    );
  if (
    !(
      await rows(
        "SELECT version FROM schema_migrations WHERE version='verified-v1'",
      )
    ).length
  ) {
    await transaction(async (db) => {
      await rows(
        "UPDATE challenge_completions SET status='LEGACY' WHERE status NOT IN ('IN_PROGRESS','PENDING','APPROVED','REJECTED')",
        [],
        db,
      );
      await rows("UPDATE user_badges SET legacy=TRUE", [], db);
      await rows(
        "UPDATE users SET eco_points=0,eco_score=0,trust_score=50",
        [],
        db,
      );
      await rows(
        "UPDATE forest_progress SET forest_level=1,growth_points=0,trees_unlocked=0,wildlife_unlocked=0",
        [],
        db,
      );
      await rows(
        "INSERT INTO schema_migrations(version) VALUES ('verified-v1')",
        [],
        db,
      );
    });
  }
  for (const c of challenges) {
    await rows(
      "INSERT IGNORE INTO challenges(id,slug,title,description,category,difficulty,points) VALUES (?,?,?,?,?,?,?)",
      [
        c.id,
        c.slug,
        c.title,
        c.description,
        c.category,
        c.difficulty,
        c.points,
      ],
    );
    await rows(
      "UPDATE challenges SET benefit=?,instructions=?,proof_requirements=?,estimated_time=?,category=? WHERE slug=? AND benefit IS NULL",
      [
        c.benefit,
        c.instructions,
        c.proof_requirements,
        c.estimated_time,
        c.category,
        c.slug,
      ],
    );
  }
  if (
    !(
      await rows(
        "SELECT version FROM schema_migrations WHERE version='refill-estimate-v1'",
      )
    ).length
  )
    await transaction(async (db) => {
      await rows(
        "UPDATE challenges SET impact_type='avoided_single_use_bottles',impact_value=1,impact_unit='bottles',impact_note='Illustrative estimate: assumes one refill replaced one single-use bottle purchase. Actual avoided purchases are not independently measured; no carbon savings are inferred.' WHERE slug='refill' AND impact_type IS NULL",
        [],
        db,
      );
      await rows(
        "INSERT INTO schema_migrations(version) VALUES ('refill-estimate-v1')",
        [],
        db,
      );
    });
  const requirements = {
    "first-seed": ["actions", 1],
    "growing-strong": ["points", 500],
    "forest-keeper": ["points", 1000],
    "ecosystem-builder": ["actions", 20],
    "planet-friend": ["points", 2000],
    "trust-keeper": ["trust_with_20_actions", 90],
  };
  for (const [id, name, description] of badgeRules)
    await rows(
      "INSERT INTO badges(id,name,description,kind,requirement_type,requirement_value) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE description=VALUES(description),requirement_type=VALUES(requirement_type),requirement_value=VALUES(requirement_value)",
      [id, name, description, "verified", ...requirements[id]],
    );
  await rows(
    "INSERT IGNORE INTO badges(id,name,description,kind,requirement_type,requirement_value) VALUES ('curious-mind','Curious Mind','Pass all seven learning quizzes. No environmental points awarded.','learning','quizzes',7)",
  );
  await rows(
    "INSERT IGNORE INTO badges(id,name,description,kind,requirement_type,requirement_value) VALUES ('campaign-pioneer','Campaign Pioneer','Complete an approved action during a community campaign.','verified','campaign_actions',1)",
  );
  const [campaignCount] = await rows("SELECT COUNT(*) n FROM campaigns");
  if (!campaignCount.n) {
    const start = new Date(),
      end = new Date(Date.now() + 30 * 86400000);
    const result = await rows(
      "INSERT INTO campaigns(title,description,starts_at,ends_at,badge_id) VALUES (?,?,?,?,?)",
      [
        "Plastic-Free Month",
        "Document practical swaps that reduce disposable plastic during this month.",
        start,
        end,
        "campaign-pioneer",
      ],
    );
    await rows(
      "INSERT INTO campaign_challenges(campaign_id,challenge_id) SELECT ?,id FROM challenges WHERE slug IN ('plastic','refill')",
      [result.insertId],
    );
  }
}
export async function importLegacy() {
  let legacy;
  try {
    legacy = JSON.parse(
      await readFile(process.env.DATA_FILE || "data/ecoverse.json", "utf8"),
    );
  } catch (e) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  if (legacy.version !== 1 || !Array.isArray(legacy.users))
    throw new Error("Invalid legacy file; nothing imported.");
  let count = 0;
  for (const user of legacy.users) {
    const result = await rows(
      "INSERT IGNORE INTO users(name,email,password_hash,role,avatar) VALUES (?,?,?,?,?)",
      [
        user.name,
        user.email,
        user.password_hash,
        user.role === "admin" ? "admin" : "user",
        user.avatar || null,
      ],
    );
    if (result.affectedRows) {
      count++;
      const id = result.insertId;
      await rows("INSERT INTO user_extras(user_id,payload) VALUES (?,?)", [
        id,
        JSON.stringify({
          goals: (legacy.goals || [])
            .filter((g) => g.user_id === user.id)
            .map((g) => ({ ...g, user_id: id })),
          legacyActions: (legacy.completions || []).filter(
            (c) => c.user_id === user.id,
          ).length,
        }),
      ]);
    }
  }
  console.log(
    `Imported ${count} accounts. Original JSON and self-reported history remain untouched; old rewards are not verified.`,
  );
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/migrate.js")) {
  try {
    await migrate();
    if (process.argv.includes("--import-legacy")) await importLegacy();
    console.log("MySQL schema ready.");
  } finally {
    await pool.end();
  }
}
