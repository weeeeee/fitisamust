const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// Update starting weight
db.prepare("UPDATE intake_profiles SET weight = 218.8 WHERE member_id = 3").run();

// Delete 6 extra biscuits and gravy for member 3
db.prepare("DELETE FROM food_logs WHERE id IN (11, 12, 14, 18, 19)").run();

console.log("Database fixed!");
