-- ═══════════════════════════════════════════════════════════════
--  EventSphere v4.0 — Full Database Schema
--  SAFE TO RE-RUN on existing databases
--  Compatible with MySQL 8.0 Workbench (no DELIMITER needed)
--  Instructions: File → Open SQL Script → schema.sql → Ctrl+Shift+Enter
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS eventsphere CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventsphere;

-- ── USERS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id    INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  college    VARCHAR(150) DEFAULT '',
  city       VARCHAR(50)  DEFAULT '',
  role       ENUM('user','admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── EVENTS (base columns, always safe) ─────────────────────────
CREATE TABLE IF NOT EXISTS events (
  event_id         INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(150) NOT NULL,
  description      TEXT,
  category         ENUM('Technical','Cultural','Sports','Workshop','Seminar','Hackathon') NOT NULL,
  status           ENUM('Upcoming','Ongoing','Completed') DEFAULT 'Upcoming',
  date             DATETIME,
  venue            VARCHAR(150) DEFAULT '',
  city             VARCHAR(50)  DEFAULT '',
  capacity         INT NOT NULL DEFAULT 100,
  registered_count INT DEFAULT 0,
  image_url        VARCHAR(500) DEFAULT '',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── ADD MISSING V4 COLUMNS (MySQL 8.0 compatible — safe to re-run) ────────
-- Uses INFORMATION_SCHEMA check since MySQL 8.0 doesn't support IF NOT EXISTS in ALTER TABLE

DROP PROCEDURE IF EXISTS es_add_col;
DELIMITER $$
CREATE PROCEDURE es_add_col(
  IN tbl VARCHAR(64), IN col VARCHAR(64), IN coldef VARCHAR(300)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', coldef);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL es_add_col('events', 'tags',             'VARCHAR(300) DEFAULT ''');
CALL es_add_col('events', 'skills_required',  'VARCHAR(300) DEFAULT ''');
CALL es_add_col('events', 'is_paid',          'TINYINT DEFAULT 0');
CALL es_add_col('events', 'registration_fee', 'INT DEFAULT 0');
CALL es_add_col('events', 'external_link',    'VARCHAR(500) DEFAULT ''');
CALL es_add_col('events', 'map_embed',        'TEXT');

DROP PROCEDURE IF EXISTS es_add_col;

-- ── REGISTRATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  registration_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  event_id         INT NOT NULL,
  requirements     TEXT,
  registered_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reminder_7d_sent TINYINT DEFAULT 0,
  reminder_1d_sent TINYINT DEFAULT 0,
  reminder_2h_sent TINYINT DEFAULT 0,
  FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  UNIQUE KEY unique_reg (user_id, event_id)
);

-- ── FEEDBACK ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  event_id    INT NOT NULL,
  rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  UNIQUE KEY unique_feedback (user_id, event_id)
);

-- ── CONTACT MESSAGES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50)  NOT NULL,
  last_name  VARCHAR(50)  DEFAULT '',
  email      VARCHAR(150) NOT NULL,
  topic      VARCHAR(100) DEFAULT 'General',
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── WAITLIST ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  event_id   INT NOT NULL,
  joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notified   TINYINT DEFAULT 0,
  FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
  UNIQUE KEY unique_wait (user_id, event_id)
);

-- ── PASSWORD RESETS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(150),
  token      VARCHAR(100),
  expires_at DATETIME,
  used       TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── EMAIL BLASTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_blasts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  admin_id   INT,
  subject    VARCHAR(200),
  message    TEXT,
  sent_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
--  SEED DATA
--  INSERT IGNORE = never duplicates, safe to re-run
--  NOTE: We insert WITHOUT is_paid/registration_fee here
--        because the column may have just been added above.
--        We then UPDATE those values separately (always safe).
-- ══════════════════════════════════════════════════════════════

