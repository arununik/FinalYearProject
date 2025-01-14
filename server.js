const express = require('express');
const mysql = require('mysql2');

const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', // Replace with your MySQL password
    database: 'job_portal'
});

db.connect(err => {
    if (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database.');
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400).send({ message: 'All fields are required.' });
        return;
    }

    const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(query, [name, email, password,'job_seeker'], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                res.status(400).send({ message: 'Email already exists. Please use a different email.' });
            } else {
                console.error('Error during registration:', err);
                res.status(500).send({ message: 'Error registering user. Please try again later.' });
            }
        } else {
            res.status(200).send({ message: 'User registered successfully.' });
        }
    });
});

// Registration endpoint


// Login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).send({ message: 'Email and password are required.' });
        return;
    }

    const query = 'SELECT user_id, email FROM users WHERE email = ? AND password = ?';
    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send({ message: 'Error logging in. Please try again later.' });
        } else if (results.length === 0) {
            res.status(404).send({ message: 'Account not found. Please sign up.' });
        } else {
            // Extract user_id and email from the query result
            const userId = results[0].user_id;
            const userEmail = results[0].email;

            // Send success response with user_id and email
            res.status(200).send({
                message: 'Login successful.',
                email: userEmail,
                user_id: userId,
            });
        }
    });
});


// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
