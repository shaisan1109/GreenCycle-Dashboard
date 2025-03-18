import express from 'express'
import { engine } from 'express-handlebars'
import Handlebars from 'handlebars'
import cors from 'cors'

// Session
import session from 'express-session'
const store = new session.MemoryStore();

// Import database functions
import {
  getUsers, getUserByEmail, createUser, getUserById, getUsersOfRole,
  getPartners,
  getRolesOfSupertype, createClientRole,
  getApplications,
  getApplicationById
} from './database.js'

// Philippine Standard Geographic Code
import { PSGCResource } from 'psgc-areas'

// Favicon
import favicon from 'serve-favicon'

/* ---------------------------------------
    EXPRESS
--------------------------------------- */
const app = express()

// To allow CORS
app.use(cors())

// Use JSON for data format
app.use(express.json())

// Set favicon
app.use(favicon('./favicon.ico'))

// Use the public folder for assets
app.use(express.static('public'))
app.use('/pictures', express.static('pictures'));

/* ---------------------------------------
    SESSION
--------------------------------------- */
// Set session
app.use(session({
  secret: 'sussus-am0gus',
  resave: false,
  saveUninitialized: false, // bc what if the user isn't logged in yet
  store
}))

app.use((req, res, next) => {
  if (req.session.authenticated) {
    req.user = req.session.user
  }
  next()
})

app.use((req, res, next) => {
  if (req.session && req.session.user) {
    res.locals.user = req.session.user;
  } else {
      res.locals.user = null; // Avoid assigning an empty object
  }
  next()
})

// Session middleware
// Check if session user exists (i.e., user is logged in)
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
  }
  next(); // Proceed if authenticated
}

// Lock out dashboard AND its child routes for logged in users
app.use('/dashboard', requireAuth)

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
    HANDLEBARS HELPERS
--------------------------------------- */

// Render text to uppercase
Handlebars.registerHelper('uppercase', function(str) {
  return str.toUpperCase();
});

// Check if value is null
/* Ex: 
    {{#check value null}}
      {{this}}
    {{/check}}
*/
Handlebars.registerHelper('check', function(value, comparator) {
  return (value === comparator) ? '-' : value;
});

// Check if value is equal to something
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

// Check if value is NOT equal to something
Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

// Show date in text form
// Ex: 25 Mar 2015
Handlebars.registerHelper('textDate', function(date) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  
  return date.toLocaleDateString(undefined, options) 
})

/* ---------------------------------------
    ROUTES (PUBLIC)
--------------------------------------- */
app.get('/', (req, res) => {
  // testing
  if(req.session.authenticated) {
    console.log("User in res.locals:", res.locals.user)
    console.log(req.user)
  }

  res.render('home', {
    layout: 'public',
    title: 'Home | GreenCycle',
    current_home: true
  })
})

// Render login page
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login | GreenCycle'
  })
})

// Login success (called when user is ALREADY validated)
app.post('/login', async (req, res) => {
  const user = req.body;

  // Mark user as authenticated
  req.session.authenticated = true

  // Set session variables
  req.session.user = {
    id: user.user_id,
    role_id: user.role_id,
    lastname: user.lastname,
    firstname: user.firstname,
    email: user.email,
    contact_no: user.contact_no,
    org_id: user.partner_org_id,
    role_name: user.role_name,
    supertype: user.supertype
  }

  console.log(req.session.user)

  req.session.save(err => {
    if (err) {
      console.error("Session save error:", err)
    }
    res.json({ success: true, message: "Login successful" });
  })
});

app.post('/api/user', async (req, res) => {
  const email = req.body.email;
  const user = await getUserByEmail(email)
  res.send(user)
})

app.get('/register', (req, res) => {
  res.render('register', {
    title: 'Register | GreenCycle'
  })
})

app.get('/contact', (req, res) => {
  res.render('contact', {
    layout: 'public',
    title: 'Contact | GreenCycle',
    current_contact: true
  })
})

app.get('/about', (req, res) => {
  res.render('about', {
    layout: 'public',
    title: 'About | GreenCycle',
    companyName: 'GreenCycle Consultancy Agency',
    year: new Date().getFullYear(),
    current_about: true
  });
});

