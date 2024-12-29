# Cash Flow Minimizer

A web application that optimizes and minimizes cash flow among friends by calculating the most efficient way to settle group expenses.

## Description

This application simplifies group expense management by implementing an efficient algorithm to minimize the number of transactions needed to settle debts within a group. Instead of multiple back-and-forth payments, the system calculates the optimal settlement path, reducing the total number of transactions needed.

## Key Features

- **User Authentication**
  - Secure login and signup system
  - Email-based user identification
  - Session management for secure access

- **Group Management**
  - Create custom groups (e.g., trips, parties, roommates)
  - Add members via email
  - Multiple groups per user

- **Expense Management**
  - Add expenses within groups
  - Specify participants for each expense
  - Automatic equal split calculation
  - Any group member can add expenses

- **Smart Settlement**
  - Implements an optimized cash flow minimization algorithm
  - Automatically calculates the minimum number of transactions needed
  - Handles complex debt scenarios efficiently
  - Real-time settlement calculations

## Technical Implementation

### Cash Flow Minimization Algorithm
The application uses an efficient algorithm with the following approach:
- Uses max-heap for creditors and min-heap for debtors
- Time Complexity: O(N log N) where N is the number of participants
- Optimizes multiple transactions into minimum necessary transfers
- Handles circular debts efficiently

Example scenarios handled:
1. Direct simplification: If X owes Y $500 and Y owes X $800, simplified to Y owing X $300
2. Circular resolution: If X owes Y $400, Y owes Z $200, and Z owes X $200, resolved with a single transaction

## Technologies Used

- **Frontend**
  - HTML5
  - CSS3
  - JavaScript

- **Backend**
  - Node.js
  - Express.js
  - MySQL database
  - EJS templating

- **Security**
  - bcryptjs for password hashing
  - Express sessions for authentication
  - Environment variables for sensitive data

## Installation

1. Clone the repository
    git clone <your-repository-url>

2. Install dependencies
    npm install

3. Set up environment variables Create a .env file in the root directory with:
    DB_HOST=your_database_host
    DB_USER=your_database_user
    DB_PASSWORD=your_database_password
    DB_NAME=your_database_name
    SESSION_SECRET=your_session_secret

4. Set up the database Run the schema.sql file in your MySQL server to create the necessary tables.
    
5. Usage
    Development server:
        npm run dev

    Production server:
        npm start

    Access the application at http://localhost:3000 (or your configured port).
