-- EZFind Database Schema
-- Run this script to initialize the database

CREATE DATABASE IF NOT EXISTS ezfind;
USE ezfind;

-- Users table
CREATE TABLE IF NOT EXISTS Users (
  UserId       INT AUTO_INCREMENT PRIMARY KEY,
  FirstName    VARCHAR(100) NOT NULL,
  LastName     VARCHAR(100) NOT NULL,
  Address      VARCHAR(255),
  City         VARCHAR(100),
  State        VARCHAR(100),
  Country      VARCHAR(100),
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Login table
CREATE TABLE IF NOT EXISTS Login (
  UserLogin    VARCHAR(255) NOT NULL PRIMARY KEY,  -- email used as login
  userId       INT NOT NULL,
  PasswordHash VARCHAR(255) NOT NULL,
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(UserId) ON DELETE CASCADE
);

-- Saved Items table
CREATE TABLE IF NOT EXISTS SavedItems (
  SavedItem    INT AUTO_INCREMENT PRIMARY KEY,
  userId       INT NOT NULL,
  Name         VARCHAR(255) NOT NULL,
  Cost         DECIMAL(10, 2),
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(UserId) ON DELETE CASCADE
);

-- Saved Searches table
CREATE TABLE IF NOT EXISTS SavedSearches (
  SavedSearch  INT AUTO_INCREMENT PRIMARY KEY,
  userId       INT NOT NULL,
  Name         VARCHAR(255) NOT NULL,
  Cost         DECIMAL(10, 2),
  CreatedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(UserId) ON DELETE CASCADE
);

-- Payment System table
CREATE TABLE IF NOT EXISTS PaymentSystem (
  paymentSystem INT AUTO_INCREMENT PRIMARY KEY,
  userId        INT NOT NULL,
  CardPay       VARCHAR(255),  -- Stores masked card or payment token
  CreatedAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(UserId) ON DELETE CASCADE
);
