// Constants and DOM Elements
const API_URL = '/api';
const logoutBtn = document.getElementById('logout-btn');
const adminNameElement = document.getElementById('admin-name');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

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

// Authentication Check
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'admin') {
        window.location.href = '/';
        return false;
    }
    
    // Set admin name
    adminNameElement.textContent = user.username || 'Admin';
    return true;
}

// Format Date Helper
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Admin Dashboard Object
const adminDashboard = {
    books: [],
    students: [],
    transactions: [],

    init() {
        this.setupEventListeners();
        this.setupAdditionalEventListeners();
        this.loadDashboardData();
        this.loadBooks();
        this.loadStudents();
        this.loadTransactions();
    },

    setupEventListeners() {
        // Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const sectionId = link.getAttribute('data-section');
                this.switchSection(sectionId);
            });
        });

        // Book Management
        document.getElementById('add-book-btn').addEventListener('click', () => this.showAddBookModal());
        document.getElementById('add-book-form').addEventListener('submit', (e) => this.handleAddBook(e));
        document.getElementById('edit-book-form').addEventListener('submit', (e) => this.handleEditBook(e));
        document.getElementById('book-search-btn').addEventListener('click', () => this.searchBooks());

        // Student Management
        document.getElementById('add-student-btn').addEventListener('click', () => this.showAddStudentModal());
        document.getElementById('add-student-form').addEventListener('submit', (e) => this.handleAddStudent(e));
        document.getElementById('edit-student-form').addEventListener('submit', (e) => this.handleEditStudent(e));

        // Transaction Management
        document.getElementById('issue-book-btn').addEventListener('click', () => this.showIssueBookModal());
        document.getElementById('issue-book-form').addEventListener('submit', (e) => this.handleIssueBook(e));
        document.getElementById('update-overdue-btn').addEventListener('click', () => this.updateOverdueStatus());

        // Modal Close Buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Logout
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        });
    },

    switchSection(sectionId) {
        navLinks.forEach(link => link.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));
        
        document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');
        document.getElementById(`${sectionId}-section`).classList.add('active');
    },

    async loadDashboardData() {
        try {
            const [books, students, transactions] = await Promise.all([
                apiRequest('/books'),
                apiRequest('/students'),
                apiRequest('/transactions')
            ]);

            // Update dashboard stats
            document.getElementById('total-books').textContent = books.length;
            document.getElementById('total-students').textContent = students.length;
            document.getElementById('books-issued').textContent = transactions.filter(t => t.status === 'issued').length;
            document.getElementById('overdue-books').textContent = transactions.filter(t => t.status === 'overdue').length;

            // Display recent transactions
            this.displayRecentTransactions(transactions.slice(0, 5));
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            alert('Failed to load dashboard data');
        }
    },

    async loadBooks() {
        try {
            this.books = await apiRequest('/books');
            this.displayBooks();
        } catch (error) {
            console.error('Error loading books:', error);
            alert('Failed to load books');
        }
    },

    async loadStudents() {
        try {
            this.students = await apiRequest('/students');
            this.displayStudents();
        } catch (error) {
            console.error('Error loading students:', error);
            alert('Failed to load students');
        }
    },

    async loadTransactions() {
        try {
            // Remove the duplicate '/api' since it's already in API_URL constant
            const response = await apiRequest('/transactions');
            
            // Ensure we're handling the response correctly
            if (response && Array.isArray(response)) {
                this.transactions = response;
            } else if (response && response.data) {
                this.transactions = response.data;
            } else {
                this.transactions = [];
            }
    
            console.log('Loaded transactions:', this.transactions); // Debug log
            this.displayTransactions();
        } catch (error) {
            console.error('Error loading transactions:', error);
            const tbody = document.querySelector('#transactions-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7">Failed to load transactions</td></tr>';
            }
        }
    },

    displayBooks() {
        const tbody = document.querySelector('#books-table tbody');
        tbody.innerHTML = this.books.map(book => `
            <tr>
                <td>${book.title}</td>
                <td>${book.author}</td>
                <td>${book.category}</td>
                <td>${book.isbn || 'N/A'}</td>
                <td>${book.quantity}</td>
                <td>${book.available_quantity}</td>
                <td>
                    <button class="btn btn-small" onclick="adminDashboard.editBook(${book.id})">Edit</button>
                    <button class="btn btn-small" onclick="adminDashboard.deleteBook(${book.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    },

    displayStudents() {
        const tbody = document.querySelector('#students-table tbody');
        tbody.innerHTML = this.students.map(student => `
            <tr>
                <td>${student.name}</td>
                <td>${student.username}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td>
                    <button class="btn btn-small" onclick="adminDashboard.editStudent(${student.id})">Edit</button>
                    <button class="btn btn-small" onclick="adminDashboard.deleteStudent(${student.id})">Delete</button>
                    <button class="btn btn-small" onclick="adminDashboard.viewStudentBooks(${student.id})">View Books</button>
                </td>
            </tr>
        `).join('');
    },

    displayTransactions() {
        const tbody = document.querySelector('#transactions-table tbody');
        if (!tbody) {
            console.error('Transactions table not found');
            return;
        }
    
        if (!Array.isArray(this.transactions)) {
            console.error('Invalid transactions data:', this.transactions);
            tbody.innerHTML = '<tr><td colspan="7">Invalid transaction data</td></tr>';
            return;
        }
    
        if (this.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No transactions found</td></tr>';
            return;
        }
        
        try {
            tbody.innerHTML = this.transactions.map(transaction => `
                <tr>
                    <td>${this.safeText(transaction.book_title)}</td>
                    <td>${this.safeText(transaction.student_name)}</td>
                    <td>${formatDate(transaction.issue_date)}</td>
                    <td>${formatDate(transaction.due_date)}</td>
                    <td>${this.formatReturnDate(transaction)}</td>
                    <td>
                        <span class="status-badge ${this.getStatusClass(transaction.status)}">
                            ${this.formatStatus(transaction.status)}
                        </span>
                    </td>
                    <td>
                        ${this.getActionButtons(transaction)}
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error displaying transactions:', error);
            tbody.innerHTML = '<tr><td colspan="7">Error displaying transactions</td></tr>';
        }
    },

    displayRecentTransactions(transactions) {
        const tbody = document.querySelector('#recent-transactions-table tbody');
        tbody.innerHTML = transactions.map(transaction => `
            <tr>
                <td>${transaction.book_title}</td>
                <td>${transaction.student_name}</td>
                <td>${formatDate(transaction.issue_date)}</td>
                <td>${formatDate(transaction.due_date)}</td>
                <td>
                    <span class="status-badge ${transaction.status}">
                        ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </span>
                </td>
            </tr>
        `).join('');
    },

    // Modal Management
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    },

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    },

    // Book Management Methods
    showAddBookModal() {
        document.getElementById('add-book-form').reset();
        this.showModal('add-book-modal');
    },

    async handleAddBook(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const bookData = Object.fromEntries(formData.entries());

        try {
            await apiRequest('/books', 'POST', bookData);
            this.closeModals();
            this.loadBooks();
            alert('Book added successfully');
        } catch (error) {
            console.error('Error adding book:', error);
            alert(`Failed to add book: ${error.message}`);
        }
    },

    async editBook(bookId) {
        try {
            const book = this.books.find(b => b.id === bookId);
            if (!book) {
                throw new Error('Book not found');
            }
    
            // Get the form and populate it
            const form = document.getElementById('edit-book-form');
            
            // Make sure form field names match your backend expectations
            const formFields = {
                'book_id': book.id,
                'title': book.title,
                'author': book.author,
                'category': book.category,
                'isbn': book.isbn || '',
                'quantity': book.quantity
            };
    
            // Set form values
            Object.keys(formFields).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) {
                    input.value = formFields[key];
                }
            });
    
            this.showModal('edit-book-modal');
        } catch (error) {
            console.error('Error preparing edit form:', error);
            alert(`Failed to load book details: ${error.message}`);
        }
    },

    async handleEditBook(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const bookId = formData.get('book_id');
    
        try {
            // Prepare the update data
            const bookData = {
                title: formData.get('title'),
                author: formData.get('author'),
                category: formData.get('category'),
                isbn: formData.get('isbn'),
                quantity: parseInt(formData.get('quantity'))
            };
    
            // Log the request for debugging
            console.log('Updating book:', bookId, bookData);
    
            // Make the API request
            await apiRequest(`/books/${bookId}`, 'PUT', bookData);
            
            this.closeModals();
            await this.loadBooks();
            alert('Book updated successfully');
        } catch (error) {
            console.error('Error updating book:', error);
            alert(`Failed to update book: ${error.message}`);
        }
    },

    async deleteBook(bookId) {
        if (!confirm('Are you sure you want to delete this book?')) return;

        try {
            await apiRequest(`/books/${bookId}`, 'DELETE');
            this.loadBooks();
            alert('Book deleted successfully');
        } catch (error) {
            console.error('Error deleting book:', error);
            alert(`Failed to delete book: ${error.message}`);
        }
    },

    async searchBooks() {
        const query = document.getElementById('book-search').value.trim();
        if (!query) {
            this.loadBooks();
            return;
        }

        try {
            this.books = await apiRequest(`/books/search?query=${encodeURIComponent(query)}`);
            this.displayBooks();
        } catch (error) {
            console.error('Error searching books:', error);
            alert('Failed to search books');
        }
    },

    // Add these methods inside the adminDashboard object, before the init() method

    // Student Management Methods
    showAddStudentModal() {
        document.getElementById('add-student-form').reset();
        this.showModal('add-student-modal');
    },

    async handleAddStudent(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studentData = Object.fromEntries(formData.entries());

        try {
            await apiRequest('/students', 'POST', studentData);
            this.closeModals();
            this.loadStudents();
            alert('Student added successfully');
        } catch (error) {
            console.error('Error adding student:', error);
            alert(`Failed to add student: ${error.message}`);
        }
    },

    async editStudent(studentId) {
        try {
            const student = this.students.find(s => s.id === studentId);
            if (!student) {
                throw new Error('Student not found');
            }
    
            const form = document.getElementById('edit-student-form');
            
            // Update form fields
            form.querySelector('[name="id"]').value = student.id;
            form.querySelector('[name="username"]').value = student.username;
            form.querySelector('[name="password"]').value = ''; // Clear password field for security
            form.querySelector('[name="name"]').value = student.name;
            form.querySelector('[name="email"]').value = student.email;
            form.querySelector('[name="phone"]').value = student.phone || '';
    
            this.showModal('edit-student-modal');
        } catch (error) {
            console.error('Error preparing edit form:', error);
            alert(`Failed to load student details: ${error.message}`);
        }
    },
    
    async handleEditStudent(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const studentId = formData.get('id');
        const password = formData.get('password');
    
        try {
            const studentData = {
                username: formData.get('username'),
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone')
            };
    
            // Only include password if it was provided
            if (password.trim()) {
                studentData.password = password;
            }
    
            console.log('Updating student:', studentId, studentData); // Debug log
    
            await apiRequest(`/students/${studentId}`, 'PUT', studentData);
            
            this.closeModals();
            await this.loadStudents();
            alert('Student updated successfully');
        } catch (error) {
            console.error('Error updating student:', error);
            alert(`Failed to update student: ${error.message}`);
        }
    },

    async deleteStudent(studentId) {
        if (!confirm('Are you sure you want to delete this student?')) return;

        try {
            await apiRequest(`/students/${studentId}`, 'DELETE');
            this.loadStudents();
            alert('Student deleted successfully');
        } catch (error) {
            console.error('Error deleting student:', error);
            alert(`Failed to delete student: ${error.message}`);
        }
    },

    async viewStudentBooks(studentId) {
        try {
            const books = await apiRequest(`/students/${studentId}/books`);
            const student = this.students.find(s => s.id === studentId);
            
            const tbody = document.querySelector('#student-books-table tbody');
            tbody.innerHTML = books.map(book => `
                <tr>
                    <td>${book.title}</td>
                    <td>${book.issue_date}</td>
                    <td>${book.due_date}</td>
                    <td>${book.status}</td>
                </tr>
            `).join('');

            document.getElementById('student-books-name').textContent = student.name;
            this.showModal('student-books-modal');
        } catch (error) {
            console.error('Error loading student books:', error);
            alert('Failed to load student books');
        }
    },

    // Update these methods in the adminDashboard object
    // ================= Book Transactions =================

