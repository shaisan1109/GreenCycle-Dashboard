import express from 'express'
import { engine } from 'express-handlebars'
// Import database functions
import { getUsers, getUser, createUser } from './database.js'
const app = express()
// Use JSON for data format
app.use(express.json())
// Use the public folder for assets
app.use(express.static('public'))
app.use('/pictures', express.static('pictures'));
/* ---------------------------------------
    HANDLEBARS
--------------------------------------- */
app.engine('hbs', engine({
  extname: ".hbs",
  layoutsDir: 'views/layouts'  // Explicitly set layouts directory
}))
app.set('view engine', 'hbs')
app.set('views', 'views') // set 'views' folder as HBS view directory
/* ---------------------------------------
    ROUTES
--------------------------------------- */
app.get('/', (req, res) => {
  res.render('home', {
    layout: 'public',
    title: 'Home | GreenCycle'
  })
})
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login | GreenCycle'
  })
})
app.get('/register', (req, res) => {
  res.render('register', {
    title: 'Register | GreenCycle'
  })
})
app.get('/contact', (req, res) => {
  res.render('contact', {
    layout: 'public',
    title: 'Contact | GreenCycle'
  })
})
// Define route to render Handlebars template
app.get('/about', (req, res) => {
  res.render('about', {
    layout: 'public',
    title: 'About | GreenCycle',
    companyName: 'GreenCycle Consultancy Agency',
    year: new Date().getFullYear()
  });
});
// Dashboard home page
app.get('/dashboard', (req, res) => {
  // This would typically check for authentication
  res.render('users', {
    layout: 'dashboard',
    title: 'GC Dashboard | Users'
  })
})
// User routes
// Get all users
app.get('/dashboard/users', async (req, res) => {
  const users = await getUsers()
  res.render('users', {
    layout: 'dashboard',
    title: 'GC Dashboard | Users'
  })
  //res.send(users)
})
// Create user form page
app.get('/dashboard/users/create', (req, res) => {
  res.render('create-user', {
    layout: 'dashboard',
    title: 'GC Dashboard | Create User'
  });
});
app.get('/dashboard/roles', async (req, res) => {
  //const users = await getUsers()
  res.render('dashboard/roles', {
    layout: 'dashboard',
    title: 'GC Dashboard | Roles'
  })
  //res.send(users)
})
// User applications page
app.get('/dashboard/user-applications', (req, res) => {
  res.render('user-applications', { 
    layout: 'dashboard',
    title: 'GC Dashboard | User Applications'
  });
});
// Get one user from ID
app.get('/user/:id', async (req, res) => {
  const id = req.params.id
  const user = await getUser(id)
  res.send(user)
})
// Create user
app.post('/users', async (req, res) => {
  const { roleId, lastName, firstName, email, password } = req.body
  const user = await createUser(roleId, lastName, firstName, email, password)
  res.send(user)
})
// Get one user from ID for editing
app.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const user = await getUser(id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ message: "User not found" });
  }
});
// Update user
app.put('/users/:id', async (req, res) => {
  const id = req.params.id;
  const { roleId, lastName, firstName, email, password, contactNo, status } = req.body;
  
  try {
    // This would call your database update function
    // For now we'll just return success
    // const user = await updateUser(id, roleId, lastName, firstName, email, password, contactNo, status);
    res.json({ id, message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating user" });
  }
});
// Delete user
app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    // This would call your database delete function
    // For now we'll just return success
    // await deleteUser(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user" });
  }
});
// User Application API endpoints
// Get all applications
app.get('/api/applications', (req, res) => {
  // This would fetch from database
  // For now, return sample data
  const applications = [
    {
      id: "APP001",
      name: "SANTOS, Juan",
      email: "juan.santos@example.com",
      contact: "+63 (123) 456 7890",
      date: "Mar 1, 2025",
      status: "pending"
    },
    {
      id: "APP002",
      name: "MENDOZA, Maria",
      email: "maria.mendoza@example.com",
      contact: "+63 (234) 567 8901",
      date: "Mar 2, 2025",
      status: "pending"
    },
    {
      id: "APP003",
      name: "CRUZ, Roberto",
      email: "roberto.cruz@example.com",
      contact: "+63 (345) 678 9012",
      date: "Feb 28, 2025",
      status: "approved"
    },
    {
      id: "APP004",
      name: "REYES, Ana",
      email: "ana.reyes@example.com",
      contact: "+63 (456) 789 0123",
      date: "Feb 27, 2025",
      status: "rejected"
    }
  ];
  
  res.json(applications);
});
// Get single application
app.get('/api/applications/:id', (req, res) => {
  const id = req.params.id;
  // This would fetch from database
  // For now, return sample data
  const applications = {
    "APP001": {
      id: "APP001",
      name: "SANTOS, Juan",
      email: "juan.santos@example.com",
      contact: "+63 (123) 456 7890",
      date: "Mar 1, 2025",
      status: "pending",
      notes: ""
    },
    "APP002": {
      id: "APP002",
      name: "MENDOZA, Maria",
      email: "maria.mendoza@example.com",
      contact: "+63 (234) 567 8901",
      date: "Mar 2, 2025",
      status: "pending",
      notes: ""
    },
    "APP003": {
      id: "APP003", 
      name: "CRUZ, Roberto",
      email: "roberto.cruz@example.com",
      contact: "+63 (345) 678 9012",
      date: "Feb 28, 2025",
      status: "approved",
      notes: "Valid ID provided. All information verified."
    },
    "APP004": {
      id: "APP004",
      name: "REYES, Ana",
      email: "ana.reyes@example.com",
      contact: "+63 (456) 789 0123",
      date: "Feb 27, 2025",
      status: "rejected",
      notes: "Incomplete documentation."
    }
  };
  
  if (applications[id]) {
    res.json(applications[id]);
  } else {
    res.status(404).json({ message: "Application not found" });
  }
});
// Update application status
app.put('/api/applications/:id', (req, res) => {
  const id = req.params.id;
  const { status, notes } = req.body;
  
  // This would update in database
  // For now, just return success
  res.json({ 
    id, 
    status,
    message: `Application ${id} status updated to ${status}` 
  });
});
/* ---------------------------------------
    APP LISTENER
--------------------------------------- */
const port = 3000
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
