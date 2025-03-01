# Library Management System

A full-featured library management system built with vanilla JavaScript, Node.js, Express, and MySQL.

## Features

- User authentication (Admin/Student)
- Book management (Add, Edit, Delete)
- Student management 
- Book issue/return tracking
- Search functionality
- Responsive design

## Prerequisites

- Node.js (v14+)
- MySQL (v8+)
- Git

## Database Setup

1. Log into MySQL:
```bash
mysql -u root -p
```

2. Create the database:
```sql
CREATE DATABASE library_management;
USE library_management;
```

3. Grant permissions (if needed):
```sql
GRANT ALL PRIVILEGES ON library_management.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

4. The tables will be automatically created when you first run the application, including:
- users (admin/student accounts)
- students (student profiles)
- books (book inventory)
- transactions (book issues/returns)

## Installation & Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd library-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Create MySQL database and configure `.env`:
```
# Update these values in .env file
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=library_management
JWT_SECRET=your_jwt_secret
```

4. Initialize the database:
```bash
npm start
```

5. Access the application:
- Open `http://localhost:3000` in your browser
- Default admin credentials:
    - Username: admin
    - Password: admin123

## Usage

### Admin Features
- Manage books (add/edit/delete)
- Manage students (add/edit/delete)
- Issue/return books
- View all transactions
- Track overdue books

### Student Features
- Browse available books
- Request books
- View issued books
- Check due dates
- Update profile

## Project Structure

```
├── backend/
│   ├── routes/         # API routes
│   ├── db.js          # Database configuration
│   └── server.js      # Express server
├── frontend/
│   ├── admin.html     # Admin dashboard
│   ├── student.html   # Student dashboard
│   └── styles.css     # Stylesheets
└── package.json
```

## Credits

This project was developed with the assistance of:

- [Bolt.new](https://bolt.new) - Project scaffolding and development environment
- GitHub Copilot - AI-assisted coding

*Note: This was a freelancing project developed with AI assistance while maintaining code quality and best practices.*

## License

This project is licensed under the MIT License - see the LICENSE file for details.