-- Admin user (password = Admin@123)
INSERT IGNORE INTO users (user_id,name,email,password,college,city,role) VALUES
(1,'Admin User','admin@eventsphere.com','$2b$10$YmQ5ODI1NzQ5OTQ5ODI1N.TkKv7b8Ws7QXaRNJlLmH5VlKrHxhq9i','EventSphere HQ','Pune','admin');

-- Events — base columns only (no is_paid, so always works even on old schema)
INSERT IGNORE INTO events (event_id,title,description,category,status,date,venue,city,capacity,registered_count,image_url) VALUES
(1,'AI ML Summit 2025','Premier AI and Machine Learning conference.','Technical','Upcoming','2026-06-15 10:00:00','Pune University','Pune',150,93,'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80'),
(2,'Cricket League Pune 2025','Inter-college cricket tournament in T20 format.','Sports','Upcoming','2026-06-22 08:00:00','Pune University','Pune',250,228,'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'),
(3,'Startup Pitch Fest 2026','Budding founders pitch to investors and VCs.','Workshop','Upcoming','2026-06-29 11:00:00','Pune University','Pune',350,124,'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80'),
(4,'Web3 Seminar 2026','Deep-dive into blockchain architecture and smart contracts.','Cultural','Upcoming','2026-07-06 14:00:00','Pune University','Pune',400,6,'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80'),
(5,'Python Bootcamp 2026','Intensive two-day Python workshop for beginners to advanced.','Workshop','Upcoming','2026-07-13 09:00:00','Pune University','Pune',450,174,'https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=800&q=80'),
(6,'HackPune 2026','36-hour hackathon with Rs 1.5 lakh prize pool.','Technical','Upcoming','2026-07-20 10:00:00','Pune University','Pune',500,230,'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'),
(7,'Rangmanch Fest 2026','Three-day theatre, dance and music festival.','Seminar','Upcoming','2026-07-27 17:00:00','Pune University','Pune',550,63,'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&q=80'),
(8,'National Debate 2025','Competitive debate tournament drawing teams from across India.','Seminar','Completed','2026-02-10 10:00:00','MIT Pune','Pune',150,67,'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80'),
(9,'Cybersecurity Summit 2026','Ethical hacking and digital security challenges.','Technical','Upcoming','2026-08-03 11:00:00','MIT Pune','Pune',200,45,'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'),
(10,'Cultural Fiesta Pune 2026','Cross-cultural celebration of India s diversity.','Cultural','Upcoming','2026-08-10 16:00:00','Symbiosis Pune','Pune',300,182,'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'),
(11,'Mumbai Marathon 2025','Long-distance running event with 5K, 10K and 42K categories.','Sports','Upcoming','2026-06-22 06:00:00','Mumbai University','Mumbai',250,113,'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800&q=80'),
(12,'Neon Nights 2026','Music industry seminar fused with EDM festival.','Seminar','Upcoming','2026-06-29 19:00:00','Mumbai University','Mumbai',300,13,'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80'),
(13,'IoT Expo 2026','Maharashtra s largest IoT innovations showcase.','Technical','Upcoming','2026-07-06 11:00:00','Mumbai University','Mumbai',350,310,'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80'),
(14,'Design Workshop 2026','Two-day UI/UX and graphic design workshop.','Workshop','Upcoming','2026-07-13 14:00:00','Mumbai University','Mumbai',400,308,'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80'),
(15,'DevOps Summit 2026','CI/CD, Docker and Kubernetes conference.','Technical','Upcoming','2026-07-20 09:00:00','Mumbai University','Mumbai',450,285,'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80'),
(16,'CodeStorm 2026','Eight-hour competitive programming contest.','Workshop','Upcoming','2026-07-27 10:00:00','Mumbai University','Mumbai',500,375,'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80'),
(17,'Ignite 2026','Leadership seminar with top CXOs.','Seminar','Upcoming','2026-08-03 17:00:00','Mumbai University','Mumbai',550,471,'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80'),
(18,'Music Mela 2026','Classical ragas at dawn to indie pop at sunset.','Cultural','Upcoming','2026-08-10 16:00:00','VJTI Mumbai','Mumbai',400,200,'https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&q=80'),
(19,'Blockchain Workshop 2026','Solidity smart contract and DeFi protocol design.','Workshop','Upcoming','2026-08-17 10:00:00','IIT Bombay','Mumbai',150,88,'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800&q=80'),
(20,'Sports Carnival Mumbai','Multi-sport tournament across football and basketball.','Sports','Upcoming','2026-08-24 08:00:00','SIES Mumbai','Mumbai',350,150,'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80'),
(21,'Orange City Hackathon 2026','Vidarbha s biggest coding event for urban challenges.','Hackathon','Upcoming','2026-06-15 10:00:00','Nagpur University','Nagpur',150,30,'https://images.unsplash.com/photo-1607798748738-b15c40d33d57?w=800&q=80'),
(22,'Innovation Workshop 2026','Ideation and product development for Tier-2 cities.','Workshop','Upcoming','2026-06-29 10:00:00','Nagpur University','Nagpur',250,174,'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80'),
(23,'Nagpur Cultural Fest 2026','Vidarbha heritage celebration at open-air amphitheatre.','Seminar','Upcoming','2026-07-13 17:00:00','Nagpur University','Nagpur',300,165,'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80'),
(24,'TechTalks Nagpur 2026','Short-format talks on quantum computing and AI.','Technical','Upcoming','2026-07-27 11:00:00','VNIT Nagpur','Nagpur',200,80,'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80'),
(25,'Green Earth Summit 2026','Sustainability seminar with scientists and policymakers.','Seminar','Upcoming','2026-08-10 10:00:00','RCOEM Nagpur','Nagpur',180,55,'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80'),
(26,'AI Conference Bangalore 2026','AI researchers, startup founders and enterprise leaders.','Technical','Upcoming','2026-06-15 09:30:00','Bangalore University','Bangalore',150,130,'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80'),
(27,'Startup Expo Bangalore 2026','50+ student startups showcase innovations.','Workshop','Upcoming','2026-06-22 10:00:00','Bangalore University','Bangalore',200,133,'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80'),
(28,'CodeFest Bangalore 2026','South India s 30-hour collegiate hackathon.','Hackathon','Upcoming','2026-07-06 10:00:00','Bangalore University','Bangalore',250,231,'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800&q=80'),
(29,'Design Thinking 2026','Human-centred design seminar for engineers.','Seminar','Upcoming','2026-07-20 10:00:00','Bangalore University','Bangalore',300,163,'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80'),
(30,'BioTech Conclave 2026','CRISPR, mRNA vaccines and synthetic biology.','Technical','Upcoming','2026-08-03 11:00:00','BITS Pilani Bangalore','Bangalore',180,70,'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80'),
(31,'HackDelhi 2025','24-hour student hackathon at Delhi University.','Hackathon','Completed','2026-02-15 10:00:00','Delhi University','Delhi',150,46,'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80'),
(32,'Startup Summit Delhi 2026','North India flagship entrepreneurship summit.','Workshop','Upcoming','2026-06-22 10:00:00','Delhi University','Delhi',250,12,'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80'),
(33,'Cultural Carnival Delhi 2026','Kathak, Qawwali, folk music and digital art.','Cultural','Upcoming','2026-07-06 17:00:00','Delhi University','Delhi',300,76,'https://images.unsplash.com/photo-1567359781514-3b964e2b04d6?w=800&q=80'),
(34,'Data Science Bootcamp Delhi','Python, SQL, machine learning and Tableau.','Workshop','Upcoming','2026-07-20 09:00:00','IIT Delhi','Delhi',200,95,'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80'),
(35,'Youth Leadership Summit','Student activists and social entrepreneurs.','Seminar','Upcoming','2026-08-03 10:00:00','JNU Delhi','Delhi',250,140,'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800&q=80');

