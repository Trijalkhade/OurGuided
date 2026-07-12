USE DBMS;

-- ══════════════════════════════════════════════════════════════════════════════
-- OurGuided — Production Schema (Hardened)
-- Last Updated: 2026-06-22
-- Threat Model: 100 concurrent malicious users attacking every component
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id   INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL DEFAULT (UUID()),
    username  VARCHAR(100) UNIQUE NOT NULL,
    email     VARCHAR(255) UNIQUE NOT NULL,
    password  CHAR(60) NOT NULL,
    role      ENUM('user','moderator','admin') NOT NULL DEFAULT 'user',
    registration_ip VARCHAR(45),
    registration_device_id VARCHAR(255),
    join_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_public_id (public_id),
    INDEX idx_users_role (role)
);

CREATE TABLE IF NOT EXISTS user_profile (
    user_id         INT PRIMARY KEY,
    dob             DATE NOT NULL,
    CHECK (dob >= '1920-01-01'),
    bio             TEXT,
    knowledge_today DECIMAL(7,3)  DEFAULT 0,
    total_knowledge DECIMAL(10,4) DEFAULT 0,
    core_level      DECIMAL(5,3)  DEFAULT 0,
    is_expert       BOOLEAN       DEFAULT FALSE,
    is_private      BOOLEAN       DEFAULT FALSE,
    notify_email    BOOLEAN       DEFAULT TRUE,
    notify_whatsapp BOOLEAN       DEFAULT FALSE,
    notify_new_skills BOOLEAN     DEFAULT TRUE,
    notify_quizzes  BOOLEAN       DEFAULT TRUE,
    notify_streaks  BOOLEAN       DEFAULT TRUE,
    whatsapp_number VARCHAR(20) DEFAULT NULL,
    updated_at      TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS user_info (
    user_id     INT PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name   VARCHAR(50) NOT NULL,
    photo_url   TEXT DEFAULT NULL,              -- S3 URL (replaces BLOB for new uploads)
    updated_at  TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS user_phone (
    phone_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id  INT NOT NULL,
    phone_no VARCHAR(15) NOT NULL,
    about    VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES user_info(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (user_id, phone_no)
);
CREATE INDEX idx_user_phone_user ON user_phone(user_id);

-- ── Skills ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
    skill_id   INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_skills (
    user_id  INT NOT NULL,
    skill_id INT NOT NULL,
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id)  REFERENCES user_profile(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id)      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_user_skills_user  ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);

-- ── Interests / Categories ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(50) UNIQUE NOT NULL,
    icon          VARCHAR(10) DEFAULT '📚',
    description   VARCHAR(200)
);

-- Note: Manually update existing category rows in DB or re-seed for this to take effect in production
INSERT IGNORE INTO categories (name, icon, description) VALUES
('Real Talk',           '💬', 'Opinions, criticism, uncomfortable truths — said plainly'),
('Experiments & Ideas', '🧪', 'Unproven theories, personal experiments, what-if thinking'),
('Loopholes & Fixes',   '🔧', 'Spot what is broken in the system and propose real fixes'),
('Life Hacks',          '⚡', 'Practical skills that actually help you survive and thrive'),
('Youth & Education',   '🎒', 'What school should teach but never does'),
('Health & Body',       '🥗', 'Nutrition, fitness, and mental wellness — no pseudo-science'),
('Earth & Hands',       '🌱', 'Farming, sustainability, building things, making things'),
('Economy & Power',     '💡', 'Money, politics, corporations — who holds power and why');

CREATE TABLE IF NOT EXISTS user_interests (
    user_id     INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (user_id, category_id),
    FOREIGN KEY (user_id)     REFERENCES users(user_id)     ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Education ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_type (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('SSC','HSC','Diploma','University','Virtual') UNIQUE NOT NULL
);

INSERT IGNORE INTO education_type (type) VALUES
('SSC'), ('HSC'), ('Diploma'), ('University'), ('Virtual');

CREATE TABLE IF NOT EXISTS user_education (
    user_id     INT NOT NULL,
    type_id     INT NOT NULL,
    institution VARCHAR(100) NOT NULL,
    score       DECIMAL(5,3) NOT NULL,
    PRIMARY KEY (user_id, type_id),
    FOREIGN KEY (user_id)  REFERENCES user_profile(user_id)     ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (type_id)  REFERENCES education_type(type_id)   ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS certifications (
    certification_id   INT AUTO_INCREMENT PRIMARY KEY,
    certification_name VARCHAR(100) UNIQUE NOT NULL,
    issued_by          VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS user_certifications (
    user_id          INT NOT NULL,
    certification_id INT NOT NULL,
    certified_level  INT CHECK (certified_level BETWEEN 1 AND 10),
    certificate_url  TEXT,
    issued_date      DATE,
    expiry_date      DATE,
    PRIMARY KEY (user_id, certification_id),
    FOREIGN KEY (user_id)          REFERENCES user_profile(user_id)       ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (certification_id) REFERENCES certifications(certification_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_user_certifications_user ON user_certifications(user_id);
CREATE INDEX idx_user_certifications_cert ON user_certifications(certification_id);

-- ── Posts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    post_id    INT AUTO_INCREMENT PRIMARY KEY,
    public_id  CHAR(36) NOT NULL DEFAULT (UUID()),
    user_id    INT NOT NULL,
    text       VARCHAR(5000),
    video_url  TEXT,
    image_url  TEXT DEFAULT NULL,               -- S3 URL for main image (full-size WebP)
    thumbnail_url TEXT DEFAULT NULL,            -- S3 URL for feed thumbnail (480px WebP)
    media_type ENUM('image','video','none') DEFAULT 'none',
    category   VARCHAR(50),
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_pending   BOOLEAN DEFAULT FALSE,
    is_deleted   BOOLEAN DEFAULT FALSE,
    deleted_at   TIMESTAMP NULL,
    post_date  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    like_count   INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    CONSTRAINT fk_posts_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE INDEX idx_posts_public_id (public_id)
);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_date ON posts(post_date DESC);
CREATE INDEX idx_posts_feed ON posts(is_deleted, is_pending, post_date DESC);

CREATE TABLE IF NOT EXISTS post_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id  INT NOT NULL,
    image_url TEXT,
    thumbnail_url TEXT DEFAULT NULL,            -- 480px WebP thumbnail
    sort_order INT DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_post_images_post ON post_images(post_id);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INT NOT NULL,
    tag     VARCHAR(50) NOT NULL,
    PRIMARY KEY (post_id, tag),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_post_tags_tag ON post_tags(tag);

CREATE TABLE IF NOT EXISTS comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    post_id    INT NOT NULL,
    content    TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    dated      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_user ON comments(user_id);

CREATE TABLE IF NOT EXISTS likes (
    user_id   INT NOT NULL,
    post_id   INT NOT NULL,
    like_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_likes_post ON likes(post_id);

-- ── Watchlist / Watch History ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_watch (
    user_id    INT NOT NULL,
    post_id    INT NOT NULL,
    liked      BOOLEAN   DEFAULT FALSE,
    watch_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_user_watch_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_watch_post FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_user_watch_post ON user_watch(post_id);

-- ── Follows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
    follower_id  INT NOT NULL,
    following_id INT NOT NULL,
    follow_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT fk_follows_users    FOREIGN KEY (follower_id)  REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_followedby_users FOREIGN KEY (following_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_following ON follows(following_id);
CREATE INDEX idx_follower  ON follows(follower_id);

-- ── Quizzes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id     INT AUTO_INCREMENT PRIMARY KEY,
    creator_id  INT NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(50),
    difficulty  ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
    is_published BOOLEAN DEFAULT FALSE,
    is_deleted  BOOLEAN DEFAULT FALSE,
    deleted_at  TIMESTAMP NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_quizzes_creator  ON quizzes(creator_id);
CREATE INDEX idx_quizzes_category ON quizzes(category);

CREATE TABLE IF NOT EXISTS quiz_questions (
    question_id  INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id      INT NOT NULL,
    question_text TEXT NOT NULL,
    points       INT DEFAULT 1,
    sort_order   INT DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_options (
    option_id    INT AUTO_INCREMENT PRIMARY KEY,
    question_id  INT NOT NULL,
    option_text  TEXT NOT NULL,
    is_correct   BOOLEAN DEFAULT FALSE,
    sort_order   INT DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(question_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_quiz_options_question ON quiz_options(question_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    quiz_id      INT NOT NULL,
    score        INT DEFAULT 0,
    total_points INT DEFAULT 0,
    percentage   DECIMAL(5,2) DEFAULT 0,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (quiz_id)  REFERENCES quizzes(quiz_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
    attempt_id  INT NOT NULL,
    question_id INT NOT NULL,
    option_id   INT,
    is_correct  BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (attempt_id, question_id),
    FOREIGN KEY (attempt_id)  REFERENCES quiz_attempts(attempt_id)     ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(question_id)   ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Study Reinforcement Engine ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
    session_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    start_time      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time        DATETIME,
    hours_studied   DECIMAL(6,4) GENERATED ALWAYS AS (
        CASE WHEN end_time IS NOT NULL
             THEN TIMESTAMPDIFF(SECOND, start_time, end_time) / 3600.0
             ELSE NULL END
    ) STORED,
    knowledge_gained DECIMAL(10,4),
    session_date    DATE NOT NULL DEFAULT (CURRENT_DATE),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_date ON study_sessions(user_id, session_date);

CREATE TABLE IF NOT EXISTS study_streak (
    user_id         INT PRIMARY KEY,
    multiplier      DECIMAL(10,4) DEFAULT 1.0,
    learning_core   DECIMAL(10,4) DEFAULT 1.0,
    streak_days     INT           DEFAULT 0,
    streak_factor   INT           DEFAULT 0,
    total_knowledge DECIMAL(14,4) DEFAULT 0.0,
    last_study_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Notifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    type            ENUM('new_skill','quiz','streak','connection','system','moderation') NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read, created_at DESC);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  playlist_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  title        VARCHAR(100) NOT NULL,
  description  TEXT,
  is_public    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_playlists_user ON playlists(user_id);
 
CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id  INT NOT NULL,
  post_id      INT NOT NULL,
  sort_order   INT DEFAULT 0,
  added_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, post_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (post_id)     REFERENCES posts(post_id)         ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Moderation System ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_queue (
  queue_id INT AUTO_INCREMENT PRIMARY KEY,
  content_type ENUM('post', 'comment', 'quiz') NOT NULL,
  content_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  status ENUM('pending', 'processing', 'deleted', 'moderated') DEFAULT 'pending',
  detection_confidence DECIMAL(3,2),
  detection_details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_content_type (content_type),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS moderation_reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  queue_id INT NOT NULL,
  moderator_id INT,
  decision ENUM('approve', 'reject', 'escalate') NOT NULL,
  notes TEXT,
  reviewed_at TIMESTAMP NULL,
  UNIQUE(queue_id),
  FOREIGN KEY (queue_id) REFERENCES moderation_queue(queue_id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_reviewed_at (reviewed_at)
);

CREATE TABLE IF NOT EXISTS content_deletions (
  deletion_id INT AUTO_INCREMENT PRIMARY KEY,
  content_type ENUM('post', 'comment', 'quiz') NOT NULL,
  content_id INT NOT NULL,
  user_id INT NOT NULL,
  reason TEXT,
  confidence DECIMAL(3,2),
  detection_details JSON,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_deleted_at (deleted_at)
);

-- ── Password Resets ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  pin_hash CHAR(60) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_reset_lookup (user_id, used, expires_at)
);
CREATE INDEX idx_password_resets ON password_resets(user_id, used, expires_at);

-- ── Engagement Tracking ──────────────────────────────────────────────────

-- 1. Watch Time: seconds user's viewport contained this post
CREATE TABLE IF NOT EXISTS post_watch_time (
    user_id    INT NOT NULL,
    post_id    INT NOT NULL,
    seconds    INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);
CREATE INDEX idx_watch_time_post ON post_watch_time(post_id);

-- 2. Impressions: was post shown to user? Includes device_type + time_bucket
CREATE TABLE IF NOT EXISTS post_impressions (
    user_id       INT NOT NULL,
    post_id       INT NOT NULL,
    impression_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_type   ENUM('mobile','desktop','tablet') DEFAULT 'desktop',
    time_bucket   ENUM('morning','afternoon','evening','night') DEFAULT 'morning',
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);
CREATE INDEX idx_impressions_post ON post_impressions(post_id);

-- 3. Scroll Depth: how far user read long-form text (0–100%)
CREATE TABLE IF NOT EXISTS post_scroll_depth (
    user_id    INT NOT NULL,
    post_id    INT NOT NULL,
    depth_pct  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- 4. Video Completion: % of video watched (0–100)
CREATE TABLE IF NOT EXISTS post_video_completion (
    user_id        INT NOT NULL,
    post_id        INT NOT NULL,
    completion_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- 5. Share Events: user copied link or shared — strong positive signal
CREATE TABLE IF NOT EXISTS post_shares (
    share_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    post_id    INT NOT NULL,
    method     ENUM('copy_link','web_share','other') DEFAULT 'copy_link',
    shared_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);
CREATE INDEX idx_shares_user_post ON post_shares(user_id, post_id);

-- 6. Profile Clicks: user clicked author name from a post
CREATE TABLE IF NOT EXISTS post_profile_clicks (
    user_id       INT NOT NULL,
    post_id       INT NOT NULL,
    author_id     INT NOT NULL,
    clicked_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id)   REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id)   REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 7. Report/Hide Events: explicit negative signal (hard label -1)
CREATE TABLE IF NOT EXISTS post_reports (
    report_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    post_id     INT NOT NULL,
    reason      ENUM('spam','offensive','misleading','not_interested','other') DEFAULT 'not_interested',
    is_hidden   BOOLEAN DEFAULT TRUE,
    reported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_report_user_post (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- 8. Repeat Views: user returned to same post multiple times
CREATE TABLE IF NOT EXISTS post_repeat_views (
    user_id     INT NOT NULL,
    post_id     INT NOT NULL,
    view_count  INT NOT NULL DEFAULT 1,
    first_view  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_view   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

-- ── Growth Journey ─────────────────────────────────────────────────────────

-- Core state (1:1 with user)
CREATE TABLE IF NOT EXISTS growth_journey (
    user_id           INT PRIMARY KEY,
    height_cm         DECIMAL(12,2) DEFAULT 10.00,
    last_awarded_date DATE          DEFAULT NULL,
    longest_streak    INT           DEFAULT 0,
    current_ref_id    VARCHAR(40)   DEFAULT 'hand',
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Append-only growth log (powers timeline, heatmap, growth anniversaries)
CREATE TABLE IF NOT EXISTS growth_journey_log (
    log_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    award_date   DATE NOT NULL,
    cm_gained    DECIMAL(6,2) NOT NULL,
    height_after DECIMAL(12,2) NOT NULL,
    source       ENUM('lesson','quiz','milestone','momentum_bonus','welcome_bonus','shield_used') NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_day_source (user_id, award_date, source),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_gjl_user_date ON growth_journey_log(user_id, award_date);

-- Reference object ladder (data-driven)
CREATE TABLE IF NOT EXISTS growth_reference_objects (
    ref_id      VARCHAR(40) PRIMARY KEY,
    label       VARCHAR(100) NOT NULL,
    height_cm   DECIMAL(12,2) NOT NULL,
    sort_order  INT NOT NULL,
    asset_file  VARCHAR(120) NOT NULL
);

-- Streak protection inventory (auto-apply, Brilliant-style)
CREATE TABLE IF NOT EXISTS streak_shields (
    user_id        INT NOT NULL,
    shield_count   INT DEFAULT 0,
    max_shields    INT DEFAULT 2,
    last_earned_at DATE DEFAULT NULL,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed reference objects (heights verified from real-world sources)
INSERT IGNORE INTO growth_reference_objects (ref_id, label, height_cm, sort_order, asset_file) VALUES
('hand',            'Human Hand',                       18.00,   1,  'hand.svg'),
('a4-paper',        'A4 Paper (long edge)',              29.70,   2,  'a4-paper.svg'),
('toddler',         'Average 2-Year-Old',                86.00,   3,  'toddler.svg'),
('average-human',   'Average Global Adult',             170.00,   4,  'average-human.svg'),
('tallest-human',   'Tallest Human (Robert Wadlow)',    272.00,   5,  'tallest-human.svg'),
('basketball-hoop', 'NBA Basketball Hoop',              305.00,   6,  'basketball-hoop.svg'),
('giraffe',         'Adult Giraffe',                    550.00,   7,  'giraffe.svg'),
('oak-tree',        'Mature Oak Tree',                 1200.00,   8,  'oak-tree.svg'),
('statue-liberty',  'Statue of Liberty',               9300.00,   9,  'statue-of-liberty.svg'),
('eiffel-tower',    'Eiffel Tower',                   33000.00,  10,  'eiffel-tower.svg'),
('burj-khalifa',    'Burj Khalifa',                   82800.00,  11,  'burj-khalifa.svg'),
('mount-everest',   'Mount Everest',                 884886.00,  12,  'mount-everest.svg');

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Missing Tables (Code references these but schema didn't define them)
-- ══════════════════════════════════════════════════════════════════════════════

-- Referenced by: utils/moderationLogger.js:8
CREATE TABLE IF NOT EXISTS moderation_logs (
    log_id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    post_id          INT,
    content          TEXT NOT NULL,
    content_type     ENUM('post','comment','quiz') NOT NULL DEFAULT 'post',
    is_hate_speech   BOOLEAN DEFAULT FALSE,
    confidence       DECIMAL(3,2) DEFAULT 0,
    reasons          JSON,
    detection_details JSON,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE SET NULL,
    INDEX idx_modlog_created (created_at),
    INDEX idx_modlog_user (user_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Security Hardening (Against 100 concurrent attacker scenario)
-- ══════════════════════════════════════════════════════════════════════════════

-- JWT revocation: blacklist stolen/compromised tokens
CREATE TABLE IF NOT EXISTS token_blacklist (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,              -- SHA-256 of the JWT
    user_id    INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,             -- Auto-cleanup: delete after JWT expiry
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_token_hash (token_hash),
    INDEX idx_token_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Per-user brute force tracking (complements per-IP rate limiting in middleware)
CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    email        VARCHAR(255) NOT NULL,
    ip_address   VARCHAR(45) NOT NULL,
    user_agent   VARCHAR(500),
    success      BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_email (email, attempted_at),
    INDEX idx_login_ip (ip_address, attempted_at)
);

-- Auto-lock accounts after N failed logins
CREATE TABLE IF NOT EXISTS account_locks (
    user_id     INT PRIMARY KEY,
    locked_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lock_reason ENUM('brute_force','suspicious_activity','manual') NOT NULL,
    unlock_at   TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Audit Trail & Forensics
-- ══════════════════════════════════════════════════════════════════════════════

-- Tracks all security-sensitive operations for forensic analysis
CREATE TABLE IF NOT EXISTS audit_log (
    log_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    action      VARCHAR(50) NOT NULL,          -- 'login', 'password_change', 'account_delete', 'role_change', 'post_delete'
    target_type VARCHAR(30),                   -- 'user', 'post', 'quiz', 'comment'
    target_id   INT,
    ip_address  VARCHAR(45),
    user_agent  VARCHAR(500),
    details     JSON,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id, created_at),
    INDEX idx_audit_action (action, created_at),
    INDEX idx_audit_target (target_type, target_id)
);

-- Prevents stealthy email swaps (attacker changes email then resets password)
CREATE TABLE IF NOT EXISTS email_change_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    old_email   VARCHAR(255) NOT NULL,
    new_email   VARCHAR(255) NOT NULL,
    changed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address  VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_email_change_user (user_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Performance Indexes (for recommendation engine under 100-user load)
-- ══════════════════════════════════════════════════════════════════════════════

-- Engagement table covering indexes (8 parallel queries per /recommendations/feed)
CREATE INDEX idx_watch_time_user ON post_watch_time(user_id, post_id, seconds);
CREATE INDEX idx_impressions_user ON post_impressions(user_id, post_id, device_type, time_bucket);
CREATE INDEX idx_scroll_depth_user ON post_scroll_depth(user_id, post_id, depth_pct);
CREATE INDEX idx_video_completion_user ON post_video_completion(user_id, post_id, completion_pct);
CREATE INDEX idx_shares_user ON post_shares(user_id, post_id);
CREATE INDEX idx_profile_clicks_user ON post_profile_clicks(user_id, post_id);
CREATE INDEX idx_repeat_views_user ON post_repeat_views(user_id, post_id, view_count);

-- Comment length aggregation (used by recommendation engine)
CREATE INDEX idx_comments_analysis ON comments(user_id, is_deleted, post_id);

-- Follows mutual lookup (connection check runs on every feed request)
CREATE INDEX idx_follows_mutual ON follows(following_id, follower_id);

-- Study session aggregation (knowledge chart, study history)
CREATE INDEX idx_study_sessions_agg ON study_sessions(user_id, session_date, end_time);

-- Quiz attempts for leaderboard
CREATE INDEX idx_quiz_attempts_leaderboard ON quiz_attempts(quiz_id, user_id, percentage DESC);

-- Growth journey log for heatmap/timeline
CREATE INDEX idx_growth_log_year ON growth_journey_log(user_id, award_date);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 6: Rate Limiting at DB Level (Defense in Depth)
-- ══════════════════════════════════════════════════════════════════════════════

-- Per-user action tracking (complements express-rate-limit middleware)
CREATE TABLE IF NOT EXISTS rate_limit_counters (
    user_id      INT NOT NULL,
    action_type  VARCHAR(30) NOT NULL,         -- 'engagement_batch', 'post_create', 'comment'
    window_start TIMESTAMP NOT NULL,
    count        INT NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, action_type, window_start),
    INDEX idx_rate_limit_cleanup (window_start),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);