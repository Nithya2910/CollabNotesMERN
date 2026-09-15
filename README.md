# 📝 CollabNotes

A full-stack collaborative notes application built using the **MERN stack**.  
CollabNotes allows users to securely create, manage, organize, upload, and share notes with other users in real time.

## 🚀 Features

- 🔐 User Registration & Login
- 📧 Email OTP verification during registration
- 🔑 JWT-based authentication
- 📝 Create, edit, and delete notes
- 🗂️ Create and manage folders
- 👥 Share notes using email or username
- 🤝 Real-time collaborative note editing
- 🖱️ Real-time cursor collaboration
- 📎 Upload files and images
- 🔍 Search and manage notes
- 🗑️ Soft delete support
- 📱 Responsive user interface
- 🔒 Secure environment variable configuration

## 🛠️ Tech Stack

### Frontend

- React.js
- Vite
- JavaScript
- HTML5
- CSS3

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Nodemailer
- Socket.IO
- Multer

## 🏗️ Project Architecture

```text
                    ┌──────────────────┐
                    │   React Frontend │
                    │     (Vite)       │
                    └────────┬─────────┘
                             │
                    REST API / Socket.IO
                             │
                             ▼
                    ┌──────────────────┐
                    │  Node.js Backend │
                    │    Express.js    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     MongoDB      │
                    └──────────────────┘
