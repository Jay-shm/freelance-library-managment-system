import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { verifyToken, isAdmin } from './auth.js';

const router = express.Router();

// Get all students (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT s.*, u.username 
      FROM students s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.name
    `);
    
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student by ID (admin or self)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // Check if user is admin or the student themselves
    if (req.user.role !== 'admin' && (!req.user.studentId || req.user.studentId !== studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const [students] = await pool.query(`
      SELECT s.*, u.username 
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [studentId]);
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json(students[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new student (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
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
      const [studentResult] = await connection.query(
        'INSERT INTO students (user_id, name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
        [userId, name, email, phone || null, address || null]
      );
      
      await connection.commit();
      connection.release();
      
      res.status(201).json({ 
        message: 'Student added successfully',
        studentId: studentResult.insertId
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update student (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, email, phone, address, username, password } = req.body;
    const studentId = req.params.id;
    
    // Validate input
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Get current student data
    const [students] = await pool.query(
      'SELECT * FROM students WHERE id = ?',
      [studentId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const student = students[0];
    
    // Check if email already exists (if changed)
    if (email !== student.email) {
      const [existingEmails] = await pool.query(
        'SELECT * FROM students WHERE email = ? AND id != ?',
        [email, studentId]
      );
      
      if (existingEmails.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update student profile
      await connection.query(
        'UPDATE students SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
        [name, email, phone || null, address || null, studentId]
      );
      
      // Update username if provided
      if (username) {
        // Check if username already exists
        const [existingUsers] = await connection.query(
          'SELECT * FROM users WHERE username = ? AND id != ?',
          [username, student.user_id]
        );
        
        if (existingUsers.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ message: 'Username already exists' });
        }
        
        await connection.query(
          'UPDATE users SET username = ? WHERE id = ?',
          [username, student.user_id]
        );
      }
      
      // Update password if provided
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await connection.query(
          'UPDATE users SET password = ? WHERE id = ?',
          [hashedPassword, student.user_id]
        );
      }
      
      await connection.commit();
      connection.release();
      
      res.json({ message: 'Student updated successfully' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete student (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Check if student exists
    const [students] = await pool.query(
      'SELECT * FROM students WHERE id = ?',
      [studentId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const student = students[0];
    
    // Check if student has any active book issues
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE student_id = ? AND status = "issued"',
      [studentId]
    );
    
    if (transactions.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete student as they have books issued' 
      });
    }
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Delete student
      await connection.query('DELETE FROM students WHERE id = ?', [studentId]);
      
      // Delete user
      await connection.query('DELETE FROM users WHERE id = ?', [student.user_id]);
      
      await connection.commit();
      connection.release();
      
      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get books issued to a student
router.get('/:id/books', verifyToken, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    
    // Check if user is admin or the student themselves
    if (req.user.role !== 'admin' && (!req.user.studentId || req.user.studentId !== studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const [transactions] = await pool.query(`
      SELECT t.*, b.title, b.author, b.category
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.student_id = ?
      ORDER BY t.issue_date DESC
    `, [studentId]);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching student books:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;