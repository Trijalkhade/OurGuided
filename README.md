# SkillShare — Full Stack Learning Platform

A peer-driven daily micro-learning community where users share knowledge, take quizzes, track study sessions, and grow together.

---

## Quick Start

### 1. Database Setup
```sql
-- In MySQL:
CREATE DATABASE DBMS;
USE DBMS;
SOURCE backend/schema.sql;
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # fill in your DB credentials and JWT secret
npm install
npm run dev                   # runs on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                   # runs on http://localhost:5173
```

---

## Features

| Feature | Details |
|---------|---------|
| **Auth** | JWT-secured register/login/logout with 2-step onboarding |
| **Feed** | Category-filtered post feed with pagination |
| **Posts** | Text · Multiple images · Video (YouTube embed / direct URL) · Anonymous option |
| **Explore** | Category browser with interest selection & personalised recommendations |
| **Quizzes** | Expert-only creation · MCQ · Scoring feedback · Leaderboard |
| **Study Engine** | Session timer · Knowledge compounding · Streak tracking · Learning Core evolution |
| **Connections** | Send / accept / decline / remove connections |
| **Watchlist** | Save & revisit posts |
| **Notifications** | In-app inbox · Email / WhatsApp toggle settings · Privacy controls |
| **Expert System** | Earn 100+ knowledge pts → unlock quiz creation |
| **Profile** | Skills, certifications, education, photo upload |

---

## Default Skill Categories
Engineering · Business · Life Skills · Psychology · Teaching Skills · Health & Nutrition · Physical Fitness · Agriculture

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register (returns JWT) |
| POST | /api/auth/login    | Login (returns JWT) |
| GET  | /api/auth/me       | Validate token |

### Posts
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/posts/feed        | Paginated feed (query: page, category) |
| GET  | /api/posts/watchlist   | Saved posts |
| GET  | /api/posts/user/:id    | User's posts |
| GET  | /api/posts/pending     | Pending moderation (experts only) |
| POST | /api/posts             | Create post (multipart) |
| DELETE | /api/posts/:id       | Delete own post |
| POST | /api/posts/:id/like    | Like / unlike toggle |
| POST | /api/posts/:id/watchlist | Save / unsave toggle |
| POST | /api/posts/:id/comment | Add comment |
| POST | /api/posts/:id/approve | Approve pending post (expert) |
| DELETE | /api/posts/:id/reject | Reject pending post (expert) |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/users/search/:q    | Search users |
| GET  | /api/users/leaderboard  | Top learners by knowledge |
| GET  | /api/users/:id          | Full user profile |
| PUT  | /api/users/profile/update | Update bio/name/photo |
| POST | /api/users/skills       | Add skill |
| DELETE | /api/users/skills/:id | Remove skill |
| POST | /api/users/certifications | Add certification |
| POST | /api/users/education    | Add/update education |
| POST | /api/users/request-expert | Request expert status |

### Quizzes
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/quizzes            | List published quizzes |
| GET  | /api/quizzes/my         | My quizzes |
| GET  | /api/quizzes/:id        | Quiz detail with questions |
| POST | /api/quizzes            | Create quiz (experts only) |
| POST | /api/quizzes/:id/submit | Submit answers |
| GET  | /api/quizzes/:id/leaderboard | Quiz leaderboard |
| DELETE | /api/quizzes/:id      | Delete own quiz |

### Categories
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/categories              | All categories |
| GET  | /api/categories/interests    | My interests |
| POST | /api/categories/interests    | Set interests |
| GET  | /api/categories/recommended  | Recommended posts |

### Study Engine
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/study/start    | Start session |
| POST | /api/study/stop     | End session + calculate knowledge |
| GET  | /api/study/status   | Active session + streak stats |
| GET  | /api/study/history  | Last 30 days |
| GET  | /api/study/sessions | Last 20 sessions |

### Connections
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/connections/status/:userId   | Relationship status |
| GET  | /api/connections/my-connections   | My connections |
| GET  | /api/connections/requests         | Incoming requests |
| POST | /api/connections/request/:userId  | Send request |
| POST | /api/connections/accept/:id       | Accept request |
| DELETE | /api/connections/reject/:id     | Decline request |
| DELETE | /api/connections/remove/:userId | Remove connection |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET  | /api/notifications              | Inbox |
| GET  | /api/notifications/unread-count | Badge count |
| POST | /api/notifications/mark-read   | Mark all read |
| GET  | /api/notifications/settings    | Privacy + notification settings |
| PUT  | /api/notifications/settings    | Update settings |

---

## Expert System

1. Study using the **Study Engine** to earn Knowledge Points
2. At **100 points**, visit your Profile → "Request Expert Status"
3. Expert badge ⭐ is shown on your profile and search results
4. Experts can **create quizzes** and **moderate pending posts**

---

## Knowledge Compounding Formula

```
For each hour studied:
  knowledge += multiplier
  multiplier += multiplier × 0.005 × learning_core × 0.7

Every 30 streak-factor increments:
  learning_core += 0.05  (permanent speed boost)

Streak broken (gap > 1 day):
  streak_factor = floor(streak_factor / 10)
  multiplier -= 0.05 × learning_core
```
