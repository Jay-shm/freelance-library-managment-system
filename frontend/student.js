// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const studentNameElement = document.getElementById('student-name');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

// Stats Elements
const booksIssuedElement = document.getElementById('books-issued');
const booksOverdueElement = document.getElementById('books-overdue');
const totalBooksElement = document.getElementById('total-books');

// Tables
const recentBooksTable = document.getElementById('recent-books-table');
const booksTable = document.getElementById('books-table');
const myBooksTable = document.getElementById('my-books-table');

// Profile Elements
const profileUsername = document.getElementById('profile-username');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profilePhone = document.getElementById('profile-phone');
const profileAddress = document.getElementById('profile-address');

// Buttons
const bookSearchBtn = document.getElementById('book-search-btn');

// API URL
const API_URL = '/api';

// Check Authentication
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token || user.role !== 'student' || !user.studentId) {
    window.location.href = '/';
    return false;
  }
  
  // Set student name
  studentNameElement.textContent = user.name || user.username || 'Student';
  
  return true;
}

// API Request Helper
async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = localStorage.getItem('token');
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || 'API request failed');
  }
  
  return result;
}

// Format Date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Navigation
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const sectionId = link.getAttribute('data-section');
    
    // Remove active class from all links and sections
    navLinks.forEach(l => l.classList.remove('active'));
    contentSections.forEach(s => s.classList.remove('active'));
    
    // Add active class to selected link and section
    link.classList.add('active');
    document.getElementById(`${sectionId}-section`).classList.add('active');
  });
});

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
});

// Load Dashboard Data
async function loadDashboardData() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Get all books
    const books = await apiRequest('/books');
    totalBooksElement.textContent = books.length;
    
    // Get student's books
    const myBooks = await apiRequest(`/students/${user.studentId}/books`);
    
    // Count issued and overdue books
    const issuedBooks = myBooks.filter(b => b.status === 'issued').length;
    const overdueBooks = myBooks.filter(b => b.status === 'overdue').length;
    
    booksIssuedElement.textContent = issuedBooks;
    booksOverdueElement.textContent = overdueBooks;
    
    // Load recent books
    const recentBooks = myBooks.slice(0, 5);
    
    const recentBooksHTML = recentBooks.map(book => `
      <tr>
        <td>${book.title}</td>
        <td>${formatDate(book.issue_date)}</td>
        <td>${formatDate(book.due_date)}</td>
        <td>
          <span class="status-badge ${book.status}">
            ${book.status.charAt(0).toUpperCase() + book.status.slice(1)}
          </span>
        </td>
      </tr>
    `).join('');
    
    recentBooksTable.querySelector('tbody').innerHTML = recentBooksHTML || '<tr><td colspan="4">No books issued</td></tr>';
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    alert('Failed to load dashboard data');
  }
}

// Load Books
async function loadBooks() {
  try {
    const books = await apiRequest('/books');
    
    const booksHTML = books.map(book => `
      <tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category}</td>
        <td>${book.available_quantity > 0 ? 'Yes' : 'No'}</td>
        <td>
          ${book.available_quantity > 0 ? 
            `<button class="btn btn-small request-book-btn" data-id="${book.id}">Request</button>` : 
            '<button class="btn btn-small" disabled>Unavailable</button>'}
        </td>
      </tr>
    `).join('');
    
    booksTable.querySelector('tbody').innerHTML = booksHTML || '<tr><td colspan="5">No books found</td></tr>';
    
    // Add event listeners to request buttons
    document.querySelectorAll('.request-book-btn').forEach(btn => {
      btn.addEventListener('click', () => requestBook(btn.getAttribute('data-id')));
    });
  } catch (error) {
    console.error('Error loading books:', error);
    alert('Failed to load books');
  }
}

// Load My Books
async function loadMyBooks() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const myBooks = await apiRequest(`/students/${user.studentId}/books`);
    
    const myBooksHTML = myBooks.map(book => `
      <tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${formatDate(book.issue_date)}</td>
        <td>${formatDate(book.due_date)}</td>
        <td>
          <span class="status-badge ${book.status}">
            ${book.status.charAt(0).toUpperCase() + book.status.slice(1)}
          </span>
        </td>
      </tr>
    `).join('');
    
    myBooksTable.querySelector('tbody').innerHTML = myBooksHTML || '<tr><td colspan="5">No books issued</td></tr>';
  } catch (error) {
    console.error('Error loading my books:', error);
    alert('Failed to load my books');
  }
}

// Load Profile
async function loadProfile() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const studentData = await apiRequest(`/students/${user.studentId}`);
    
    profileUsername.textContent = studentData.username;
    profileName.textContent = studentData.name;
    profileEmail.textContent = studentData.email;
    profilePhone.textContent = studentData.phone || 'Not provided';
    profileAddress.textContent = studentData.address || 'Not provided';
  } catch (error) {
    console.error('Error loading profile:', error);
    alert('Failed to load profile');
  }
}

// Request Book
async function requestBook(bookId) {
  try {
    await apiRequest('/transactions/request', 'POST', { bookId });
    alert('Book request submitted successfully. Please contact the librarian to complete the issue process.');
  } catch (error) {
    console.error('Error requesting book:', error);
    alert(`Failed to request book: ${error.message}`);
  }
}

// Search Books
bookSearchBtn.addEventListener('click', async () => {
  const query = document.getElementById('book-search').value.trim();
  
  if (!query) {
    loadBooks();
    return;
  }
  
  try {
    const books = await apiRequest(`/books/search?query=${encodeURIComponent(query)}`);
    
    const booksHTML = books.map(book => `
      <tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.category}</td>
        <td>${book.available_quantity > 0 ? 'Yes' : 'No'}</td>
        <td>
          ${book.available_quantity > 0 ? 
            `<button class="btn btn-small request-book-btn" data-id="${book.id}">Request</button>` : 
            '<button class="btn btn-small" disabled>Unavailable</button>'}
        </td>
      </tr>
    `).join('');
    
    booksTable.querySelector('tbody').innerHTML = booksHTML || '<tr><td colspan="5">No books found</td></tr>';
    
    // Add event listeners to request buttons
    document.querySelectorAll('.request-book-btn').forEach(btn => {
      btn.addEventListener('click', () => requestBook(btn.getAttribute('data-id')));
    });
  } catch (error) {
    console.error('Error searching books:', error);
    alert('Failed to search books');
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  
  loadDashboardData();
  loadBooks();
  loadMyBooks();
  loadProfile();
});