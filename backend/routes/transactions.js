import express from 'express';
import { pool } from '../db.js';
import { verifyToken, isAdmin } from './auth.js';

const router = express.Router();

// Get all transactions (admin only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [transactions] = await pool.query(`
      SELECT t.*, b.title as book_title, s.name as student_name
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN students s ON t.student_id = s.id
      ORDER BY t.issue_date DESC
    `);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Issue book (admin only)
// Add this route after your existing routes
router.post('/issue', verifyToken, isAdmin, async (req, res) => {
  try {
      const { bookId, studentId, dueDate } = req.body;
      
      // Validate input
      if (!bookId || !studentId || !dueDate) {
          return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if book exists and is available
      const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [bookId]);
      
      if (books.length === 0) {
          return res.status(404).json({ message: 'Book not found' });
      }
      
      if (books[0].available_quantity <= 0) {
          return res.status(400).json({ message: 'Book is not available' });
      }

      // Begin transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
          // Create transaction record
          await connection.query(
              'INSERT INTO transactions (book_id, student_id, due_date) VALUES (?, ?, ?)',
              [bookId, studentId, dueDate]
          );

          // Update book availability
          await connection.query(
              'UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?',
              [bookId]
          );

          await connection.commit();
          connection.release();

          res.status(201).json({ message: 'Book issued successfully' });
      } catch (error) {
          await connection.rollback();
          connection.release();
          throw error;
      }
  } catch (error) {
      console.error('Error issuing book:', error);
      res.status(500).json({ message: 'Server error' });
  }
});

// Return book (admin only)
router.post('/return', verifyToken, isAdmin, async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    // Validate input
    if (!transactionId) {
      return res.status(400).json({ message: 'Transaction ID is required' });
    }
    
    // Check if transaction exists
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE id = ?',
      [transactionId]
    );
    
    if (transactions.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    const transaction = transactions[0];
    
    if (transaction.status !== 'issued') {
      return res.status(400).json({ message: 'Book is already returned' });
    }
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Update transaction record
      await connection.query(
        `UPDATE transactions 
         SET status = 'returned', return_date = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [transactionId]
      );
      
      // Update book available quantity
      await connection.query(
        'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
        [transaction.book_id]
      );
      
      await connection.commit();
      connection.release();
      
      res.json({ message: 'Book returned successfully' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request book issue (student)
router.post('/request', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can request books' });
    }
    
    const { bookId } = req.body;
    const studentId = req.user.studentId;
    
    if (!bookId || !studentId) {
      return res.status(400).json({ message: 'Book ID is required' });
    }
    
    // Check if book exists and is available
    const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const book = books[0];
    
    if (book.available_quantity <= 0) {
      return res.status(400).json({ message: 'Book is not available' });
    }
    
    // Check if student already has this book
    const [existingTransactions] = await pool.query(
      `SELECT * FROM transactions 
       WHERE book_id = ? AND student_id = ? AND status = 'issued'`,
      [bookId, studentId]
    );
    
    if (existingTransactions.length > 0) {
      return res.status(400).json({ message: 'You already have this book issued' });
    }
    
    // Create a request record (in a real app, this would be in a separate table)
    // For simplicity, we'll just return a success message
    res.status(201).json({ 
      message: 'Book request submitted successfully. Please contact the librarian to complete the issue process.' 
    });
  } catch (error) {
    console.error('Error requesting book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update overdue status (admin)
router.post('/update-overdue', verifyToken, isAdmin, async (req, res) => {
  try {
    // Update overdue status for all transactions
    await pool.query(`
      UPDATE transactions 
      SET status = 'overdue' 
      WHERE status = 'issued' AND due_date < CURRENT_TIMESTAMP
    `);
    
    res.json({ message: 'Overdue status updated successfully' });
  } catch (error) {
    console.error('Error updating overdue status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this route to handle extending due dates
router.put('/:id/extend', verifyToken, isAdmin, async (req, res) => {
  try {
      const transactionId = req.params.id;
      
      // Get the current transaction
      const [transaction] = await pool.query(
          'SELECT * FROM transactions WHERE id = ?',
          [transactionId]
      );

      if (transaction.length === 0) {
          return res.status(404).json({ message: 'Transaction not found' });
      }

      if (transaction[0].status !== 'issued') {
          return res.status(400).json({ message: 'Can only extend issued books' });
      }

      // Add 7 days to the current due date
      const currentDueDate = new Date(transaction[0].due_date);
      const newDueDate = new Date(currentDueDate);
      newDueDate.setDate(currentDueDate.getDate() + 7);

      // Update the due date
      await pool.query(
          'UPDATE transactions SET due_date = ? WHERE id = ?',
          [newDueDate, transactionId]
      );

      res.json({ message: 'Due date extended successfully' });
  } catch (error) {
      console.error('Error extending due date:', error);
      res.status(500).json({ message: 'Server error' });
  }
});

export default router;