import express from 'express';
import { pool } from '../db.js';
import { verifyToken, isAdmin } from './auth.js';

const router = express.Router();

// Get all books
router.get('/', async (req, res) => {
  try {
    const [books] = await pool.query('SELECT * FROM books ORDER BY title');
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search books
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const searchTerm = `%${query}%`;
    
    const [books] = await pool.query(
      `SELECT * FROM books 
       WHERE title LIKE ? OR author LIKE ? OR category LIKE ? 
       ORDER BY title`,
      [searchTerm, searchTerm, searchTerm]
    );
    
    res.json(books);
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get book by ID
router.get('/:id', async (req, res) => {
  try {
    const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    res.json(books[0]);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new book (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, author, category, isbn, quantity } = req.body;
    
    // Validate input
    if (!title || !author || !category) {
      return res.status(400).json({ message: 'Title, author and category are required' });
    }
    
    // Check if ISBN already exists
    if (isbn) {
      const [existingBooks] = await pool.query('SELECT * FROM books WHERE isbn = ?', [isbn]);
      
      if (existingBooks.length > 0) {
        return res.status(400).json({ message: 'ISBN already exists' });
      }
    }
    
    const quantityNum = parseInt(quantity) || 1;
    
    const [result] = await pool.query(
      `INSERT INTO books (title, author, category, isbn, quantity, available_quantity) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, author, category, isbn || null, quantityNum, quantityNum]
    );
    
    res.status(201).json({
      message: 'Book added successfully',
      bookId: result.insertId
    });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update book (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, author, category, isbn, quantity } = req.body;
    const bookId = req.params.id;
    
    // Validate input
    if (!title || !author || !category) {
      return res.status(400).json({ message: 'Title, author and category are required' });
    }
    
    // Get current book data
    const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const currentBook = books[0];
    
    // Check if ISBN already exists (if changed)
    if (isbn && isbn !== currentBook.isbn) {
      const [existingBooks] = await pool.query(
        'SELECT * FROM books WHERE isbn = ? AND id != ?', 
        [isbn, bookId]
      );
      
      if (existingBooks.length > 0) {
        return res.status(400).json({ message: 'ISBN already exists' });
      }
    }
    
    const quantityNum = parseInt(quantity) || currentBook.quantity;
    
    // Calculate new available quantity
    const quantityDiff = quantityNum - currentBook.quantity;
    const newAvailableQuantity = currentBook.available_quantity + quantityDiff;
    
    if (newAvailableQuantity < 0) {
      return res.status(400).json({ 
        message: 'Cannot reduce quantity below number of books currently issued' 
      });
    }
    
    await pool.query(
      `UPDATE books 
       SET title = ?, author = ?, category = ?, isbn = ?, 
           quantity = ?, available_quantity = ? 
       WHERE id = ?`,
      [title, author, category, isbn || null, quantityNum, newAvailableQuantity, bookId]
    );
    
    res.json({ message: 'Book updated successfully' });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete book (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const bookId = req.params.id;
    
    // Check if book exists
    const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [bookId]);
    
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    // Check if book is currently issued
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE book_id = ? AND status = "issued"',
      [bookId]
    );
    
    if (transactions.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete book as it is currently issued to students' 
      });
    }
    
    await pool.query('DELETE FROM books WHERE id = ?', [bookId]);
    
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;