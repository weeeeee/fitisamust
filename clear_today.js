const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
db.prepare("DELETE FROM food_logs WHERE member_id = 3 AND log_date = DATE('now', 'localtime')").run();
console.log("Cleared today's food logs for member 3");
