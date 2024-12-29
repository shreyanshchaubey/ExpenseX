require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const path = require('path');
const CashFlowMinimizer = require('./utils/cashFlowMinimizer');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST ,
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD ,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');

// Authentication middleware
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async(req, res) => {
    const { email, password } = req.body;
    const query = 'SELECT * FROM users WHERE email = ?';

    db.query(query, [email], async(err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            return res.status(400).send('User not found');
        }

        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).send('Invalid password');
        }

        req.session.user = { id: user.id, name: user.name, email: user.email };
        res.redirect('/dashboard');
    });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async(req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(query, [name, email, hashedPassword], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).send('Email already exists');
            }
            throw err;
        }
        res.redirect('/login');
    });
});

app.get('/dashboard', requireLogin, (req, res) => {
    const query = `
        SELECT g.*, 
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            (SELECT SUM(amount) FROM expenses WHERE group_id = g.id) as total_expenses
        FROM user_groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
    `;

    db.query(query, [req.session.user.id], (err, groups) => {
        if (err) throw err;
        res.render('dashboard', { user: req.session.user, groups });
    });
});

app.post('/groups/create', requireLogin, async(req, res) => {
    const { name, members } = req.body;
    const memberEmails = members ? members.split(',').map(email => email.trim()) : [];

    try {
        await db.promise().beginTransaction();

        // Create group
        const [groupResult] = await db.promise().query(
            'INSERT INTO user_groups (name, creator_id) VALUES (?, ?)', [name, req.session.user.id]
        );

        // Add creator as member
        await db.promise().query(
            'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupResult.insertId, req.session.user.id]
        );

        // Add other members
        if (memberEmails.length > 0) {
            const [users] = await db.promise().query(
                'SELECT id FROM users WHERE email IN (?)', [memberEmails]
            );

            for (const user of users) {
                await db.promise().query(
                    'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupResult.insertId, user.id]
                );
            }
        }

        await db.promise().commit();
        res.redirect('/dashboard');
    } catch (error) {
        await db.promise().rollback();
        console.error('Error creating group:', error);
        res.status(500).send('Error creating group');
    }
});

app.get('/groups/:id', requireLogin, async(req, res) => {
    try {
        // Get group details
        const [
            [group]
        ] = await db.promise().query(
            'SELECT * FROM user_groups WHERE id = ?', [req.params.id]
        );

        if (!group) {
            return res.status(404).send('Group not found');
        }

        // Check if user is member
        const [
            [membership]
        ] = await db.promise().query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [req.params.id, req.session.user.id]
        );

        if (!membership) {
            return res.status(403).send('You are not a member of this group');
        }

        // Get members
        const [members] = await db.promise().query(`
            SELECT u.id, u.name, u.email
            FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `, [req.params.id]);

        // Get expenses
        const [expenses] = await db.promise().query(`
            SELECT e.*, u.name as paid_by_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            WHERE e.group_id = ?
            ORDER BY e.created_at DESC
        `, [req.params.id]);

        // Get expense shares
        for (let expense of expenses) {
            const [shares] = await db.promise().query(`
                SELECT u.name, es.share_amount
                FROM expense_shares es
                JOIN users u ON es.user_id = u.id
                WHERE es.expense_id = ?
            `, [expense.id]);
            expense.shares = shares;
        }

        // Calculate settlements
        const minimizer = new CashFlowMinimizer();
        const settlements = minimizer.minCashFlow(
            expenses.map(e => ({
                amount: e.amount,
                paidBy: e.paid_by_name,
                participants: e.shares.map(s => s.name)
            })),
            members.map(m => m.name)
        );

        res.render('group-detail', {
            user: req.session.user,
            group,
            members,
            expenses,
            settlements
        });
    } catch (error) {
        console.error('Error loading group:', error);
        res.status(500).send('Error loading group');
    }
});

app.post('/groups/:id/expenses/add', requireLogin, async(req, res) => {
    const { amount, description } = req.body;
    const groupId = req.params.id;

    try {
        await db.promise().beginTransaction();

        // Add expense
        const [expenseResult] = await db.promise().query(
            'INSERT INTO expenses (group_id, paid_by, amount, description) VALUES (?, ?, ?, ?)', [groupId, req.session.user.id, amount, description]
        );

        // Get participants array (handle both string and array input)
        let participantIds = Array.isArray(req.body.participants) ?
            req.body.participants :
            [req.body.participants];

        // Convert to numbers
        participantIds = participantIds.map(id => parseInt(id));

        // Add expense shares
        const shareAmount = amount / participantIds.length;
        for (const participantId of participantIds) {
            await db.promise().query(
                'INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?, ?, ?)', [expenseResult.insertId, participantId, shareAmount]
            );
        }

        await db.promise().commit();
        res.redirect(`/groups/${groupId}`);
    } catch (error) {
        await db.promise().rollback();
        console.error('Error adding expense:', error);
        res.status(500).send('Error adding expense');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
