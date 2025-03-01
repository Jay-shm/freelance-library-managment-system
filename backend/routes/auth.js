import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Validate input
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Get user from database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, role]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Compare passwords
    const isMatch = user.role === 'admin' ? password === user.password : await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Get additional user info if student
    let userData = { id: user.id, username: user.username, role: user.role };
    
    if (user.role === 'student') {
      const [students] = await pool.query(
        'SELECT * FROM students WHERE user_id = ?',
        [user.id]
      );
      
      if (students.length > 0) {
        userData.studentId = students[0].id;
        userData.name = students[0].name;
        userData.email = students[0].email;
      }
    }
    
    // Create and sign JWT token
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '1h' });
    
    res.json({
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register student route
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email, phone, address } = req.body;
    
    // Validate input
    if (!username || !password || !name || !email) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    
    // Check if username already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    // Check if email already exists
    const [existingEmails] = await pool.query(
      'SELECT * FROM students WHERE email = ?',
      [email]
    );
    
    if (existingEmails.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Create user
      const [userResult] = await connection.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, 'student']
      );
      
      const userId = userResult.insertId;
      
      // Create student profile
      await connection.query(
        'INSERT INTO students (user_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
        [userId, name, email, phone || null, address || null]
      );
      
      await connection.commit();
      connection.release();
      
      res.status(201).json({ message: 'Student registered successfully' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to verify JWT token
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check if user is admin
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

export default router;