-- Create Database
CREATE DATABASE IF NOT EXISTS tictactoe_db;
USE tictactoe_db;

-- Users Table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    coins INT DEFAULT 1000,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Game Sessions Table
CREATE TABLE game_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    player1_id INT NOT NULL,
    player2_id INT NOT NULL,
    winner_id INT NULL,
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (player1_id) REFERENCES users(user_id),
    FOREIGN KEY (player2_id) REFERENCES users(user_id),
    FOREIGN KEY (winner_id) REFERENCES users(user_id)
);

-- Chat Messages Table
CREATE TABLE chat_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(session_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Achievements Table
CREATE TABLE achievements (
    achievement_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    requirement INT NOT NULL
);

-- User Achievements Table
CREATE TABLE user_achievements (
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id)
);

-- Store Items Table
CREATE TABLE store_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price INT NOT NULL,
    item_type ENUM('theme', 'avatar', 'powerup') NOT NULL,
    available BOOLEAN DEFAULT TRUE
);

-- User Purchases Table
CREATE TABLE user_purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id INT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (item_id) REFERENCES store_items(item_id)
);

-- Insert Sample Achievements
INSERT INTO achievements (name, description, icon, requirement) VALUES
('First Victory', 'Win your first game', '🏆', 1),
('Veteran Player', 'Win 10 games', '⭐', 10),
('Champion', 'Win 50 games', '👑', 50),
('Social Butterfly', 'Play 20 games', '🦋', 20);

-- Insert Sample Store Items
INSERT INTO store_items (name, description, price, item_type) VALUES
('Dark Theme', 'Sleek dark mode for the game board', 100, 'theme'),
('Ocean Theme', 'Cool ocean-themed board', 150, 'theme'),
('Gold Avatar', 'Shiny gold player avatar', 200, 'avatar'),
('Silver Avatar', 'Classic silver player avatar', 150, 'avatar'),
('Undo Move', 'Take back your last move once per game', 50, 'powerup'),
('Hint System', 'Get a hint for best move', 75, 'powerup');

-- Create Indexes for Performance
CREATE INDEX idx_user_wins ON users(wins DESC);
CREATE INDEX idx_session_status ON game_sessions(status);
CREATE INDEX idx_session_players ON game_sessions(player1_id, player2_id);
CREATE INDEX idx_messages_session ON chat_messages(session_id);
