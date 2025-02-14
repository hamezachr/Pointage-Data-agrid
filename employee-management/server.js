const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// Initialize the app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Hamza_13579',
  database: 'pointage',
  port: 4200 // MySQL default port
});

// Connect to MySQL
db.connect(err => {
  if (err) throw err;
  console.log('MySQL connected...');
});

// POST endpoint to add an employee
app.post('/add-employee', [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('cin').notEmpty().withMessage('CIN is required'),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail(),
  body('dob').optional().isISO8601(),
  body('type_employe').notEmpty().withMessage('Type is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { first_name, last_name, cin, phone, email, dob,type_employe } = req.body;
  const checkSql = 'SELECT * FROM Ouvriers WHERE CIN = ?';
  db.query(checkSql, [cin], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send({ message: 'Server error' });
    }
    if (results.length > 0) {
      console.warn('Employee with this CIN already exists:', cin);
      return res.status(409).send({ message: 'Employee with this CIN already exists.' });
    }

    const sqlOuvriers = 'INSERT INTO Ouvriers (first_name, last_name, CIN, telephone, email, date_de_naissance,type_employe) VALUES (?, ?, ?, ?, ?, ?,?)';
    db.query(sqlOuvriers, [first_name, last_name, cin, phone, email, dob,type_employe], (err, result) => {
      if (err) {
        console.error('Error adding employee:', err);
        return res.status(500).send({ message: 'Error adding employee' });
      }

      const login = email;
      const password = 'NULL';
      const sqlUtilisateurs = 'INSERT INTO Utilisateurs (login, password, first_name, last_name, email) VALUES (?, ?, ?, ?, ?)';
      db.query(sqlUtilisateurs, [login, password, first_name, last_name, email], (err, result) => {
        if (err) {
          console.error('Error adding user:', err);
          return res.status(500).send({ message: 'Error adding user' });
        }
        res.send({ message: 'Employee and user added successfully.' });
      });
    });
  });
});

// GET endpoint to fetch all employees
app.get('/api/employees', (req, res) => {
  const sql = 'SELECT id, first_name, last_name, CIN, telephone, email, date_de_naissance FROM Ouvriers';
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send({ message: 'Error fetching employees' });
    } else {
      res.json(results);
    }
  });
});

// DELETE endpoint to remove an employee by ID
app.delete('/api/employees/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM Ouvriers WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ message: 'Error deleting employee' });
    } else if (result.affectedRows === 0) {
      res.status(404).send({ message: 'Employee not found' });
    } else {
      res.send({ message: 'Employee deleted successfully' });
    }
  });
});

// GET endpoint to fetch an employee by CIN
app.get('/api/employees/cin/:cin', (req, res) => {
  const cin = req.params.cin;
  const sql = 'SELECT * FROM Ouvriers WHERE CIN = ?';
  db.query(sql, [cin], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send({ message: 'Error fetching employee by CIN' });
    } else if (results.length === 0) {
      res.status(404).send({ message: 'Employee not found' });
    } else {
      res.json(results[0]);
    }
  });
});

// PUT endpoint to update an employee by CIN
app.put('/api/employees/:cin', (req, res) => {
  const cin = req.params.cin;
  const { first_name, last_name, telephone, email, date_de_naissance } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).send({ message: "First name and last name are required" });
  }

  // Update Ouvriers table
  const sqlOuvriers = 'UPDATE Ouvriers SET first_name = ?, last_name = ?, telephone = ?, email = ?, date_de_naissance = ? WHERE CIN = ?';
  db.query(sqlOuvriers, [first_name, last_name, telephone || null, email || null, date_de_naissance || null, cin], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ message: 'Error updating employee' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Employee not found' });
    }

    // Update Utilisateurs table
    const sqlUtilisateurs = 'UPDATE Utilisateurs SET first_name = ?, last_name = ?, email = ? WHERE login = (SELECT email FROM Ouvriers WHERE CIN = ?)';
    db.query(sqlUtilisateurs, [first_name, last_name, email || null, cin], (err, result) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).send({ message: 'Error updating user' });
      }
      res.send({ message: 'Employee and user updated successfully' });
    });
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  console.log('Login request received:', req.body); // Log received data
  const { login, password } = req.body;
  const query = `
    SELECT u.*, o.id as employeeId, o.type_employe 
    FROM Utilisateurs u 
    JOIN Ouvriers o ON u.login = o.email 
    WHERE u.login = ?
  `;

  db.query(query, [login], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send({ error: 'Database error' });
    }

    if (results.length > 0) {
      const user = results[0];
      console.log('User found:', user); // Debugging output

      if (user.password === 'NULL') {
        return res.send({ password: 'NULL', userId: user.login, employeeId: user.employeeId });
      } else {
        // Compare the provided password with the hashed password stored in the database
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
            console.error('Error comparing passwords:', err);
            return res.status(500).send({ error: 'Error comparing passwords' });
          }

          if (isMatch) {
            return res.send({
              message: 'Login successful',
              userId: user.login,
              employeeId: user.employeeId, // Return employeeId here
              user: {
                login: user.login,
                firstName: user.first_name,
                lastName: user.last_name,
                typeEmploye: user.type_employe // Include type_employe in response
              }
            });
          } else {
            console.log('Invalid password'); // Debugging output
            return res.status(401).send({ error: 'Invalid password' });
          }
        });
      }
    } else {
      console.log('User not found:', login); // Debugging output
      return res.status(404).send({ error: 'User not found' });
    }
  });
});



