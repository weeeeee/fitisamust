const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

try {
    db.exec(`ALTER TABLE members ADD COLUMN is_moderator BOOLEAN DEFAULT 0`);
    console.log("Added is_moderator column to members table");
} catch (e) {
    console.log("is_moderator column might already exist:", e.message);
}

try {
    const info = db.prepare(`UPDATE members SET is_moderator = 1 WHERE email IN (?, ?)`).run('joe@fitisamust.com', 'swhitelex@gmail.com');
    console.log(`Updated ${info.changes} members to be moderators.`);
} catch (e) {
    console.log("Failed to update members:", e.message);
}
