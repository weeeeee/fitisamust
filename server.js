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
app.use(express.static(__dirname));

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Rewrite for Netlify Functions
app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
        req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    next();
});

// Initialize Nodemailer with Gmail, Custom SMTP, or Ethereal test account
let transporter;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
    console.log('Gmail SMTP Email Transporter configured.');
} else if (process.env.SMTP_HOST) {
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

// Helper: Send Welcome & Initial Temporary Password Email
async function sendInitialTempPasswordEmail(name, recipientEmail, tempPassword) {
    if (!transporter) return false;
    const sender = process.env.GMAIL_USER 
        ? `"FIT IS A MUST Support" <${process.env.GMAIL_USER}>` 
        : (process.env.SMTP_FROM_EMAIL || '"FIT IS A MUST Team" <noreply@fitisamust.com>');

    const mailOptions = {
        from: sender,
        to: recipientEmail,
        subject: 'Welcome to FIT IS A MUST - Your Temporary Password',
        html: `
            <div style="font-family: Arial, sans-serif; background: #0f172a; color: #ffffff; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #38bdf8; text-align: center; margin-top: 0;">Welcome, ${name || 'Member'}! 💪</h2>
                <p style="color: #cbd5e1; font-size: 0.95rem;">Thank you for joining FIT IS A MUST. Your temporary password to log in to member portal content is:</p>
                <div style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); padding: 16px; border-radius: 8px; font-size: 1.4rem; text-align: center; letter-spacing: 2px; font-weight: bold; color: #c084fc; margin: 20px 0;">
                    ${tempPassword}
                </div>
                <p style="color: #94a3b8; font-size: 0.85rem; text-align: center;">
                    Please log in using this temporary password. You will be prompted to set a new password upon login.
                </p>
            </div>
        `,
        text: `Hi ${name || 'Member'},\n\nWelcome to FIT IS A MUST! Your temporary login password is: ${tempPassword}\n\nPlease log in at fitisamust.com using this password.`
    };

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending welcome email:', error);
                return resolve(false);
            }
            console.log('Welcome email sent successfully: %s', info.messageId);
            if (nodemailer.getTestMessageUrl(info)) console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            resolve(true);
        });
    });
}

// Helper: Send Password Recovery & Temporary Password Email
async function sendPasswordRecoveryEmail(recipientEmail, tempPassword, resetToken) {
    if (!transporter) return false;
    const sender = process.env.GMAIL_USER 
        ? `"FIT IS A MUST Support" <${process.env.GMAIL_USER}>` 
        : (process.env.SMTP_FROM_EMAIL || '"FIT IS A MUST Team" <noreply@fitisamust.com>');
    
    const resetUrl = `https://fitisamust.com/reset-password.html?token=${resetToken}`;

    const mailOptions = {
        from: sender,
        to: recipientEmail,
        subject: 'FIT IS A MUST - Password Reset & Recovery',
        html: `
            <div style="font-family: Arial, sans-serif; background: #0f172a; color: #ffffff; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #38bdf8; text-align: center; margin-top: 0;">Password Reset Request 🔑</h2>
                <p style="color: #cbd5e1; font-size: 0.95rem;">We received a request to recover your password. Here is your temporary login password:</p>
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 16px; border-radius: 8px; font-size: 1.4rem; text-align: center; letter-spacing: 2px; font-weight: bold; color: #f87171; margin: 20px 0;">
                    ${tempPassword}
                </div>
                <p style="color: #cbd5e1; font-size: 0.9rem; text-align: center; margin-bottom: 25px;">
                    Or click the direct reset link below:
                </p>
                <div style="text-align: center; margin-bottom: 25px;">
                    <a href="${resetUrl}" style="background: #38bdf8; color: #0f172a; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">
                        Reset Password Now
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 0.8rem; text-align: center;">
                    If you did not request this, please ignore this email or contact support.
                </p>
            </div>
        `,
        text: `FIT IS A MUST Password Reset Request\n\nYour temporary password is: ${tempPassword}\n\nReset link: ${resetUrl}`
    };

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending password recovery email:', error);
                return resolve(false);
            }
            console.log('Password recovery email sent: %s', info.messageId);
            if (nodemailer.getTestMessageUrl(info)) console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            resolve(true);
        });
    });
}

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
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

try {
    db.exec(`ALTER TABLE members ADD COLUMN forum_username TEXT`);
    db.exec(`ALTER TABLE members ADD COLUMN forum_password TEXT`);
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

    CREATE TABLE IF NOT EXISTS member_integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        external_id TEXT,
        access_token TEXT,
        refresh_token TEXT,
        last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        UNIQUE(member_id, provider),
        FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS forum_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS forum_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
        FOREIGN KEY(member_id) REFERENCES members(id)
    );