// Log entry endpoint
app.post('/log-entry', (req, res) => {
  const { userId } = req.body;

  // Fetch the worker ID using the email
  const workerQuery = 'SELECT id FROM Ouvriers WHERE email = ?';
  db.query(workerQuery, [userId], (workerErr, workerResults) => {
    if (workerErr) {
      console.error('Database error:', workerErr);
      return res.status(500).send({ error: 'Database error' });
    }

    if (workerResults.length > 0) {
      const workerId = workerResults[0].id;

      // Insert a new record into the Pointage table
      const insertQuery = 'INSERT INTO Pointage (date_heure_entree, ouvrier_entree) VALUES (NOW(), ?)';
      db.query(insertQuery, [workerId], (insertErr, insertResults) => {
        if (insertErr) {
          console.error('Error logging entry:', insertErr);
          return res.status(500).send({ error: 'Error logging entry' });
        }

        console.log(`Entry logged for worker ID ${workerId} with pointage ID ${insertResults.insertId}`);
        return res.send({ message: 'Entry logged successfully', pointageId: insertResults.insertId });
      });
    } else {
      console.error('Worker not found for email:', userId);
      return res.status(404).send({ error: 'Worker not found' });
    }
  });
});


// GET endpoint to fetch hours worked today
app.get('/api/employee/:id/hours-worked-today', (req, res) => {
  const employeeId = req.params.id;  // Get the employee ID from the request parameters
  console.log(`Fetching hours worked today for employeeId: ${employeeId}`);
  
  const sql = `
    SELECT 
      SUM(TIMESTAMPDIFF(MINUTE, date_heure_entree, date_heure_sortie)) AS hours_worked_today
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND DATE(date_heure_entree) = CURDATE()
  `;
  
  db.query(sql, [employeeId], (err, results) => {
    if (err) {
      console.error('Error fetching today\'s hours:', err);
      return res.status(500).send({ message: 'Server error' });
    }
    res.json({ hours_worked_today: results[0].hours_worked_today || 0 });
  });
});



// GET endpoint to fetch hours worked this week
app.get('/api/employee/:id/hours-worked-this-week', (req, res) => {
  const employeeId = req.params.id;
  console.log(`Fetching hours worked today for employeeId: ${employeeId}`);
  const sql = `
    SELECT 
      SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS hours_worked_this_week
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND YEARWEEK(date_heure_entree, 1) = YEARWEEK(CURDATE(), 1)
  `;
  
  db.query(sql, [employeeId], (err, results) => {
    if (err) {
      console.error('Error fetching this week\'s hours:', err);
      return res.status(500).send({ message: 'Server error' });
    }
    res.json({ hours_worked_this_week: results[0].hours_worked_this_week || 0 });
  });
});

// GET endpoint to fetch hours worked this month
app.get('/api/employee/:id/hours-worked-this-month', (req, res) => {
  const employeeId = req.params.id;
  const sql = `
    SELECT 
      SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS hours_worked_this_month
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND MONTH(date_heure_entree) = MONTH(CURDATE())
    AND YEAR(date_heure_entree) = YEAR(CURDATE())
  `;
  
  db.query(sql, [employeeId], (err, results) => {
    if (err) {
      console.error('Error fetching this month\'s hours:', err);
      return res.status(500).send({ message: 'Server error' });
    }
    res.json({ hours_worked_this_month: results[0].hours_worked_this_month || 0 });
  });
});

