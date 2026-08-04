const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const db = new Database('database.sqlite');
const email = 'swhitelex@gmail.com';
const newPassword = 'Password123!';

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(newPassword, salt);

db.prepare('UPDATE members SET password = ?, requires_password_change = 1 WHERE email = ?').run(hash, email);

console.log('Password updated.');
const user = db.prepare('SELECT password FROM members WHERE email = ?').get(email);
console.log('New hash:', user.password);
console.log('Matches?', bcrypt.compareSync(newPassword, user.password));