// Load Transactions
// Fix the loadTransactions method
async loadTransactions() {
    try {
        // Remove the duplicate '/api' since it's already in API_URL constant
        const response = await apiRequest('/transactions');
        
        // Ensure we're handling the response correctly
        if (response && Array.isArray(response)) {
            this.transactions = response;
        } else if (response && response.data) {
            this.transactions = response.data;
        } else {
            this.transactions = [];
        }

        console.log('Loaded transactions:', this.transactions); // Debug log
        this.displayTransactions();
    } catch (error) {
        console.error('Error loading transactions:', error);
        const tbody = document.querySelector('#transactions-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7">Failed to load transactions</td></tr>';
        }
    }
},

// Improve transaction display with better error handling
displayTransactions() {
    const tbody = document.querySelector('#transactions-table tbody');
    if (!tbody) {
        console.error('Transactions table not found');
        return;
    }

    if (!Array.isArray(this.transactions)) {
        console.error('Invalid transactions data:', this.transactions);
        tbody.innerHTML = '<tr><td colspan="7">Invalid transaction data</td></tr>';
        return;
    }

    if (this.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No transactions found</td></tr>';
        return;
    }
    
    try {
        tbody.innerHTML = this.transactions.map(transaction => `
            <tr>
                <td>${this.safeText(transaction.book_title)}</td>
                <td>${this.safeText(transaction.student_name)}</td>
                <td>${formatDate(transaction.issue_date)}</td>
                <td>${formatDate(transaction.due_date)}</td>
                <td>${this.formatReturnDate(transaction)}</td>
                <td>
                    <span class="status-badge ${this.getStatusClass(transaction.status)}">
                        ${this.formatStatus(transaction.status)}
                    </span>
                </td>
                <td>
                    ${this.getActionButtons(transaction)}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error displaying transactions:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error displaying transactions</td></tr>';
    }
},

// Add helper methods for better code organization and safety
safeText(text) {
    if (!text) return 'N/A';
    return text.replace(/[<>&"']/g, char => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
},

formatReturnDate(transaction) {
    const returnDate = transaction.return_date || transaction.returnDate;
    return returnDate ? formatDate(returnDate) : 'Not Returned';
},

getStatusClass(status) {
    if (!status) return 'unknown';
    return status.toLowerCase().trim();
},

formatStatus(status) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
},

// Add these methods to the adminDashboard object
async returnBook(transactionId) {
    if (!confirm('Are you sure you want to return this book?')) {
        return;
    }

    try {
        // Call the return book endpoint
        await apiRequest(`/transactions/return`, 'POST', { transactionId });
        
        // Reload all necessary data
        await Promise.all([
            this.loadTransactions(),
            this.loadBooks(),
            this.loadDashboardData()
        ]);
        
        alert('Book returned successfully');
    } catch (error) {
        console.error('Error returning book:', error);
        alert(`Failed to return book: ${error.message}`);
    }
},

// Update the getActionButtons method
getActionButtons(transaction) {
    const status = (transaction.status || '').toLowerCase();
    if (status === 'issued') {
        return `
            <button class="btn btn-small return-btn" 
                onclick="adminDashboard.returnBook(${transaction.id})"
                data-transaction-id="${transaction.id}">
                Return
            </button>
            <button class="btn btn-small extend-btn" 
                onclick="adminDashboard.extendDueDate(${transaction.id})"
                data-transaction-id="${transaction.id}">
                Extend
            </button>
        `;
    }
    return '';
},

// Add to setupEventListeners method
setupAdditionalEventListeners() {
    // Add event delegation for dynamic buttons
    document.querySelector('#transactions-table').addEventListener('click', (e) => {
        if (e.target.classList.contains('return-btn')) {
            const transactionId = parseInt(e.target.dataset.transactionId);
            this.returnBook(transactionId);
        } else if (e.target.classList.contains('extend-btn')) {
            const transactionId = parseInt(e.target.dataset.transactionId);
            this.extendDueDate(transactionId);
        }
    });
},

// Add/update these methods in the adminDashboard object
// Update the handleIssueBook method
// Update the handleIssueBook method
async handleIssueBook(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    // Get values using correct field names
    const bookId = formData.get('bookId');
    const studentId = formData.get('studentId');
    const dueDate = formData.get('dueDate');

    // Validate form data
    if (!bookId || !studentId || !dueDate) {
        console.log('Missing fields:', { bookId, studentId, dueDate });
        alert('Please fill in all required fields');
        return;
    }

    try {
        // Prepare issue data with correct field names
        const issueData = {
            bookId: parseInt(bookId),
            studentId: parseInt(studentId),
            dueDate: dueDate
        };

        console.log('Sending issue request:', issueData); // Debug log

        // Use apiRequest helper instead of direct fetch
        await apiRequest('/transactions/issue', 'POST', issueData);

        this.closeModals();
        await Promise.all([
            this.loadTransactions(),
            this.loadBooks(),
            this.loadDashboardData()
        ]);
        
        form.reset();
        alert('Book issued successfully');
    } catch (error) {
        console.error('Error issuing book:', error);
        // Try to get more details about the error
        if (error.response) {
            console.log('Error response:', await error.response.text());
        }
        alert(`Failed to issue book: ${error.message}`);
    }
},

// Update showIssueBookModal method to set default due date

// Update the issue book modal HTML structure

// Improve issue book modal with validation
// Add to showIssueBookModal method before populating dropdowns
showIssueBookModal() {
    const form = document.getElementById('issue-book-form');
    if (!form) {
        console.error('Issue book form not found');
        return;
    }
    form.reset();

    // Set default due date (current date + 5 days)
    const dueDateInput = form.querySelector('[name="dueDate"]');
    if (dueDateInput) {
        const today = new Date();
        const defaultDueDate = new Date(today);
        defaultDueDate.setDate(today.getDate() + 5);
        dueDateInput.min = today.toISOString().split('T')[0];
        dueDateInput.value = defaultDueDate.toISOString().split('T')[0];
    }

    try {
        this.populateBookDropdown(form);
        this.populateStudentDropdown(form);
        this.showModal('issue-book-modal');
    } catch (error) {
        console.error('Error showing issue book modal:', error);
        alert('Failed to prepare issue book form');
    }
},

// Add helper methods for dropdown population
populateBookDropdown(form) {
    const bookSelect = form.querySelector('[name="issue-book-id"]');
    if (!bookSelect) return;

    const availableBooks = this.books.filter(book => book.available_quantity > 0);
    if (availableBooks.length === 0) {
        bookSelect.innerHTML = '<option value="">No books available</option>';
        return;
    }

    bookSelect.innerHTML = `
        <option value="">Select a book</option>
        ${availableBooks.map(book => `
            <option value="${book.id}">
                ${this.safeText(book.title)} (${book.available_quantity} available)
            </option>
        `).join('')}
    `;
},

populateStudentDropdown(form) {
    const studentSelect = form.querySelector('[name="issue-student-id"]');
    if (!studentSelect) return;

    if (this.students.length === 0) {
        studentSelect.innerHTML = '<option value="">No students available</option>';
        return;
    }

    studentSelect.innerHTML = `
        <option value="">Select a student</option>
        ${this.students.map(student => `
            <option value="${student.id}">${this.safeText(student.name)}</option>
        `).join('')}
    `;
},

    // Update the populateBookDropdown method
populateBookDropdown(form) {
    // Fix: Update selector to match HTML form field name
    const bookSelect = form.querySelector('[name="bookId"]');
    if (!bookSelect) {
        console.error('Book select element not found');
        return;
    }

    const availableBooks = this.books.filter(book => book.available_quantity > 0);
    if (availableBooks.length === 0) {
        bookSelect.innerHTML = '<option value="">No books available</option>';
        return;
    }

    bookSelect.innerHTML = `
        <option value="">Select a book</option>
        ${availableBooks.map(book => `
            <option value="${book.id}">
                ${this.safeText(book.title)} (${book.available_quantity} available)
            </option>
        `).join('')}
    `;
},

// Add this method to the adminDashboard object
async extendDueDate(transactionId) {
    if (!confirm('Do you want to extend the due date by 7 days?')) {
        return;
    }

    try {
        // Call the extend endpoint
        await apiRequest(`/transactions/${transactionId}/extend`, 'PUT');
        
        // Reload transactions to show updated due date
        await Promise.all([
            this.loadTransactions(),
            this.loadDashboardData()
        ]);
        
        alert('Due date extended successfully');
    } catch (error) {
        console.error('Error extending due date:', error);
        alert(`Failed to extend due date: ${error.message}`);
    }
},

// Update the populateStudentDropdown method
populateStudentDropdown(form) {
    // Fix: Update selector to match HTML form field name
    const studentSelect = form.querySelector('[name="studentId"]');
    if (!studentSelect) {
        console.error('Student select element not found');
        return;
    }

    if (this.students.length === 0) {
        studentSelect.innerHTML = '<option value="">No students available</option>';
        return;
    }

    studentSelect.innerHTML = `
        <option value="">Select a student</option>
        ${this.students.map(student => `
            <option value="${student.id}">${this.safeText(student.name)}</option>
        `).join('')}
    `;
},
    // Initialize
    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.loadBooks();
        this.loadStudents();
        this.loadTransactions();
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    adminDashboard.init();
});

// Make adminDashboard available globally for event handlers
window.adminDashboard = adminDashboard;

// Add search functionality for books and students
const bookSearchBtn = document.getElementById('book-search-btn');
const studentSearchBtn = document.getElementById('student-search-btn');

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
                <td>${book.isbn || 'N/A'}</td>
                <td>${book.quantity}</td>
                <td>${book.available_quantity}</td>
                <td>
                    <button class="btn btn-small" onclick="adminDashboard.editBook(${book.id})">Edit</button>
                    <button class="btn btn-small" onclick="adminDashboard.deleteBook(${book.id})">Delete</button>
                </td>
            </tr>
        `).join('');
        
        document.querySelector('#books-table tbody').innerHTML = booksHTML || '<tr><td colspan="7">No books found</td></tr>';
    } catch (error) {
        console.error('Error searching books:', error);
        alert('Failed to search books');
    }
});