// Log exit endpoint
app.post('/log-exit', (req, res) => {
  const { userId } = req.body;

  // Fetch the worker ID using the email
  const workerQuery = 'SELECT id FROM Ouvriers WHERE email = ?';
  db.query(workerQuery, [userId], (workerErr, workerResults) => {
    if (workerErr) {
      console.error('Database error:', workerErr);
      return res.status(500).send({ error: 'Database error' });
    }

    if (workerResults.length > 0) {
      const workerId = workerResults[0].id;

      // Fetch the latest Pointage entry for this worker that has a NULL date_heure_sortie
      const pointageQuery = 'SELECT id FROM Pointage WHERE ouvrier_entree = ? AND date_heure_sortie IS NULL ORDER BY date_heure_entree DESC LIMIT 1';
      db.query(pointageQuery, [workerId], (pointageErr, pointageResults) => {
        if (pointageErr) {
          console.error('Database error:', pointageErr);
          return res.status(500).send({ error: 'Database error' });
        }

        if (pointageResults.length > 0) {
          const pointageId = pointageResults[0].id;

          // Update the latest Pointage entry for this worker
          const updateQuery = 'UPDATE Pointage SET date_heure_sortie = NOW(), ouvrier_sortie = ? WHERE id = ?';
          db.query(updateQuery, [workerId, pointageId], (updateErr, updateResults) => {
            if (updateErr) {
              console.error('Database error:', updateErr);
              return res.status(500).send({ error: 'Database error' });
            }

            console.log(`Exit logged for worker ID ${workerId} at pointage ID ${pointageId}`);
            return res.send({ message: 'Exit logged successfully' });
          });
        } else {
          console.error(`No entry found for worker ID ${workerId}`);
          return res.status(404).send({ error: 'No entry found for worker' });
        }
      });
    } else {
      console.error('Worker not found for email:', userId);
      return res.status(404).send({ error: 'Worker not found' });
    }
  });
});
app.get('/api/employee/:id/hours-summary', (req, res) => {
  const employeeId = req.params.id;
  
  const sqlToday = `
    SELECT SUM(TIMESTAMPDIFF(MINUTE, date_heure_entree, date_heure_sortie)) AS hours_worked_today
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND DATE(date_heure_entree) = CURDATE()
  `;
  
  const sqlThisWeek = `
    SELECT SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS hours_worked_this_week
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND YEARWEEK(date_heure_entree, 1) = YEARWEEK(CURDATE(), 1)
  `;
  
  const sqlThisMonth = `
    SELECT SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS hours_worked_this_month
    FROM Pointage
    WHERE ouvrier_entree = ?
    AND MONTH(date_heure_entree) = MONTH(CURDATE())
    AND YEAR(date_heure_entree) = YEAR(CURDATE())
  `;
  
  db.query(sqlToday, [employeeId], (err, resultToday) => {
    if (err) return res.status(500).send(err);
    
    db.query(sqlThisWeek, [employeeId], (err, resultWeek) => {
      if (err) return res.status(500).send(err);
      
      db.query(sqlThisMonth, [employeeId], (err, resultMonth) => {
        if (err) return res.status(500).send(err);
        
        res.json({
          today: resultToday[0].hours_worked_today || 0,
          thisWeek: resultWeek[0].hours_worked_this_week || 0,
          thisMonth: resultMonth[0].hours_worked_this_month || 0
        });
      });
    });
  });
});

// Fetch KPI data for dashboard
app.get('/api/kpi-data', (req, res) => {
  const { startDate, endDate } = req.query;

  const sqlTotalHours = `
    SELECT SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS total_hours 
    FROM Pointage
    WHERE date_heure_entree BETWEEN ? AND ?
  `;
  
  const sqlAvgHours = `
    SELECT AVG(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS avg_hours 
    FROM Pointage
    WHERE date_heure_entree BETWEEN ? AND ?
  `;
  
  const sqlTotalDays = `
    SELECT COUNT(DISTINCT DATE(date_heure_entree)) AS total_days
    FROM Pointage
    WHERE date_heure_entree BETWEEN ? AND ?
  `;
  
  const sqlTopWorkers = `
    SELECT o.first_name, o.last_name, SUM(TIMESTAMPDIFF(HOUR, date_heure_entree, date_heure_sortie)) AS total_hours
    FROM Pointage p
    JOIN Ouvriers o ON p.ouvrier_entree = o.id
    WHERE date_heure_entree BETWEEN ? AND ?
    GROUP BY o.id
    ORDER BY total_hours DESC
    LIMIT 10
  `;
  
  db.query(sqlTotalHours, [startDate, endDate], (err, totalHoursResult) => {
    if (err) return res.status(500).send(err);
    
    db.query(sqlAvgHours, [startDate, endDate], (err, avgHoursResult) => {
      if (err) return res.status(500).send(err);
      
      db.query(sqlTotalDays, [startDate, endDate], (err, totalDaysResult) => {
        if (err) return res.status(500).send(err);
        
        db.query(sqlTopWorkers, [startDate, endDate], (err, topWorkersResult) => {
          if (err) return res.status(500).send(err);
          
          res.json({
            total_hours: totalHoursResult[0].total_hours || 0,
            avg_hours: avgHoursResult[0].avg_hours || 0,
            total_days: totalDaysResult[0].total_days || 0,
            top_workers: topWorkersResult
          });
        });
      });
    });
  });
});

// Generate QR code for worker
app.get('/api/generate-qr/:id', (req, res) => {
  const workerId = req.params.id;

  const sql = 'SELECT * FROM Ouvriers WHERE id = ?';
  db.query(sql, [workerId], (err, results) => {
    if (err) return res.status(500).send(err);

    if (results.length > 0) {
      const qr = require('qr-image');
      const code = qr.image(results[0].CIN, { type: 'png' });
      res.type('png');
      code.pipe(res);
    } else {
      res.status(404).send({ message: 'Worker not found' });
    }
  });
});

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.post('/create-password', (req, res) => {
  const { login, newPassword } = req.body;

  // Hash the new password
  bcrypt.hash(newPassword, saltRounds, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).send({ message: 'Error hashing password' });
    }

    // Update the password in the database
    const sqlUpdatePassword = 'UPDATE Utilisateurs SET password = ? WHERE login = ?';
    db.query(sqlUpdatePassword, [hashedPassword, login], (err, result) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).send({ message: 'Error updating password' });
      }

      res.send({ message: 'New password created successfully!' });
    });
  });
});



// Start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});
