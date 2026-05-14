USE DBMS;

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id   INT AUTO_INCREMENT PRIMARY KEY,
    public_id CHAR(36) NOT NULL DEFAULT (UUID()),
    username  VARCHAR(100) UNIQUE NOT NULL,
    email     VARCHAR(255) UNIQUE NOT NULL,
    CHECK (email REGEXP '^[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]{2,}\\.[A-Za-z]{2,}$'),
    password  CHAR(60) NOT NULL,
    registration_ip VARCHAR(45),
    registration_device_id VARCHAR(255),
    join_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_users_public_id (public_id)
);

CREATE TABLE IF NOT EXISTS user_profile (
    user_id         INT PRIMARY KEY,
    dob             DATE NOT NULL,
    CHECK (YEAR(dob) BETWEEN 1945 AND 2012),
    bio             TEXT,
    badges          MEDIUMBLOB,
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
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS user_info (
    user_id     INT PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name   VARCHAR(50) NOT NULL,
    photo       MEDIUMBLOB,
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
    skill_name VARCHAR(25) UNIQUE NOT NULL
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

INSERT IGNORE INTO categories (name, icon, description) VALUES
('Engineering',      '⚙️',  'Software, hardware, and engineering topics'),
('Business',         '💼',  'Business, entrepreneurship and management'),
('Life Skills',      '🌱',  'Everyday practical life skills'),
('Psychology',       '🧠',  'Human behaviour and mental wellness'),
('Teaching Skills',  '🎓',  'Education methods and pedagogy'),
('Health & Nutrition','🥗', 'Diet, nutrition and health science'),
('Physical Fitness', '🏋️',  'Exercise, sports and body wellness'),
('Agriculture',      '🌾',  'Farming, sustainability and food production');

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
    certificate_img  MEDIUMBLOB,
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
    small_img  MEDIUMBLOB,
    media_type ENUM('image','video','none') DEFAULT 'none',
    category   VARCHAR(50),
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_pending   BOOLEAN DEFAULT FALSE,
    is_deleted   BOOLEAN DEFAULT FALSE,
    deleted_at   TIMESTAMP NULL,
    post_date  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_posts_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE INDEX idx_posts_public_id (public_id)
);
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_date ON posts(post_date DESC);

CREATE TABLE IF NOT EXISTS post_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id  INT NOT NULL,
    image    MEDIUMBLOB NOT NULL,
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
    type            ENUM('new_skill','quiz','streak','connection','system') NOT NULL,
    title           VARCHAR(200) NOT NULL,
    message         TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

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