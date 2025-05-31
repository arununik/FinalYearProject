const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const SibApiV3Sdk = require('sib-api-v3-sdk');

dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.static(__dirname));


// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Your MySQL username
  password: 'root', // Your MySQL password
  database: 'job_portal' // Your MySQL database name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ', err);
  } else {
    console.log('Connected to the database!');
  }
});


//multer

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../client/uploads')); // Save to 'client/uploads'
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });


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


// ✅ Submit Application Endpoint with Email
app.post('/api/applyJob1', upload.single('resume'), (req, res) => {
  const { user_id, job_id, name, education, experience, skills, cgpa, contact } = req.body;
  const resumePath = req.file ? `/uploads/${req.file.filename}` : '';

  const getEmployerQuery = `
    SELECT j.employer_id, j.company, u.email AS user_email, j.title
    FROM Jobs j
    JOIN Users u ON u.user_id = ?
    WHERE j.job_id = ?
  `;

  db.query(getEmployerQuery, [user_id, job_id], (err, employerResults) => {
    if (err) {
      console.error('Error fetching employer/user info:', err);
      return res.status(500).json({ message: 'Error retrieving information' });
    }

    if (employerResults.length === 0) {
      return res.status(404).json({ message: 'Job or User not found' });
    }

    const { employer_id, company, user_email, title } = employerResults[0];

    const insertQuery = `
      INSERT INTO Applications 
      (user_id, job_id, employer_id, company, name, education, experience, skills, cgpa, contact, resume_path) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertQuery, [user_id, job_id, employer_id, company, name, education, experience, skills, cgpa, contact, resumePath], async (err, results) => {
      if (err) {
        console.error('Error inserting application:', err);
        return res.status(500).json({ message: 'Error submitting application' });
      }

      // Send confirmation email
      const subject = 'Job Application Submitted Successfully';
      const content = `
Hi ${name},

✅ Your application for the position of **${title}** at **${company}** has been submitted successfully.

Our team will review your application and get back to you soon.

Thank you,  
Hiring Hub Team
      `;

      try {
        await sendEmail2(user_email, subject, content);
        res.status(200).json({ message: 'Application submitted and email sent successfully' });
      } catch (emailErr) {
        console.error('Error sending confirmation email:', emailErr);
        res.status(500).json({ message: 'Application saved but failed to send email' });
      }
    });
  });
});


app.post('/api/registerEmployer', (req, res) => {
    const { company_name, email, password } = req.body;

    // Check for missing fields
    if (!company_name || !email || !password) {
        return res.status(400).send({ message: 'All fields are required.' });
    }

    // Insert user into Users table
    const userSql = 'INSERT INTO Users (email, password, role) VALUES (?, ?, ?)';
    db.query(userSql, [email, password, 'employer'], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // Handle duplicate email error
                return res.status(400).send({ message: 'Email already exists. Please use a different email.' });
            } else {
                // Log the error and return a generic error message
                console.error('Error registering user: ', err);
                return res.status(500).send({ message: 'Error registering user. Please try again later.' });
            }
        }

        const userId = result.insertId;

        // Insert employer into Employers table
        const employerSql = 'INSERT INTO Employers (user_id, company_name) VALUES (?, ?)';
        db.query(employerSql, [userId, company_name], (err) => {
            if (err) {
                console.error('Error registering employer: ', err);  // Log the error
                return res.status(500).send({ message: `Error registering employer: ${err.message}` });
            }

            res.status(200).send({ message: 'Employer registered successfully.' });
        });
    });
});

// Employer Login Route
app.post('/api/loginEmployer', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).send({ message: 'Email and password are required.' });
        return;
    }

    const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send({ message: 'Error logging in. Please try again later.' });
        } else if (results.length === 0) {
            res.status(404).send({ message: 'Account not found. Please sign up.' });
        } else {
            res.status(200).send({ message: 'Login successful.', email: results[0].email });
        }
    });
});



  
  // Route to handle job posting
  app.post('/api/postJob', (req, res) => {
    const {company, title, description, location, skills, salary, date,type} = req.body;
    const employerId = 1; // Assuming an employer ID for testing purposes
  
    const query = `
      INSERT INTO Jobs (employer_id, company,title, description, location, skill_set_1, salary,interview_date,interview_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const jobData = [employerId, company, title, description, location, skills, salary, date, type];
  
    db.query(query, jobData, (err, results) => {
      if (err) throw err;
      res.send('<h1>Successfully Posted Job!</h1><a href="/">Go back to home page</a>');
    });
  });
  

    
  // Route to handle job posting
  app.post('/api/postJob1', (req, res) => {
    const {employer_id,company, title, description, location, skills, salary, date,type} = req.body;

  
    const query = `
      INSERT INTO Jobs (employer_id, company,title, description, location, skill_set_1, salary,interview_date,interview_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const jobData = [employer_id, company, title, description, location, skills, salary, date, type];
  
    db.query(query, jobData, (err, results) => {
      if (err) throw err;
      res.send('<h1>Successfully Posted Job!</h1><a href="/">Go back to home page</a>');
    });
  });


  // API to fetch jobs
app.get('/jobs', (req, res) => {
    const query = 'SELECT * FROM Jobs';
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ error: 'Database query error' });
        return;
      }
      res.json(results);
    });
  });


  app.get('/api/jobs', (req, res) => {
    const { title, company } = req.query;
    let query = 'SELECT * FROM Jobs';
    const params = [];
  
    if (title || company) {
      query += ' WHERE';
      if (title) {
        query += ' title LIKE ?';
        params.push(`%${title}%`);
      }
      if (title && company) query += ' AND';
      if (company) {
        query += ' company LIKE ?';
        params.push(`%${company}%`);
      }
    }
  
    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
      res.json(results);
    });
  });

  app.get('/api/jobs3', (req, res) => {
    const { title, company } = req.query;
    let query = 'SELECT * FROM Jobs';
    const params = [];
  
    if (title || company) {
      query += ' WHERE';
      if (title) {
        query += ' title LIKE ?';
        params.push(`%${title}%`);
      }
      if (title && company) query += ' AND';
      if (company) {
        query += ' company LIKE ?';
        params.push(`%${company}%`);
      }
    }
  
    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
      res.json(results);
    });
  });
  
  app.get('/jobss', (req, res) => {
    const employerId = req.query.employer_id;
  
    if (!employerId) {
      return res.status(400).json({ error: 'employer_id is required' });
    }
  
    const query = 'SELECT * FROM Jobs WHERE employer_id = ?';
    db.query(query, [employerId], (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Database query error' });
      }
      res.json(results);
    });
  });
  

  // Get a single job by ID
app.get('/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    const query = 'SELECT * FROM Jobs WHERE job_id = ?';
  
    db.query(query, [jobId], (err, results) => {
      if (err) {
        console.error('Error fetching job:', err);
        res.status(500).send('Error fetching job');
        return;
      }
      if (results.length === 0) {
        res.status(404).send('Job not found');
        return;
      }
      res.json(results[0]);
    });
  });
  
  // Delete a job by ID
  app.delete('/jobs/:jobId', (req, res) => {
    const jobId = req.params.jobId;
  
    const deleteApplications = 'DELETE FROM applications WHERE job_id = ?';
    const deleteJob = 'DELETE FROM jobs WHERE job_id = ?';
  
    db.query(deleteApplications, [jobId], (err) => {
      if (err) {
        console.error('Error deleting applications:', err);
        return res.status(500).send('Error deleting related applications.');
      }
  
      db.query(deleteJob, [jobId], (err, result) => {
        if (err) {
          console.error('Error deleting job:', err);
          return res.status(500).send('Error deleting job.');
        }
  
        if (result.affectedRows === 0) {
          return res.status(404).send('Job not found.');
        }
  
        res.send('Job and related applications deleted successfully.');
      });
    });
  });
  
  
  // Update a job by ID
  app.put('/jobs/:id', (req, res) => {
    const jobId = req.params.id;
    const { title, description, location, skills, salary } = req.body;
  
    const query = `
      UPDATE Jobs
      SET title = ?, description = ?, location = ?, skill_set_1 = ?, salary = ?
      WHERE job_id = ?
    `;
  
    db.query(query, [title, description, location, skills, salary, jobId], (err, result) => {
      if (err) {
        console.error('Error updating job:', err);
        res.status(500).send('Error updating job');
        return;
      }
  
      if (result.affectedRows === 0) {
        res.status(404).send('Job not found');
        return;
      }
  
      res.send('Job updated successfully');
    });
  });



  // Admin login
app.post('/api/loginAdmin', (req, res) => {
    const { email, password } = req.body;
  
    // Hardcoded admin credentials
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin';
  
    // Check credentials
    if (email === adminEmail && password === adminPassword) {
      return res.json({ message: 'Login successful', redirectUrl: 'C:/Users/arunn/OneDrive/Desktop/capstone/new/cap3/client/dashboard1.html' });
    }
  
    // Invalid credentials
    res.status(401).json({ message: 'Invalid email or password' });
  });


  app.get('/api/users', (req, res) => {
    const sql = 'SELECT user_id, name, email, role FROM Users';
    db.query(sql, (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
  
  // Delete a user
  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM Users WHERE user_id = ?';
    db.query(sql, [id], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'User deleted successfully' });
    });
  });
  
  // Get all jobs
  app.get('/api/jobs', (req, res) => {
    const sql = `
      SELECT Jobs.job_id, Jobs.title, Jobs.company, Jobs.location, 'Active' AS status 
      FROM Jobs 
      JOIN Employers ON Jobs.employer_id = Employers.employer_id`;
    db.query(sql, (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
  app.get('/api/jobs1', (req, res) => {
    const { title, company } = req.query;
  
    let query = 'SELECT job_id, title, company, location FROM Jobs';
    const conditions = [];
    const values = [];
  
    if (title) {
      conditions.push('title = ?');
      values.push(title);
    }
  
    if (company) {
      conditions.push('company = ?');
      values.push(company);
    }
  
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
  
    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      res.json(results);
    });
  });
  

  app.get('/api/jobs11', (req, res) => {
    const { company } = req.query;
  
    if (!company) {
      return res.status(400).json({ error: 'Job title is required' });
    }
  
    const query = 'SELECT job_id, title, company, location FROM Jobs WHERE company = ?';
    db.query(query, [company], (err, results) => {
      if (err) {
        console.error('Error fetching jobs:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      res.json(results);
    });
  });


  // Delete a job
  app.delete('/api/jobs/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM Jobs WHERE job_id = ?';
    db.query(sql, [id], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Job deleted successfully' });
    });
  });
  
  // Get all employers
  app.get('/api/employers', (req, res) => {
    const sql = `
      SELECT Employers.employer_id, Employers.company_name, Users.email, 'Pending' AS status 
      FROM Employers 
      JOIN Users ON Employers.user_id = Users.user_id`;
    db.query(sql, (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  });
  
  // Approve an employer
  app.post('/api/employers/approve/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE Employers SET status = "Approved" WHERE employer_id = ?';
    db.query(sql, [id], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Employer approved successfully' });
    });
  });
  
  // Reject an employer
  app.post('/api/employers/reject/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE Employers SET status = "Rejected" WHERE employer_id = ?';
    db.query(sql, [id], (err) => {
      if (err) return res.status(500).send(err);
      res.json({ message: 'Employer rejected successfully' });
    });
  });
  

// Assuming you're using MySQL and the `db` object is set up properly
app.get('/api/jobDetails/:jobId', async (req, res) => {
    const { jobId } = req.params;
  
    try {
      // Correct SQL query
      const query = `
        SELECT jobs.job_id, jobs.title, jobs.description, jobs.salary, jobs.location,
               jobs.skill_set_1, jobs.skill_set_2, jobs.skill_set_3,
               jobs.company
        FROM jobs
        INNER JOIN employers ON jobs.employer_id = employers.employer_id
        WHERE jobs.job_id = ?`;
  
      // Using .query() instead of .execute()
      db.query(query, [jobId], (err, rows) => {
        if (err) {
          console.error('Error executing query:', err);
          return res.status(500).json({ message: 'Internal Server Error' });
        }
  
        // If no job found, return 404
        if (rows.length === 0) {
          return res.status(404).json({ message: 'Job not found' });
        }
  
        // Send the job details as a response
        res.json(rows[0]);
      });
    } catch (error) {
      console.error('Error fetching job details:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  
  app.post('/api/applyJob', (req, res) => {
    const { user_id, job_id, name, education, experience, skills, cgpa } = req.body;
  
    if (!user_id || !job_id || !name || !education || !experience || !skills || !cgpa) {
      return res.status(400).send({ message: 'All fields are required.' });
    }
  
    // Prepare the SQL query
    const query = `
      INSERT INTO Applications (user_id, job_id, name, education, experience, skills, cgpa)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
  
    const applicationData = [user_id, job_id, name, education, experience, skills, cgpa];
  
    db.query(query, applicationData, (err, results) => {
      if (err) {
        console.error('Error inserting application:', err);
        return res.status(500).send({ message: 'Error submitting application. Please try again.' });
      }
      res.status(200).send({ message: 'Application submitted successfully!' });
    });
  });


  app.get('/api/checkApplicationStatus', (req, res) => {
    const { user_id, job_id } = req.query;
  
    // Validate the input
    if (!user_id || !job_id) {
      return res.status(400).json({ message: "user_id and job_id are required" });
    }
  
    // Query to check if the user has applied for the specific job
    const query = 'SELECT is_applied FROM Applications WHERE user_id = ? AND job_id = ?';
    db.query(query, [user_id, job_id], (err, result) => {
      if (err) {
        console.error('Error querying the database:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If a record is found and `is_applied` is TRUE, respond with true
      if (result.length > 0 && result[0].is_applied === 1) {
        return res.json({ hasApplied: true });
      }
  
      // If no record or `is_applied` is FALSE, respond with false
      return res.json({ hasApplied: false });
    });
  });


  app.get('/api/va', (req, res) => {
    const { user_id } = req.query;
  
    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }
  
    // Query to fetch applications for the user
    const query = `
      SELECT applications.name, jobs.company, applications.cgpa, applications.status
      FROM Applications
      INNER JOIN jobs ON jobs.job_id = applications.job_id
      WHERE applications.user_id = ?`; // Ensure you use user_id here
  
    db.query(query, [user_id], (err, result) => {
      if (err) {
        console.error('Error querying the database:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If no results, send an empty array
      res.json(result || []);
    });
  });
  



  
  // Fetch applications based on user_id
app.get('/api/getApplicationsByUser', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const query = 'SELECT * FROM Applications WHERE user_id = ?';
    const [applications] = await db.execute(query, [user_id]);
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit an application
app.put('/api/editApplication', async (req, res) => {
  const { application_id, name, education, experience, skills } = req.body;

  if (!application_id) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  try {
    const query = `
      UPDATE Applications
      SET name = ?, education = ?, experience = ?, skills = ?
      WHERE application_id = ?
    `;
    await db.execute(query, [name, education, experience, skills, application_id]);
    res.json({ message: 'Application updated successfully' });
  } catch (error) {
    console.error('Error editing application:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an application
app.delete('/api/deleteApplication', async (req, res) => {
  const { application_id } = req.body;

  if (!application_id) {
    return res.status(400).json({ error: 'Application ID is required' });
  }

  try {
    const query = 'DELETE FROM Applications WHERE application_id = ?';
    await db.execute(query, [application_id]);
    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change application status
app.put('/api/updateApplication', async (req, res) => {
  const { application_id, status } = req.body;

  if (!application_id || !status) {
    return res.status(400).json({ error: 'Application ID and Status are required' });
  }

  // Validate status
  const validStatuses = ['pending', 'accepted', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const query = 'UPDATE Applications SET status = ? WHERE application_id = ?';
    await db.execute(query, [status, application_id]);
    res.json({ message: 'Application status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});







// Get application details by ID
// Get all applications for a job
// Get all applications without job details
app.get('/api/applications', (req, res) => {
  const { name, cgpa, company} = req.query;

  let sql = 'SELECT * FROM Applications';
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
  if (company){
    conditions.push('company LIKE ?');
    values.push(`%${company}%`);
  }
 

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});


app.get('/api/applications1', (req, res) => {
  const { name, cgpa, company, employer_id } = req.query;

  let sql = 'SELECT * FROM Applications';
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
  if (company){
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



// Update application status (approve/reject)
app.put('/api/applications/:application_id', (req, res) => {
  const { application_id } = req.params;
  const { status } = req.body;  // Get the status (approved/rejected) from the request body
  
  const sql = 'UPDATE Applications SET status = ? WHERE application_id = ?';
  db.query(sql, [status, application_id], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json({ message: 'Application status updated' });
  });
});


app.post('/api/processPayment/:userId', (req, res) => {
  const userId = req.params.userId;
  const { plan } = req.body;  // Ensure this is not null

  if (!plan) {
      return res.status(400).json({ message: 'Plan is required' });
  }

  // Insert payment record into the database
  const query = `
    INSERT INTO subscriptions (user_id, plan_name)
    VALUES (?, ?)
  `;
  db.query(query, [userId, plan], (err, results) => {
      if (err) {
          console.error('Error processing payment:', err);
          return res.status(500).json({ message: 'Payment processing failed. Please try again later.' });
      }
      res.status(200).json({ message: 'Payment successful' });
  });
});




// Assuming you're using MySQL and the `db` object is set up properly
app.get('/api/appDetails/:appId', (req, res) => {
  const { appId } = req.params;
  const query = `
    SELECT application_id, name, education, experience, skills, cgpa, contact, resume_path
    FROM applications WHERE application_id = ?
  `;
  db.query(query, [appId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Internal Server Error' });
    if (rows.length === 0) return res.status(404).json({ message: 'Application not found' });
    res.json(rows[0]);
  });
});


function isAdmin(req, res, next) {
  // For now, allow all requests to simulate admin access
  next();
}
//admin
// 🟡 Get unapproved employers
app.get('/api/admin/employers', isAdmin, (req, res) => {
  const sql = `
    SELECT employer_id, name, email, approval_status
    FROM employers
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.post('/api/admin/approve-employer/:id', isAdmin, (req, res) => {
  const employerId = req.params.id;
  const sql = `UPDATE employers SET approval_status = 'approved' WHERE employer_id = ?`;
  db.query(sql, [employerId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Employer approved.' });
  });
});

app.post('/api/admin/reject-employer/:id', isAdmin, (req, res) => {
  const employerId = req.params.id;
  const sql = `UPDATE employers SET approval_status = 'rejected' WHERE employer_id = ?`;
  db.query(sql, [employerId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Employer rejected.' });
  });
});


// Start the server

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
