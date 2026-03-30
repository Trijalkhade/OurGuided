# 🚀 SkillShare — Full Stack Learning Platform

SkillShare is a scalable, full-stack web application designed to enable peer-driven learning through content sharing, quizzes, and structured study tracking. It integrates social interaction with knowledge growth to create a collaborative learning ecosystem.

---

## 🌟 Overview

This project demonstrates a production-ready architecture using modern web technologies, including a RESTful backend, reactive frontend, and cloud-based deployment with reverse proxy and SSL support.

---

## 🧠 Key Features

* 🔐 JWT-based authentication and authorization
* 📰 Dynamic content feed with category filtering
* 📝 Post creation (text, media, anonymous option)
* 🧪 Quiz system with scoring and leaderboard
* 📊 Study session tracking and streak system
* 🤝 Social connections and networking
* 🔔 Notification system with user preferences
* ⭐ Expert role system with advanced privileges

---

## 🏗️ Tech Stack

| Layer           | Technology            |
| --------------- | --------------------- |
| Frontend        | React (Vite)          |
| Backend         | Node.js, Express      |
| Database        | MySQL                 |
| Web Server      | Nginx                 |
| Process Manager | PM2                   |
| Deployment      | Linux (Ubuntu)        |
| CDN & SSL       | Cloudflare (optional) |

---

# ⚙️ Local Development Setup

## 1. Clone Repository

```bash
git clone <repository-url>
cd OurGuided
```

---

## 2. Database Setup

Create a MySQL database and import schema:

```sql
CREATE DATABASE <your_database_name>;
USE <your_database_name>;
SOURCE backend/schema.sql;
```

---

## 3. Backend Setup

```bash
cd backend
cp .env.example .env
```

Update `.env` with your configuration:

```env
DB_HOST=localhost
DB_USER=<your_db_user>
DB_PASSWORD=<your_db_password>
DB_NAME=<your_database_name>
JWT_SECRET=<your_secret>
```

Install dependencies and run:

```bash
npm install
npm run dev
```

Backend runs on:

```
http://localhost:5000
```

---

## 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

# 🚀 Production Deployment Guide

---

## ☁️ 1. Server Setup (Linux / Ubuntu)

Update system and install dependencies:

```bash
sudo apt update
sudo apt install nginx nodejs npm -y
sudo npm install -g pm2
```

---

## ⚡ 2. Backend Deployment

```bash
cd backend
npm install
pm2 start server.js --name backend
pm2 save
```

---

## 🎨 3. Frontend Build

```bash
cd frontend
npm install
npm run build
```

This generates static files in:

```
frontend/dist
```

---

## 🔥 4. Nginx Configuration

Create or edit Nginx config:

```bash
sudo nano /etc/nginx/sites-available/default
```

### Example Configuration

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name <your_domain_or_ip>;

    root /path/to/project/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

## 🔁 Apply Configuration

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🌐 5. Domain Setup (Optional)

Using Cloudflare or any DNS provider:

```text
A     @      <your_server_public_ip>
CNAME www    <your_domain>
```

---

## 🔐 6. SSL Configuration

### Option A: Cloudflare SSL (Quick Setup)

* Enable proxy (CDN)
* Set SSL mode to:

```
Flexible
```

---

### Option B: Native SSL (Recommended)

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Generate SSL certificate:

```bash
sudo certbot --nginx -d <your_domain> -d www.<your_domain>
```

---

# 🧪 Testing

```bash
curl http://localhost
curl http://<your_public_ip>
```

Access via browser:

```
http://<your_domain_or_ip>
https://<your_domain>
```

---

# ⚠️ Troubleshooting

### Port Not Accessible

* Check firewall settings
* Ensure port 80/443 are open
* Verify cloud security rules

---

### Permission Issues

```bash
sudo chown -R www-data:www-data frontend/dist
```

---

### Backend Not Responding

* Check PM2 logs:

```bash
pm2 logs
```

---

### Nginx Errors

```bash
sudo tail -f /var/log/nginx/error.log
```

---

# 🧠 System Architecture

```
Client → Nginx (Reverse Proxy)
        ↓
Frontend (Static Files)
        ↓
Backend API (/api → Node.js)
        ↓
Database (MySQL)
```

---

# 📦 Project Structure

```
SkillShare/
├── frontend/
├── backend/
├── README.md
```

---

# 🎯 Final Notes

* Do not use development servers (`npm run dev`) in production
* Always serve frontend using Nginx
* Use a process manager (PM2) for backend reliability
* Configure SSL for secure communication

---
## 👨‍💻 Author

**Trijal Khade**
GitHub: https://github.com/Trijalkhade

SkillShare Platform
Designed with full-stack engineering and production deployment practices.
