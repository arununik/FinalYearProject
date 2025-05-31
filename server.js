// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const SibApiV3Sdk = require('sib-api-v3-sdk');

const multer = require('multer');
const path = require('path');



const app = express();
const port = 5000;


// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.static(__dirname));



// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // your MySQL username
  password: 'root', // your MySQL password
  database: 'job_portal',
});

db.connect((err) => {
  if (err) throw err;
  console.log('✅ Connected to MySQL Database');
});



// Multer setup to save the file in 'uploads/certificates' folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../client/uploads/certificates')); // Save to 'client/uploads'
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
// Serve static files from the 'uploads/certificates' folder

// Endpoint to handle employer registration
app.post('/api/employer/register', upload.single('certificate'), (req, res) => {
  const { name, email, password, company_name, address, website, phone } = req.body;
  const certificatePath = req.file ? req.file.path : null; // Store the file path

  const sql = `
    INSERT INTO employers (name, email, password, company_name, address, website, phone, certificate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    name,
    email,
    password, // Ensure to hash the password before saving
    company_name,
    address,
    website,
    phone,
    certificatePath
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Error saving employer data." });
    }
    res.status(200).json({ message: "Employer registered successfully!" });
  });
});

// Sendinblue Email Function
const sendEmail = async (to, subject, content) => {
  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications['api-key'];
  apiKey.apiKey = process.env.SIB_API_KEY;

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  const email = {
    sender: { email: process.env.SENDER_EMAIL, name: 'Hiring Hub' },
    to: [{ email: to }],
    subject: subject,
    textContent: content,
  };

  try {
    await apiInstance.sendTransacEmail(email);
    console.log('📧 Email sent to', to);
  } catch (error) {
    console.error('❌ Email error:', error.response?.body || error.message);
  }
};

// Signup
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    if (result.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, password],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Insert error' });
        res.status(200).json({ message: 'User registered' });
      }
    );
  });
});

// Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
  
    db.query(
      'SELECT user_id, email FROM users WHERE email = ? AND password = ?',
      [email, password],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'DB error' });
  
        if (result.length === 0) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
  
        const { user_id, email } = result[0];
        res.status(200).json({ message: 'Login successful', user_id, email });
      }
    );
  });
  

// Forgot Password
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    if (result.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    db.query('UPDATE users SET reset_code = ? WHERE email = ?', [resetCode, email], async (err) => {
      if (err) return res.status(500).json({ message: 'Failed to save code' });

      await sendEmail(email, 'Password Reset Code', `Your code is: ${resetCode}`);
      res.status(200).json({ message: 'Reset code sent to email' });
    });
  });
});
// Reset Password
app.post('/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
  
    // Check if the email exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
      if (err) return res.status(500).json({ message: 'DB error' });
  
      if (result.length === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
  
      const user = result[0];
  
      // Check if the provided reset code matches the one in the database
      if (user.reset_code !== code) {
        return res.status(400).json({ message: 'Invalid reset code' });
      }
  
      // If reset code matches, update the password
      db.query('UPDATE users SET password = ? WHERE email = ?', [newPassword, email], (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to update password' });
  
        res.status(200).json({ message: 'Password reset successfully' });
      });
    });
  });



  //new 
  // Signup
app.post('/signup1', (req, res) => {
  const { name, email, password } = req.body;

  db.query('SELECT * FROM employers WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    if (result.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    db.query(
      'INSERT INTO employers (name, email, password) VALUES (?, ?, ?)',
      [name, email, password],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Insert error' });
        res.status(200).json({ message: 'User registered' });
      }
    );
  });
});

// Login
// Use bcrypt if passwords are hashed
// const bcrypt = require('bcrypt');

app.post('/login1', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT employer_id, email, approval_status, password FROM employers WHERE email = ?',
    [email],
    (err, result) => {
      if (err) {
        console.error("Database error:", err); // Better error visibility
        return res.status(500).json({ message: 'DB error' });
      }

      if (result.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const { employer_id, email: dbEmail, approval_status, password: storedPassword } = result[0];

      // Password match check (plain-text version)
      if (password !== storedPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Approval status checks
      if (!approval_status) {
        return res.status(403).json({ message: 'Employer approval status not set' });
      } else if (approval_status === 'pending') {
        return res.status(403).json({ message: 'Employer verification under progress' });
      } else if (approval_status === 'rejected') {
        return res.status(403).json({ message: 'Employer verification failed' });
      }

      // Approved
      res.status(200).json({ message: 'Login successful', employer_id, email: dbEmail });
    }
  );
});




  const sendEmail1 = async (to, subject, content) => {
    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = client.authentications['api-key'];
    apiKey.apiKey = process.env.SIB_API_KEY;
  
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  
    const email = {
      sender: { email: process.env.SENDER_EMAIL, name: 'Hiring Hub' },
      to: [{ email: to }],
      subject: subject,
      textContent: content,
    };
  
    try {
      await apiInstance.sendTransacEmail(email);
      console.log('📧 Email sent to', to);
    } catch (error) {
      console.error('❌ Email error:', error.response?.body || error.message);
    }
  }; 

// Forgot Password
app.post('/forgot-password1', (req, res) => {
  const { email } = req.body;
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  db.query('SELECT * FROM employers WHERE email = ?', [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });

    if (result.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    db.query('UPDATE employers SET reset_code = ? WHERE email = ?', [resetCode, email], async (err) => {
      if (err) return res.status(500).json({ message: 'Failed to save code' });

      await sendEmail1(email, 'Password Reset Code', `Your Password resed code is: ${resetCode}`);
      res.status(200).json({ message: 'Reset code sent to email' });
    });
  });
});
// Reset Password
app.post('/reset-password1', (req, res) => {
    const { email, code, newPassword } = req.body;
  
    // Check if the email exists
    db.query('SELECT * FROM employers WHERE email = ?', [email], (err, result) => {
      if (err) return res.status(500).json({ message: 'DB error' });
  
      if (result.length === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
  
      const user = result[0];
  
      // Check if the provided reset code matches the one in the database
      if (user.reset_code !== code) {
        return res.status(400).json({ message: 'Invalid reset code' });
      }
  
      // If reset code matches, update the password
      db.query('UPDATE employers SET password = ? WHERE email = ?', [newPassword, email], (err, result) => {
        if (err) return res.status(500).json({ message: 'Failed to update password' });
  
        res.status(200).json({ message: 'Password reset successfully' });
      });
    });
  });


  
  const sendEmail2 = async (to, subject, content) => {
    const client = SibApiV3Sdk.ApiClient.instance;
    const apiKey = client.authentications['api-key'];
    apiKey.apiKey = process.env.SIB_API_KEY;
  
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  
    const email = {
      sender: { email: process.env.SENDER_EMAIL, name: 'Hiring Hub' },
      to: [{ email: to }],
      subject: subject,
      textContent: content,
    };
  
    try {
      await apiInstance.sendTransacEmail(email);
      console.log('📧 Email sent to', to);
    } catch (error) {
      console.error('❌ Email error:', error.response?.body || error.message);
    }
  }; 
  app.post('/send-code', (req, res) => {
    const { email } = req.body;
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  
    db.query('SELECT * FROM admin WHERE email = ?', [email], (err, result) => {
      if (err) return res.status(500).json({ message: 'DB error' });
  
      if (result.length === 0) {
        return res.status(404).json({ message: 'You are not an Admin' });
      }
  
      db.query('UPDATE admin SET codes = ? WHERE email = ?', [resetCode, email], async (err) => {
        if (err) return res.status(500).json({ message: 'Failed to save code' });
  
        await sendEmail2(email, 'Password Reset Code', `Your Login code is: ${resetCode}`);
        res.status(200).json({ message: 'Login code sent to email' });
      });
    });
  });

  app.post('/enter-code', (req, res) => {
    const { email, code, newPassword } = req.body;
  
    // Check if the email exists
    db.query('SELECT * FROM admin WHERE email = ?', [email], (err, result) => {
      if (err) return res.status(500).json({ message: 'DB error' });
  
      if (result.length === 0) {
        return res.status(404).json({ message: 'You are not an Admin' });
      }
  
      const user = result[0];
  
      // Check if the provided reset code matches the one in the database
      if (user.codes !== code) {
        return res.status(400).json({ message: 'Invalid login code' });
      }
  

  
      res.status(200).json({ message: 'Login successfully' });
      
    });
  });

  app.get('/api/empDetails/:empId', (req, res) => {
    const { empId } = req.params;
    const query = `
      SELECT employer_id, name, company_name, email, website, phone, address, certificate
      FROM employers WHERE employer_id = ?
    `;
    
    db.query(query, [empId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Internal Server Error' });
      if (rows.length === 0) return res.status(404).json({ message: 'Employer not found' });
      res.json(rows[0]);
    });
  });
  


// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
