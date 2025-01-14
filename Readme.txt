-- Create the database
CREATE DATABASE JobPortal;

-- Use the database
USE JobPortal;

-- Create the Users table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    contact VARCHAR(15),
    education TEXT,
    experience_years INT DEFAULT 0,
    skill_set TEXT,
    cgpa DECIMAL(3, 2),
    subscription_pack ENUM('Basic', 'Premium', 'Enterprise') DEFAULT 'Basic'
);

-- Create the Employers table
CREATE TABLE Employers (
    employer_id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    company_profile TEXT,
    subscription_pack ENUM('Basic', 'Premium', 'Enterprise') DEFAULT 'Basic'
);

-- Create the Job Listings table
CREATE TABLE JobListings (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    employer_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    requirements TEXT,
    salary DECIMAL(10, 2),
    location VARCHAR(100) NOT NULL,
    skill_set TEXT,
    interview_date DATETIME,
    interview_type ENUM('Offline', 'Online') DEFAULT 'Offline',
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employer_id) REFERENCES Employers(employer_id) ON DELETE CASCADE
);

-- Create the Job Applications table
CREATE TABLE JobApplications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('Pending', 'Selected', 'Rejected') DEFAULT 'Pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES JobListings(job_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Create the Subscription Packs table
CREATE TABLE SubscriptionPacks (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    features TEXT
);

-- Add some indexes for better performance
CREATE INDEX idx_job_title ON JobListings(title);
CREATE INDEX idx_job_location ON JobListings(location);
CREATE INDEX idx_job_skill_set ON JobListings(skill_set);
CREATE INDEX idx_application_status ON JobApplications(status);





run the following in terminal 

npm init -y
npm install express body-parser cors
npm install mysq12

node server.js (in new terminal)
node server1.js (in another new terminal )


