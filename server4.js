const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const SibApiV3Sdk = require('sib-api-v3-sdk');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root', // replace if your DB has a password
  database: 'job_portal' // change this to your actual DB name
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Connected to MySQL Database');
});

// Sendinblue email function
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

// Fetch applications with filters
app.get('/api/applications1', (req, res) => {
  const { name, cgpa, company, employer_id } = req.query;

  let sql = 'SELECT * FROM applications';
  const conditions = [];
  const values = [];

  if (name) {
    conditions.push('name LIKE ?');
    values.push(`%${name}%`);
  }
  if (cgpa) {
    conditions.push('cgpa LIKE ?');
    values.push(`%${cgpa}%`);
  }
  if (company) {
    conditions.push('company LIKE ?');
    values.push(`%${company}%`);
  }
  if (employer_id) {
    conditions.push('employer_id = ?');
    values.push(employer_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

// Update application status and send email
app.put('/api/applications/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updateQuery = 'UPDATE applications SET status = ? WHERE application_id = ?';

  db.query(updateQuery, [status, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database update failed' });

    const detailsQuery = `
      SELECT a.name, a.contact, a.company, u.email, j.salary, j.interview_date, j.interview_type, j.title
      FROM applications a
      JOIN users u ON a.user_id = u.user_id
      JOIN jobs j ON a.job_id = j.job_id
      WHERE a.application_id = ?
    `;

    db.query(detailsQuery, [id], async (err2, rows) => {
      if (err2 || rows.length === 0) return res.status(500).json({ error: 'Failed to fetch details' });

      const appData = rows[0];
      const { email, name, title, company, salary, interview_date, interview_type } = appData;

      let subject, content;

      if (status === 'accepted') {
        subject = 'Your Job Application has been Accepted';
        content = `
Hi ${name},

🎉 Congratulations! You've been accepted for the position **${title}** at **${company}**.

📅 Interview Date: ${interview_date}  
💼 Salary: ₹${salary}  
🗂 Interview Type: ${interview_type}

Please prepare accordingly.  
Best regards,  
Hiring Hub Team
        `;
      } else if (status === 'rejected') {
        subject = 'Job Application Update - Not Selected';
        content = `
Hi ${name},

Thank you for applying to **${company}** for the role **${title}**.  
We appreciate your interest, but regret to inform you that your application has not been selected at this time.

We encourage you to apply for future opportunities.  
Warm regards,  
Hiring Hub Team
        `;
      }

      try {
        await sendEmail2(email, subject, content);
        res.json({ message: 'Status updated and email sent' });
      } catch (err3) {
        res.status(500).json({ error: 'Status updated but failed to send email' });
      }
    });
  });
});

// Start server
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