`);

// Purchase Endpoint
app.post('/api/purchase', async (req, res) => {
    const { name, email, cardNumber } = req.body;
    
    if (!name || !email || !cardNumber) {
        return res.status(400).json({ error: 'Name, email, and card details are required.' });
    }

    console.log(`Processing simulated $29.99 payment for ${email}`);
    
    const tempPassword = crypto.randomBytes(4).toString('hex');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(tempPassword, salt);

    try {
        const stmt = db.prepare(`INSERT INTO members (name, email, password, requires_password_change) VALUES (?, ?, ?, ?)`);
        const info = stmt.run(name, email, hashedPassword, 1);
        console.log(`Successfully added member with ID ${info.lastInsertRowid}`);
        
        await sendInitialTempPasswordEmail(name, email, tempPassword);

        res.status(201).json({ message: 'Purchase successful! Please check your email for your temporary password.', memberId: info.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'This email has already purchased the book.' });
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
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const user = db.prepare('SELECT id, name FROM members WHERE email = ?').get(email);
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a password recovery email has been sent.' });
        }

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(tempPassword, salt);
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        db.prepare('UPDATE members SET password = ?, requires_password_change = 1, reset_token = ?, reset_token_expires = ? WHERE id = ?').run(hashedPassword, token, expires, user.id);

        await sendPasswordRecoveryEmail(email, tempPassword, token);

        res.json({ message: 'If an account with that email exists, a password recovery email has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
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
        const weight_logs = db.prepare('SELECT * FROM weight_logs WHERE member_id = ? ORDER BY log_date DESC, id DESC').all(memberId);

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
    const { memberId, weight, source } = req.body;
    try {
        const weightVal = parseFloat(weight);
        const latestLog = db.prepare('SELECT weight FROM weight_logs WHERE member_id = ? ORDER BY log_date DESC, id DESC LIMIT 1').get(memberId);
        if (!latestLog || parseFloat(latestLog.weight) !== weightVal) {
            const stmt = db.prepare("INSERT INTO weight_logs (member_id, weight, log_date, source) VALUES (?, ?, DATE('now', 'localtime'), ?)");
            stmt.run(memberId, weightVal, source || 'Manual Input');
        }
        res.json({ message: 'Weight logged successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to log weight.' });
    }
});

app.put('/api/weight/:id', (req, res) => {
    const { weight, memberId, source } = req.body;
    try {
        const weightVal = parseFloat(weight);
        const logId = req.params.id;
        const stmt = db.prepare('UPDATE weight_logs SET weight = ?, source = COALESCE(?, source) WHERE id = ?');
        stmt.run(weightVal, source || 'Manual Input', logId);

        let targetMemberId = memberId;
        if (!targetMemberId) {
            const log = db.prepare('SELECT member_id FROM weight_logs WHERE id = ?').get(logId);
            if (log) targetMemberId = log.member_id;
        }
        if (targetMemberId) {
            db.prepare('UPDATE intake_profiles SET weight = ? WHERE member_id = ?').run(weightVal, targetMemberId);
        }
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

// --- Integrations & Automatic Scale / Health Webhooks ---

// Get Member Integrations
app.get('/api/integrations/:memberId', (req, res) => {
    try {
        const rows = db.prepare('SELECT provider, status, last_synced_at FROM member_integrations WHERE member_id = ?').all(req.params.memberId);
        res.json({ integrations: rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch integrations.' });
    }
});

// Update / Connect Integration
app.post('/api/integrations/connect', (req, res) => {
    const { memberId, provider } = req.body;
    if (!memberId || !provider) return res.status(400).json({ error: 'memberId and provider required.' });
    try {
        const stmt = db.prepare(`
            INSERT INTO member_integrations (member_id, provider, status, last_synced_at)
            VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
            ON CONFLICT(member_id, provider) DO UPDATE SET status = 'active', last_synced_at = CURRENT_TIMESTAMP
        `);
        stmt.run(memberId, provider);
        res.json({ message: `Successfully connected ${provider}`, provider });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to connect integration.' });
    }
});

// Direct Health App / Bluetooth / Scale Sync Endpoint
app.post('/api/integrations/sync-weight', (req, res) => {
    const { memberId, weight, provider } = req.body;
    if (!memberId || !weight) return res.status(400).json({ error: 'memberId and weight required.' });
    try {
        const weightVal = parseFloat(weight);
        const latestLog = db.prepare('SELECT weight FROM weight_logs WHERE member_id = ? ORDER BY log_date DESC, id DESC LIMIT 1').get(memberId);
        if (!latestLog || parseFloat(latestLog.weight) !== weightVal) {
            const weightStmt = db.prepare("INSERT INTO weight_logs (member_id, weight, log_date, source) VALUES (?, ?, DATE('now', 'localtime'), ?)");
            weightStmt.run(memberId, weightVal, provider || 'Wearable Sync');
        }

        db.prepare('UPDATE intake_profiles SET weight = ? WHERE member_id = ?').run(weightVal, memberId);

        if (provider) {
            const intStmt = db.prepare(`
                INSERT INTO member_integrations (member_id, provider, status, last_synced_at)
                VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
                ON CONFLICT(member_id, provider) DO UPDATE SET status = 'active', last_synced_at = CURRENT_TIMESTAMP
            `);
            intStmt.run(memberId, provider);
        }

        res.json({ message: 'Weight synced successfully via integration!', weight: weightVal });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to sync weight.' });
    }
});

// Webhook Endpoint (Accepts automated weight payloads from Withings, Terra API, Fitbit, Apple Health)
app.post('/api/webhooks/weight', (req, res) => {
    const { memberId, email, weight, source } = req.body;
    try {
        let targetMemberId = memberId;
        if (!targetMemberId && email) {
            const user = db.prepare('SELECT id FROM members WHERE email = ?').get(email);
            if (user) targetMemberId = user.id;
        }
        if (!targetMemberId) {
            const defaultUser = db.prepare('SELECT id FROM members ORDER BY id ASC LIMIT 1').get();
            targetMemberId = defaultUser ? defaultUser.id : 3;
        }

        let weightVal = parseFloat(weight);
        if (isNaN(weightVal) || weightVal <= 0) {
            const latestLog = db.prepare('SELECT weight FROM weight_logs WHERE member_id = ? ORDER BY id DESC LIMIT 1').get(targetMemberId);
            if (latestLog && latestLog.weight) {
                weightVal = latestLog.weight;
            } else {
                const profile = db.prepare('SELECT weight FROM intake_profiles WHERE member_id = ?').get(targetMemberId);
                weightVal = (profile && profile.weight) ? profile.weight : null;
            }
        }

        if (weightVal && weightVal > 0) {
            const latestLog = db.prepare('SELECT weight FROM weight_logs WHERE member_id = ? ORDER BY log_date DESC, id DESC LIMIT 1').get(targetMemberId);
            if (!latestLog || parseFloat(latestLog.weight) !== weightVal) {
                const stmt = db.prepare("INSERT INTO weight_logs (member_id, weight, log_date, source) VALUES (?, ?, DATE('now', 'localtime'), ?)");
                stmt.run(targetMemberId, weightVal, source || 'Garmin Connect');
            }
            db.prepare('UPDATE intake_profiles SET weight = ? WHERE member_id = ?').run(weightVal, targetMemberId);
        }

        const intStmt = db.prepare(`
            INSERT INTO member_integrations (member_id, provider, status, last_synced_at)
            VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
            ON CONFLICT(member_id, provider) DO UPDATE SET status = 'active', last_synced_at = CURRENT_TIMESTAMP
        `);
        intStmt.run(targetMemberId, source || 'Webhook');

        res.json({ success: true, message: 'Webhook weight payload processed', memberId: targetMemberId, weight: weightVal });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});

// --- Forum Endpoints ---

// Get member forum settings
app.get('/api/member/forum-settings/:memberId', (req, res) => {
    try {
        const member = db.prepare('SELECT id, name, email, forum_username, forum_password FROM members WHERE id = ?').get(req.params.memberId);
        if (!member) return res.status(404).json({ error: 'Member not found.' });
        res.json({
            forum_username: member.forum_username || '',
            has_forum_password: !!member.forum_password
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch forum settings.' });
    }
});

// Update member forum settings (username & password)
app.post('/api/member/forum-settings', (req, res) => {
    const { memberId, forumUsername, forumPassword } = req.body;
    if (!memberId || !forumUsername || !forumPassword) {
        return res.status(400).json({ error: 'Member ID, Forum Username, and Forum Password are required.' });
    }

    try {
        const existing = db.prepare('SELECT id FROM members WHERE forum_username = ? AND id != ?').get(forumUsername, memberId);
        if (existing) {
            return res.status(409).json({ error: 'This Forum Username is already taken by another member.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(forumPassword, salt);

        db.prepare('UPDATE members SET forum_username = ?, forum_password = ? WHERE id = ?').run(forumUsername, hashedPassword, memberId);
        res.json({ message: 'Forum credentials updated successfully!', forumUsername });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update forum credentials.' });
    }
});

// Verify forum password access for forum gate
app.post('/api/forum/verify-access', (req, res) => {
    const { memberId, forumUsername, forumPassword } = req.body;
    if (!memberId || !forumUsername || !forumPassword) {
        return res.status(400).json({ error: 'Member ID, Forum Username, and Forum Password are required.' });
    }

    try {
        const member = db.prepare('SELECT id, name, email, forum_username, forum_password FROM members WHERE id = ?').get(memberId);
        if (!member) return res.status(401).json({ error: 'Member account not found.' });
        if (!member.forum_username || !member.forum_password) {
            return res.status(403).json({ error: 'Forum credentials not configured. Please set them in Member Settings first.' });
        }

        if (member.forum_username.toLowerCase() !== forumUsername.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid Forum Username.' });
        }

        const isMatch = bcrypt.compareSync(forumPassword, member.forum_password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid Forum Password.' });
        }

        res.json({
            success: true,
            member: {
                id: member.id,
                name: member.name,
                forum_username: member.forum_username
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to verify forum access.' });
    }
});

// Get Forum Threads (Optionally filter by category)
app.get('/api/forum/threads', (req, res) => {
    const category = req.query.category;
    try {
        let threads;
        if (category && category !== 'All') {
            threads = db.prepare(`
                SELECT ft.*, m.name as author_name, COALESCE(m.forum_username, m.name) as author_username,
                       (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) as reply_count
                FROM forum_threads ft
                JOIN members m ON ft.member_id = m.id
                WHERE ft.category = ?
                ORDER BY ft.created_at DESC
            `).all(category);
        } else {
            threads = db.prepare(`
                SELECT ft.*, m.name as author_name, COALESCE(m.forum_username, m.name) as author_username,
                       (SELECT COUNT(*) FROM forum_replies fr WHERE fr.thread_id = ft.id) as reply_count
                FROM forum_threads ft
                JOIN members m ON ft.member_id = m.id
                ORDER BY ft.created_at DESC
            `).all();
        }
        res.json(threads);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch forum threads.' });
    }
});

// Get Single Thread with Replies
app.get('/api/forum/threads/:id', (req, res) => {
    try {
        const thread = db.prepare(`
            SELECT ft.*, m.name as author_name, COALESCE(m.forum_username, m.name) as author_username
            FROM forum_threads ft
            JOIN members m ON ft.member_id = m.id
            WHERE ft.id = ?
        `).get(req.params.id);

        if (!thread) return res.status(404).json({ error: 'Thread not found.' });

        const replies = db.prepare(`
            SELECT fr.*, m.name as author_name, COALESCE(m.forum_username, m.name) as author_username
            FROM forum_replies fr
            JOIN members m ON fr.member_id = m.id
            WHERE fr.thread_id = ?
            ORDER BY fr.created_at ASC
        `).all(req.params.id);

        res.json({ thread, replies });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch thread detail.' });
    }
});

// Create New Thread
app.post('/api/forum/threads', (req, res) => {
    const { memberId, category, title, content } = req.body;
    if (!memberId || !category || !title || !content) {
        return res.status(400).json({ error: 'Category, title, and content are required.' });
    }

    if (!['General', 'Support'].includes(category)) {
        return res.status(400).json({ error: 'Category must be either General or Support.' });
    }

    try {
        const stmt = db.prepare('INSERT INTO forum_threads (member_id, category, title, content) VALUES (?, ?, ?, ?)');
        const result = stmt.run(memberId, category, title, content);
        res.status(201).json({ message: 'Thread created successfully!', threadId: result.lastInsertRowid });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create thread.' });
    }
});

// Post Reply to Thread
app.post('/api/forum/threads/:id/replies', (req, res) => {
    const threadId = req.params.id;
    const { memberId, content } = req.body;
    if (!memberId || !content) {
        return res.status(400).json({ error: 'Member ID and content are required.' });
    }

    try {
        const thread = db.prepare('SELECT id FROM forum_threads WHERE id = ?').get(threadId);
        if (!thread) return res.status(404).json({ error: 'Thread not found.' });

        const stmt = db.prepare('INSERT INTO forum_replies (thread_id, member_id, content) VALUES (?, ?, ?)');
        const result = stmt.run(threadId, memberId, content);
        res.status(201).json({ message: 'Reply posted successfully!', replyId: result.lastInsertRowid });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to post reply.' });
    }
});

// Express Error Handling Middleware to ensure JSON errors are always returned
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'An internal server error occurred.'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
