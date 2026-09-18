# ISKOLARMATCH

## Scholarship Matching System for Filipino Students

ISKOLARMATCH is a centralized web-based scholarship discovery and matching platform designed to help Filipino students discover scholarship opportunities that align with their academic, financial, geographic, and eligibility profiles.

The system aims to reduce the difficulty of manually searching through scattered scholarship information by providing a centralized scholarship directory and an automated criteria-based matching approach.

---

# Project Overview

ISKOLARMATCH is a student-centered scholarship discovery platform intended to make scholarship opportunities easier to find and evaluate.

Instead of requiring students to search across multiple websites, social media pages, school announcements, and institutional boards, the system provides a centralized platform where scholarship information can be organized and matched against a student's profile.

The system is designed around three primary user roles:

- Student
- Scholarship Provider
- Administrator

The platform uses a criteria-based matching approach to determine scholarship compatibility based on structured student and scholarship information.

---

# Problem Context

Higher education plays an important role in improving social mobility in the Philippines. However, financial limitations continue to prevent or discourage many students from pursuing educational opportunities.

Scholarship information is often distributed across different sources such as:

- Government websites
- School websites
- Social media pages
- Scholarship organization websites
- School bulletin boards
- Community announcements

This fragmentation can result in:

- Difficulty discovering relevant scholarships
- Time-consuming manual searches
- Missed application deadlines
- Difficulty determining eligibility
- Repeatedly checking different information sources

ISKOLARMATCH addresses this problem by providing a centralized scholarship discovery platform with profile-based matching.

---

# Project Objectives

## General Objective

To design and develop a centralized web-based scholarship discovery and matching platform that helps Filipino students identify scholarship opportunities based on their academic, financial, geographic, and eligibility characteristics.

## Specific Objectives

The system aims to:

1. Centralize scholarship information in a single platform.
2. Allow students to create academic, financial, and geographic profiles.
3. Provide scholarship search and discovery functionality.
4. Rank scholarship opportunities according to student eligibility and compatibility.
5. Provide scholarship providers with tools for managing scholarship listings.
6. Provide administrators with tools for provider verification and content moderation.
7. Support secure user authentication using JSON Web Tokens (JWT).
8. Provide safeguards for student accounts requiring guardian consent.
9. Reduce the time and effort required to manually identify scholarship opportunities.
10. Provide transparent and explainable scholarship matching results.

---

# Key Features

## Student Features

Students can:

- Create an account
- Log in securely
- Build an academic and personal profile
- Provide GPA/GWA information
- Provide household income information
- Provide geographic information
- Specify academic level and course/program
- Search scholarship opportunities
- View scholarship details
- View recommended scholarships
- Save/bookmark scholarships
- Track scholarship-related activities
- View scholarship deadlines
- Access external scholarship application links
- Manage account settings

---

## Scholarship Provider Features

Scholarship providers can:

- Create a provider account
- Provide organization information
- Manage scholarship listings
- Create scholarship opportunities
- Edit scholarship information
- Configure scholarship eligibility criteria
- Specify scholarship deadlines
- Provide official application URLs
- Configure matching criteria
- Monitor scholarship listing information

Provider accounts may require administrator verification before their scholarship listings are treated as verified platform content.

---

## Administrator Features

Administrators can:

- Review provider accounts
- Approve or reject provider verification requests
- Moderate scholarship listings
- Manage scholarship-related content
- Manage system users
- Review audit information
- Manage system-level settings
- Manage scholarship taxonomy and tags
- Monitor platform activity

---

# System Users

The system supports the following roles:

| Role | Description |
|------|-------------|
| Student | Searches for and receives scholarship recommendations |
| Provider | Creates and manages scholarship opportunities |
| Admin | Verifies providers and manages platform content |

---

# Scholarship Matching Approach

ISKOLARMATCH uses a criteria-based matching approach.

The proposed matching engine follows a two-stage process.

## Stage 1: Hard Eligibility Filters

The first stage determines whether a student is eligible for a scholarship.

Hard eligibility criteria may include:

- Academic level
- Course or program
- Geographic location
- Citizenship
- Exclusive eligibility tags
- Minimum academic requirements
- Maximum income requirements

If a student fails a required hard eligibility criterion, the scholarship is considered ineligible.

Conceptually:

```text
Student Profile
      |
      v
Hard Eligibility Filters
      |
      +---- Failed ----> Score = 0
      |
      +---- Passed ----> Stage 2


---

# Installation and Setup

## 1. Clone the Repository

Clone the project repository:

```bash
git clone <REPOSITORY_URL>
```

Navigate to the project:

```bash
cd capstoneTwo
```

---

# Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the frontend directory if required.

Example:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# Backend Setup

Open another terminal.

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the backend directory.

Example:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRE=30d
NODE_ENV=development
```

Do not commit the `.env` file to GitHub.

---

# Database Setup

ISKOLARMATCH uses MongoDB Atlas.

Create a MongoDB Atlas cluster and database user.

After creating the database, place the MongoDB connection string in the backend `.env` file.

Example:

```env
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/iskolarmatch
```

Replace the placeholder values with your own MongoDB Atlas configuration.

---

# Running the Application

The frontend and backend should be run in separate terminals.

## Terminal 1 — Backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

---

## Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend normally runs on:

```text
http://localhost:5173
```

Open the frontend in a browser:

```text
http://localhost:5173
```

---

# Contributors

## Capstone Two Team

ISKOLARMATCH is developed as part of a Capstone Two Software Development project.

### Team Members

- Gilianne Rose Baguio
- Shirly Rose Montes
- Shaira Nicole Mirasol
- Alvin Kent Bigbig
- Kevin Bruguier

---

# Academic Context

**Project:** Capstone Two  
**Project Type:** Software Development  
**System:** ISKOLARMATCH — Scholarship Matching System for Filipino Students

The project is developed for academic purposes and focuses on improving scholarship discovery and accessibility through centralized information management and criteria-based matching.

---

# License

This project was developed for academic and educational purposes as part of a Capstone Two project.

---

# Acknowledgment

The development of ISKOLARMATCH is guided by the goal of improving access to scholarship information for Filipino students through centralized scholarship information, structured eligibility criteria, secure authentication, and explainable scholarship matching.
