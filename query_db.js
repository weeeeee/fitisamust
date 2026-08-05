const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
console.log("Member 3 Intake:", db.prepare("SELECT * FROM intake_profiles WHERE member_id = 3").all());
console.log("Member 3 Food Today:", db.prepare("SELECT * FROM food_logs WHERE member_id = 3 AND log_date = DATE('now', 'localtime')").all());