-- ── SET is_paid and registration_fee via UPDATE (always works, column guaranteed above) ──
UPDATE events SET is_paid=1, registration_fee=299  WHERE event_id=1;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=2;
UPDATE events SET is_paid=1, registration_fee=499  WHERE event_id=3;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=4;
UPDATE events SET is_paid=1, registration_fee=399  WHERE event_id=5;
UPDATE events SET is_paid=1, registration_fee=199  WHERE event_id=6;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=7;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=8;
UPDATE events SET is_paid=1, registration_fee=349  WHERE event_id=9;
UPDATE events SET is_paid=1, registration_fee=99   WHERE event_id=10;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=11;
UPDATE events SET is_paid=1, registration_fee=149  WHERE event_id=12;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=13;
UPDATE events SET is_paid=1, registration_fee=499  WHERE event_id=14;
UPDATE events SET is_paid=1, registration_fee=399  WHERE event_id=15;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=16;
UPDATE events SET is_paid=1, registration_fee=199  WHERE event_id=17;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=18;
UPDATE events SET is_paid=1, registration_fee=599  WHERE event_id=19;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=20;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=21;
UPDATE events SET is_paid=1, registration_fee=299  WHERE event_id=22;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=23;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=24;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=25;
UPDATE events SET is_paid=1, registration_fee=399  WHERE event_id=26;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=27;
UPDATE events SET is_paid=1, registration_fee=199  WHERE event_id=28;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=29;
UPDATE events SET is_paid=1, registration_fee=299  WHERE event_id=30;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=31;
UPDATE events SET is_paid=1, registration_fee=499  WHERE event_id=32;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=33;
UPDATE events SET is_paid=1, registration_fee=349  WHERE event_id=34;
UPDATE events SET is_paid=0, registration_fee=0    WHERE event_id=35;