// Search Students  
studentSearchBtn.addEventListener('click', async () => {
    const query = document.getElementById('student-search').value.trim();
    
    if (!query) {
        loadStudents();
        return;
    }
    
    try {
        const students = await apiRequest(`/students/search?query=${encodeURIComponent(query)}`);
        
        const studentsHTML = students.map(student => `
            <tr>
                <td>${student.name}</td>
                <td>${student.username}</td>
                <td>${student.email}</td>
                <td>${student.phone || 'N/A'}</td>
                <td>
                    <button class="btn btn-small" onclick="adminDashboard.editStudent(${student.id})">Edit</button>
                    <button class="btn btn-small" onclick="adminDashboard.deleteStudent(${student.id})">Delete</button>
                    <button class="btn btn-small" onclick="adminDashboard.viewStudentBooks(${student.id})">View Books</button>
                </td>
            </tr>
        `).join('');

        document.querySelector('#students-table tbody').innerHTML = studentsHTML || '<tr><td colspan="5">No students found</td></tr>';
    } catch (error) {
        console.error('Error searching students:', error);
        alert('Failed to search students');
    }
});

// Export the adminDashboard object for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { adminDashboard };
}

// Add this at the top of admin.js, replace the existing apiRequest function
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
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

        // Ensure endpoint starts with '/'
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${API_URL}${normalizedEndpoint}`;
        
        console.log(`Making ${method} request to:`, url, options); // Debug log
        
        const response = await fetch(url, options);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }
        
        return result;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}