app.get('/partners', async (req, res) => {
  const partners = await getPartners()

  res.render('partners', {
      layout:'public',
      title: "GreenCycle - Partners",
      partners,
      current_partners: true
  });
});

/* ---------------------------------------
    ROUTES (DASHBOARD)
--------------------------------------- */

/* Testing chart.js */
app.get('/test-chart', (req, res) => {
  res.render('dashboard/test-chart', {
    layout: 'dashboard',
    title: 'Test Dashboard',
    current_test: true
  })
})

// Dashboard home page
app.get('/dashboard', (req, res) => {
  // This would typically check for authentication
  res.render('dashboard/waste-comp-main', {
    layout: 'dashboard',
    title: 'GC Dashboard | Main Dashboard',
    current_home: true
  })
})

// User routes
// Get all users
app.get('/dashboard/users', async (req, res) => {
  const users = await getUsers()
  res.render('dashboard/users', {
    layout: 'dashboard',
    title: 'GC Dashboard | Users',
    users,
    current_users: true
  })
})

// Get one user from ID (user profile)
app.get('/dashboard/profile', async (req, res) => {
  //const id = req.params.id
  //const user = await getUserById(id)

  res.render('dashboard/user-profile', {
    layout: 'dashboard',
    title: `GC Dashboard | Profile`
  })
})

// Get users of a certain role
app.get('/users/role/:roleId', async (req, res) => {
  const roleId = req.params.roleId
  const users = await getUsersOfRole(roleId)
  res.send(users)
})

// Create user form page
app.get('/dashboard/users/create', async (req, res) => {
  const gcRoles = await getRolesOfSupertype(1)

  console.log(gcRoles)

  res.render('dashboard/create-user', {
    layout: 'dashboard',
    title: 'GC Dashboard | Create New Staff Account',
    current_users: true,
    gcRoles
  });
});

// API: Add client role
app.post('/roles/client', async (req, res) => {
  const { roleName } = req.body
  const role = await createClientRole(roleName)
  res.send(role)
})

app.get('/dashboard/roles', async (req, res) => {
  const adminRoles = await getRolesOfSupertype(0)
  const gcRoles = await getRolesOfSupertype(1)
  const clientRoles = await getRolesOfSupertype(2)

  res.render('dashboard/roles', {
    layout: 'dashboard',
    title: 'GC Dashboard | Roles',
    adminRoles,
    gcRoles,
    clientRoles,
    current_roles: true
  })
})

// User applications page
app.get('/dashboard/user-applications', async (req, res) => {
  const applications = await getApplications()

  res.render('dashboard/user-applications', { 
    layout: 'dashboard',
    title: 'GC Dashboard | User Applications',
    current_userapp: true,
    applications
  })
})

// API: Fetch application from server


app.get('/dashboard/partners', async (req, res) => {
  const partners = await getPartners()
  res.render('dashboard/partners', {
    layout: 'dashboard',
    title: 'GC Dashboard | Partner Organizations',
    partners,
    current_partners: true
  })
})

app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report', {
    layout: 'dashboard',
    title: 'GC Dashboard | Submit Your Report',
    current_report: true
  })
})

// API: Get locations from json
app.get('/locations', async (req, res) => {
  // Get all location names
  const locations = await PSGCResource.getAll()
  res.send(locations)
})

// API: Create user
app.post('/users', async (req, res) => {
  const { roleId, lastName, firstName, email, password, contactNo } = req.body
  const user = await createUser(roleId, lastName, firstName, email, password, contactNo)
  res.send(user)
})

// Get one user from ID for editing
// app.get('/users/:id', async (req, res) => {
//   const id = req.params.id;
//   try {
//     const user = await getUser(id);
//     res.json(user);
//   } catch (error) {
//     res.status(404).json({ message: "User not found" });
//   }
// });

// Update user
app.patch('/users/:id', async (req, res) => {
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
app.get('/api/applications/:id', async (req, res) => {
  const id = req.params.id;
  const userApp = await getApplicationById(id)
  res.json(userApp)
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
