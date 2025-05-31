const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors()); // Enable CORS
app.use(bodyParser.json());
app.use(express.static(__dirname));

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  const prompt = `
You are a helpful assistant for a job portal platform.
Use the following MySQL database structure to answer questions:

Tables:
- users(user_id, name, email, password, reset_code, createdAt, updatedAt)
- employers(employer_id, user_id, company_name, company_description, name, password, email, reset_code)
- jobs(job_id, employer_id, title, description, requirements, salary, location, skill_set_1, skill_set_2, skill_set_3, interview_type, company, interview_date)
- applications(application_id, job_id, user_id, name, education, experience, contact, skills, resume_path, status, cgpa, is_applied, reason, employer_id, company)

User's message: "${userMessage}"

Respond as a friendly assistant. Suggest actions, or describe what information is available.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
