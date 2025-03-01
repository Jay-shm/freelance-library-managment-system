// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// API URL
const API_URL = '/api';

// Tab Switching
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    
    // Remove active class from all tabs
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to selected tab
    btn.classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Clear messages
    loginMessage.textContent = '';
    loginMessage.className = 'message';
    registerMessage.textContent = '';
    registerMessage.className = 'message';
  });
});

// Login Form Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password, role })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store token and user data in localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Redirect based on role
    if (role === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/student';
    }
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.className = 'message error';
  }
});

// Register Form Submission
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const address = document.getElementById('reg-address').value;
  
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password, name, email, phone, address })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    registerMessage.textContent = 'Registration successful! You can now login.';
    registerMessage.className = 'message success';
    
    // Clear form
    registerForm.reset();
    
    // Switch to login tab after successful registration
    setTimeout(() => {
      tabBtns[0].click();
    }, 2000);
  } catch (error) {
    registerMessage.textContent = error.message;
    registerMessage.className = 'message error';
  }
});

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (token && user) {
    // Redirect based on role
    if (user.role === 'admin') {
      window.location.href = '/admin';
    } else if (user.role === 'student') {
      window.location.href = '/student';
    }
  }
});