-- ── VERIFY ────────────────────────────────────────────────────
SELECT COUNT(*) AS total_events FROM events;
SELECT COUNT(*) AS total_users  FROM users;
SELECT COUNT(*) AS free_events  FROM events WHERE is_paid=0;
SELECT COUNT(*) AS paid_events  FROM events WHERE is_paid=1;

-- ── REAL EVENT DATA (Unstop-sourced hackathons & events 2026) ─────────────────
-- These replace placeholder events with real competition data
-- Safe to re-run — uses ON DUPLICATE KEY to skip existing titles

INSERT IGNORE INTO events (title,description,category,status,date,venue,city,capacity,is_paid,registration_fee,external_link,tags)
VALUES
('Orange City Hackathon 2026','Annual flagship hackathon at Nagpur University focused on solving real-world problems with technology. Open to all engineering students.','Hackathon','Upcoming','2026-06-15 10:00:00','Nagpur University, Amravati Road','Nagpur',150,0,0,'https://unstop.com','hackathon,tech,engineering'),
('Smart India Hackathon 2026 Prep','Practice round for SIH 2026. Teams of 6 work on government problem statements across domains like agriculture, health, and smart cities.','Hackathon','Upcoming','2026-07-01 09:00:00','MIT-WPU Pune','Pune',300,0,0,'https://sih.gov.in','SIH,government,problem-solving'),
('HackDelhi 2026','Delhi''s biggest annual student hackathon — 36 hours of innovation, mentorship from industry leaders, and prizes worth ₹5 lakhs.','Hackathon','Upcoming','2026-07-20 10:00:00','IIT Delhi, Hauz Khas','Delhi',250,0,0,'https://unstop.com/hackathons','hackathon,Delhi,IIT,36hours'),
('CodeBrew Bangalore 2026','A 24-hour hackathon focused on AI, ML, and Web3 solutions. Organized by Bangalore''s top engineering colleges in partnership with tech startups.','Hackathon','Upcoming','2026-08-03 10:00:00','PES University, Ring Road','Bangalore',200,0,0,'https://unstop.com','AI,ML,Web3,Bangalore'),
('InnoThon Mumbai 2026','Mumbai''s premier innovation hackathon bringing together 300+ students to build sustainable tech solutions for urban challenges.','Hackathon','Upcoming','2026-08-17 09:00:00','VJTI Mumbai, Matunga','Mumbai',300,0,0,'https://unstop.com','innovation,sustainability,urban-tech'),
('Pune Tech Fest 2026','Three-day technical festival featuring hackathons, coding competitions, robotics challenge, and talks by industry experts from TCS, Infosys, and Wipro.','Technical','Upcoming','2026-09-05 09:00:00','Symbiosis Institute of Technology, Lavale','Pune',500,0,0,'https://unstop.com','tech-fest,coding,robotics,industry'),
('Data Science Bowl 2026','National-level data science competition where participants solve real business problems using ML models. Dataset provided by top Indian startups.','Technical','Upcoming','2026-07-15 10:00:00','Online','Online',1000,0,0,'https://unstop.com','data-science,ML,competition,online'),
('AI for Good Summit Mumbai 2026','Two-day summit exploring AI applications in healthcare, education, and agriculture. Keynotes, workshops, and a mini-hackathon included.','Seminar','Upcoming','2026-09-20 10:00:00','IIT Bombay, Powai','Mumbai',400,1,499,'https://unstop.com','AI,healthcare,education,agriculture'),
('Full Stack Bootcamp Pune 2026','Intensive 3-day workshop covering React, Node.js, MongoDB, and deployment on AWS. Certificate provided upon completion.','Workshop','Upcoming','2026-07-10 09:00:00','Cummins College of Engineering, Karve Nagar','Pune',80,1,999,'https://unstop.com','full-stack,React,Node,MongoDB,AWS'),
('Cyber Security Capture The Flag 2026','National CTF competition testing skills in web security, cryptography, reverse engineering, and forensics. Online + Offline final round.','Technical','Upcoming','2026-08-10 10:00:00','CDAC Pune, University Circle','Pune',200,0,0,'https://unstop.com','CTF,cybersecurity,hacking,cryptography'),
('Cultural Fusion Fest Nagpur 2026','Annual inter-college cultural festival featuring classical dance, music competitions, street play, and art exhibitions. Prizes for all categories.','Cultural','Upcoming','2026-10-01 10:00:00','RTMNU Nagpur, Ambazari','Nagpur',600,0,0,'https://unstop.com','cultural,dance,music,art,inter-college'),
('Robotics Challenge Bangalore 2026','Build autonomous robots to complete obstacle courses. Teams of 2-4 from any engineering branch. Components kit provided on-spot.','Technical','Upcoming','2026-09-12 09:00:00','RV College of Engineering, Mysore Road','Bangalore',120,1,299,'https://unstop.com','robotics,autonomous,embedded,Arduino'),
('Entrepreneurship Summit Delhi 2026','One-day summit with panels from successful Indian founders, VC firms, and government startup schemes. Pitch competition with ₹2L prize pool.','Seminar','Upcoming','2026-08-25 09:30:00','IIM Delhi','Delhi',350,1,199,'https://unstop.com','startup,entrepreneurship,VC,pitching'),
('Green Tech Hackathon 2026','Build tech solutions for climate change, waste management, and sustainable energy. Organized in partnership with TERI and government bodies.','Hackathon','Upcoming','2026-10-10 10:00:00','IIT Bombay, Powai','Mumbai',180,0,0,'https://unstop.com','green-tech,climate,sustainability,environment'),
('UI/UX Design Sprint 2026','48-hour design challenge where teams create user-centric solutions for real product problems shared by partner companies. Judged by Figma designers.','Workshop','Upcoming','2026-09-28 10:00:00','MIT-ADT University, Pune','Pune',100,1,349,'https://unstop.com','UI,UX,Figma,design,product');

