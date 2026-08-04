const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const serverless = require('serverless-http');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Rewrite for Netlify Functions
app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
        req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    next();
});

// Initialize Nodemailer with Environment Variables or Ethereal
let transporter;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    console.log('Real SMTP Email configured.');
} else {
    nodemailer.createTestAccount((err, account) => {
        if (err) {
            console.error('Failed to create a testing account. ' + err.message);
            return;
        }
        console.log('Ethereal Email account generated successfully.');
        transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: account.user,
                pass: account.pass
            }
        });
    });
}

// Initialize SQLite Database (Netlify Serverless workaround)
const dbPath = path.join('/tmp', 'database.sqlite');
try {
    const bundledDb = path.join(__dirname, '../../database.sqlite');
    if (fs.existsSync(bundledDb)) {
        const bundledStat = fs.statSync(bundledDb);
        const tmpStat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
        if (!tmpStat || bundledStat.mtimeMs > tmpStat.mtimeMs) {
            fs.copyFileSync(bundledDb, dbPath);
        }
    }
} catch (e) {
    console.error("DB init error", e);
}
const db = new Database(dbPath, { verbose: console.log });

console.log('Connected to the SQLite database.');

// Create members table if it doesn't exist
db.exec(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Attempt to add password column to older tables (ignoring errors if it already exists)
try {
    db.exec(`ALTER TABLE members ADD COLUMN password TEXT`);
} catch (e) {
    // Ignore, column likely exists
}

try {
    db.exec(`ALTER TABLE members ADD COLUMN reset_token TEXT`);
    db.exec(`ALTER TABLE members ADD COLUMN reset_token_expires DATETIME`);
} catch (e) {
    // Ignore
}

try {
    db.exec(`ALTER TABLE members ADD COLUMN requires_password_change BOOLEAN DEFAULT 0`);
} catch (e) {
    // Ignore
}

// Attempt to add meal_type column to older tables
try {
    db.exec(`ALTER TABLE food_logs ADD COLUMN meal_type TEXT DEFAULT 'Breakfast'`);
} catch (e) {
    // Ignore, column likely exists
}

// Create Member Dashboard Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS intake_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL UNIQUE,
        gender TEXT NOT NULL,
        age INTEGER NOT NULL,
        height REAL NOT NULL,
        weight REAL NOT NULL,
        activity_level TEXT NOT NULL,
        goal TEXT NOT NULL,
        target_cal INTEGER NOT NULL,
        target_pro INTEGER NOT NULL,
        target_carb INTEGER NOT NULL,
        target_fat INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        goal_type TEXT NOT NULL,
        target_value REAL NOT NULL,
        current_value REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        food_name TEXT NOT NULL,
        calories INTEGER NOT NULL,
        protein INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fat INTEGER NOT NULL,
        meal_type TEXT DEFAULT 'Breakfast',
        log_date DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        weight REAL NOT NULL,
        log_date DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );
