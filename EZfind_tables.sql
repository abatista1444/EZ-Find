USE EZfind;
CREATE TABLE Login (
	UserLogin INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE Users (
	UserId INT AUTO_INCREMENT PRIMARY KEY,
    UserLogin INT NOT NULL,
    FirstName VARCHAR(100),
    LastName VARCHAR(100),
    Phone VARCHAR(20),
    Address VARCHAR(255),
    City VARCHAR(100),
    State VARCHAR(100),
    ZipCode VARCHAR(20),
    FOREIGN KEY (UserLogin) REFERENCES Login(UserLogin) 
		ON DELETE CASCADE);
	
    CREATE TABLE PaymentSystem (
		PaymentId INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NOT NULL,
        CardLast4 CHAR(4),
        CardType VARCHAR(50),
        ExpirationDate DATE,
        BillingAddress VARCHAR(255),
        FOREIGN KEY (UserId) REFERENCES Users(UserId)
			ON DELETE CASCADE );
	
    CREATE TABLE SavedSearches (
		SearchId INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NOT NULL,
        Name VARCHAR(255) NOT NULL,
        SearchQuery VARCHAR(500) NOT NULL,
        Location VARCHAR(255),
        MinPrice DECIMAL(10, 2),
        MaxPrice DECIMAL(10, 2),
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        UNIQUE KEY uq_saved_searches_user_name (UserId, Name)
        );
            
	CREATE TABLE SavedItems (
		ItemId INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    ExternalItemId VARCHAR(255) NOT NULL,
    ItemName VARCHAR(255) NOT NULL,
    ItemDescription TEXT,
    Price DECIMAL(10, 2),
    Url TEXT NOT NULL,
    Source VARCHAR(100) NOT NULL,
    ImageUrl TEXT,
    Location VARCHAR(255),
    PostedAt DATETIME,
    DateSaved DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saved_items_user_external (UserId, ExternalItemId),
        FOREIGN KEY (UserId) REFERENCES Users(UserId)
			ON DELETE CASCADE );

	CREATE TABLE SharedSearchTokens (
		TokenId INT AUTO_INCREMENT PRIMARY KEY,
    Token VARCHAR(64) NOT NULL UNIQUE,
    CreatedBy INT NOT NULL,
    SearchQuery VARCHAR(500) NOT NULL,
    Location VARCHAR(255),
    MinPrice DECIMAL(10, 2),
    MaxPrice DECIMAL(10, 2),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt DATETIME,
    AccessCount INT DEFAULT 0,
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserId) ON DELETE CASCADE,
    INDEX idx_token (Token),
    INDEX idx_created_by (CreatedBy),
    INDEX idx_expires_at (ExpiresAt)
	);