`);

// Purchase Endpoint
app.post('/api/purchase', (req, res) => {
    const { name, email, cardNumber } = req.body;
    
    // Basic validation
    if (!name || !email || !cardNumber) {
        return res.status(400).json({ error: 'Name, email, and card details are required.' });
    }

    console.log(`Processing simulated $29.99 payment for ${email}`);
    
    // Generate a temporary 8-character password
    const tempPassword = crypto.randomBytes(4).toString('hex');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(tempPassword, salt);

    try {
        const stmt = db.prepare(`INSERT INTO members (name, email, password, requires_password_change) VALUES (?, ?, ?, ?)`);
        const info = stmt.run(name, email, hashedPassword, 1);
        console.log(`Successfully added member with ID ${info.lastInsertRowid}`);
        
        // Send Email
        if (transporter) {
            const mailOptions = {
                from: process.env.SMTP_FROM_EMAIL || '"BrandName Team" <noreply@brandname.com>',
                to: email,
                subject: 'Welcome! Your Member Access Details',
                text: `Hi ${name},\n\nThank you for purchasing The Ultimate Guide! Your temporary password to access member content is: ${tempPassword}\n\nPlease log in at our website using this password.\n\nCheers,\nBrandName Team`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Message sent: %s', info.messageId);
                    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // URL to view the email
                }
            });
        }

        res.status(201).json({ message: 'Purchase successful! Please check your email for your temporary password.', memberId: info.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'This email has already purchased the book.' });
        }
        if (err.message.includes('NOT NULL constraint failed: members.password')) {
            // This happens if the alter table failed but table existed. A real fix is dropping test db.
            console.error('Schema error - recreate DB.');
        }
        console.error(err.message);
        return res.status(500).json({ error: 'Failed to complete purchase.' });
    }
});

// Login Endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const stmt = db.prepare(`SELECT * FROM members WHERE email = ?`);
        const user = stmt.get(email);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        
        const isMatch = bcrypt.compareSync(password, user.password || '');
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        
        if (user.requires_password_change) {
            return res.status(403).json({ requiresPasswordChange: true, email: user.email, tempPassword: password, message: 'Please create a new password.' });
        }
        
        console.log(`User ${email} successfully logged in.`);
        res.status(200).json({ message: 'Login successful!', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Force Password Change
app.post('/api/force-password-change', (req, res) => {
    const { email, tempPassword, newPassword } = req.body;
    if (!email || !tempPassword || !newPassword) return res.status(400).json({ error: 'All fields are required.' });

    try {
        const user = db.prepare(`SELECT * FROM members WHERE email = ?`).get(email);
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const isMatch = bcrypt.compareSync(tempPassword, user.password || '');
        if (!isMatch || !user.requires_password_change) {
            return res.status(401).json({ error: 'Invalid credentials or change not required.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        db.prepare(`UPDATE members SET password = ?, requires_password_change = 0 WHERE email = ?`).run(hashedPassword, email);

        res.json({ message: 'Password updated successfully!', user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Forgot Password
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = db.prepare('SELECT id FROM members WHERE email = ?').get(email);
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        db.prepare('UPDATE members SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);

        if (transporter) {
            const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
            const mailOptions = {
                from: process.env.SMTP_FROM_EMAIL || '"BrandName Team" <noreply@brandname.com>',
                to: email,
                subject: 'Password Reset Request',
                text: `You requested a password reset. Click the link below to set a new password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nCheers,\nBrandName Team`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending reset email:', error);
                } else {
                    console.log('Reset email sent: %s', info.messageId);
                    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                }
            });
        }
        res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Reset Password
app.post('/api/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });

    try {
        const user = db.prepare('SELECT id FROM members WHERE reset_token = ? AND reset_token_expires > ?').get(token, new Date().toISOString());
        
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired password reset token.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        db.prepare('UPDATE members SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hashedPassword, user.id);

        res.json({ message: 'Password has been successfully reset. You may now log in.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- Dashboard Endpoints ---

// Update Intake Profile
app.post('/api/intake', (req, res) => {
    const { memberId, gender, age, height, weight, activityLevel, goal } = req.body;
    try {
        const weightKg = weight * 0.453592;
        const heightCm = height * 2.54;
        let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
        bmr += (gender === 'Male') ? 5 : -161;

        let activityMultiplier = 1.2;
        if (activityLevel === 'Lightly Active') activityMultiplier = 1.375;
        else if (activityLevel === 'Moderately Active') activityMultiplier = 1.55;
        else if (activityLevel === 'Very Active') activityMultiplier = 1.725;

        let tdee = bmr * activityMultiplier;

        let targetCal = tdee;
        if (goal === 'Fat Loss') targetCal -= 500;
        else if (goal === 'Muscle Gain') targetCal += 300;
        
        targetCal = Math.round(targetCal);
        const targetPro = Math.round(weight); // 1g per lb
        const targetFat = Math.round((targetCal * 0.25) / 9);
        const targetCarb = Math.round((targetCal - (targetPro * 4) - (targetFat * 9)) / 4);

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO intake_profiles (member_id, gender, age, height, weight, activity_level, goal, target_cal, target_pro, target_carb, target_fat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(memberId, gender, age, height, weight, activityLevel, goal, targetCal, targetPro, targetCarb, targetFat);

        res.json({ message: 'Intake profile saved successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update intake profile.' });
    }
});

// Get Dashboard Data
app.get('/api/dashboard/:memberId', (req, res) => {
    const { memberId } = req.params;
    try {
        const member = db.prepare('SELECT name, email FROM members WHERE id = ?').get(memberId);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const goals = db.prepare('SELECT * FROM goals WHERE member_id = ? ORDER BY created_at DESC LIMIT 1').get(memberId);
        const intake_profile = db.prepare('SELECT * FROM intake_profiles WHERE member_id = ?').get(memberId);
        const food_logs = db.prepare('SELECT * FROM food_logs WHERE member_id = ? AND log_date = DATE(\'now\', \'localtime\')').all(memberId);
        
        // Fetch historical weight logs
        const weight_logs = db.prepare('SELECT * FROM weight_logs WHERE member_id = ? ORDER BY log_date DESC').all(memberId);

        // Fetch macro totals
        const weekly_macros = db.prepare(`
            SELECT SUM(calories) as cal, SUM(protein) as pro, SUM(carbs) as carb, SUM(fat) as fat 
            FROM food_logs 
            WHERE member_id = ? AND log_date >= DATE('now', 'localtime', '-7 days')
        `).get(memberId) || { cal: 0, pro: 0, carb: 0, fat: 0 };

        const yearly_macros = db.prepare(`
            SELECT SUM(calories) as cal, SUM(protein) as pro, SUM(carbs) as carb, SUM(fat) as fat 
            FROM food_logs 
            WHERE member_id = ?
        `).get(memberId) || { cal: 0, pro: 0, carb: 0, fat: 0 };

        res.json({ member, goals, intake_profile, food_logs, weight_logs, weekly_macros, yearly_macros });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

// Search Global Foods
app.get('/api/food/search', (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const altQuery = query.toLowerCase().replace(/pilsberry|pillsberry|pilsbury/g, 'pillsbury');
        const stmt = db.prepare(`SELECT * FROM global_foods WHERE name LIKE ? OR name LIKE ? LIMIT 50`);
        const foods = stmt.all(`%${query}%`, `%${altQuery}%`);
        res.json(foods);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to search foods.' });
    }
});

// Update Goal
app.post('/api/goals', (req, res) => {
    const { memberId, goalType, targetValue, currentValue } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO goals (member_id, goal_type, target_value, current_value) VALUES (?, ?, ?, ?)');
        stmt.run(memberId, goalType, targetValue, currentValue || 0);
        res.json({ message: 'Goal updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update goal.' });
    }
});

// Log Food
app.post('/api/food', (req, res) => {
    const { memberId, foodName, calories, protein, carbs, fat, mealType } = req.body;
    try {
        const stmt = db.prepare("INSERT INTO food_logs (member_id, food_name, calories, protein, carbs, fat, meal_type, log_date) VALUES (?, ?, ?, ?, ?, ?, ?, DATE('now', 'localtime'))");
        const result = stmt.run(memberId, foodName, calories, protein, carbs, fat, mealType || 'Breakfast');
        res.json({ message: 'Food logged successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to log food.' });
    }
});

// Delete Food
app.delete('/api/food/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM food_logs WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Food deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete food.' });
    }
});

// Update Food
app.put('/api/food/:id', (req, res) => {
    const { id } = req.params;
    const { foodName, calories, protein, carbs, fat, mealType } = req.body;
    try {
        const stmt = db.prepare('UPDATE food_logs SET food_name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, meal_type = ? WHERE id = ?');
        stmt.run(foodName, calories, protein, carbs, fat, mealType, id);
        res.json({ message: 'Food updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update food.' });
    }
});

// Log Weight
app.post('/api/weight', (req, res) => {
    const { memberId, weight } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO weight_logs (member_id, weight) VALUES (?, ?)');
        stmt.run(memberId, weight);
        res.json({ message: 'Weight logged successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to log weight.' });
    }
});

app.put('/api/weight/:id', (req, res) => {
    const { weight } = req.body;
    try {
        const stmt = db.prepare('UPDATE weight_logs SET weight = ? WHERE id = ?');
        stmt.run(weight, req.params.id);
        res.json({ message: 'Weight updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update weight.' });
    }
});

app.delete('/api/weight/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM weight_logs WHERE id = ?');
        stmt.run(req.params.id);
        res.json({ message: 'Weight deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete weight.' });
    }
});

module.exports.handler = serverless(app);
