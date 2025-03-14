import express from 'express'
import { engine } from 'express-handlebars'

// Import database functions
import { getUsers, getUser, createUser } from './database.js'

// Philippine Standard Geographic Code
import { PSGCResource } from 'psgc-areas'

// Favicon
import favicon from 'serve-favicon'

/* ---------------------------------------
    EXPRESS
--------------------------------------- */
const app = express()

// Use JSON for data format
app.use(express.json())

// Set favicon
app.use(favicon('./favicon.ico'))

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

/* Testing chart.js */
app.get('/test-chart', (req, res) => {
  res.render('dashboard/test-chart', {
    layout: 'dashboard',
    title: 'Test Dashboard'
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

app.get('/partners', (req, res) => {
  res.render('partners', {
      layout:'public',
      title: "GreenCycle - Partners",
      partners: [
          {
              name: "Unilever Philippines",
              logo: "/pictures/Unilever.png",
              description: "Unilever Philippines announced its partnership with Greencycle Innovations Inc. with the ambition to deliver above the 20% plastic waste diversion target for the EPR law’s first-year implementation.",
              website: "https://www.unilever.com.ph/"
          },
          {
              name: "Universal Robina Corp.",
              logo: "/pictures/URC.png",
              description: "Food manufacturer Universal Robina Corp. (URC) teamed up with Greencycle Innovative Solutions, Inc. for its waste management program. Through the joint venture, the parties aim to formulate an integrated operation or ecosystem that incorporates the reduction of plastic waste through collection, treatment and processing of waste materials and convert it into reusable or recyclable products.",
              website: "https://www.urc.com.ph/"
          },
          {
              name: "CEMEX Philippines",
              logo: "/pictures/cemex.png",
              description: "CEMEX Philippines signed a tripartite agreement with Plastic Credit Exchange (PCX) and Greencycle to further strengthen its commitment to reduce its carbon footprint and contribute to a circular economy. The agreement supports end-to-end plastic waste reduction processes, starting from plastic waste collection, consolidation, aggregation, treatment, and concluding in co-processing, preventing them from ending up in landfills, bodies of water, or the environment.",
              website: "https://www.cemexholdingsphilippines.com/"
          }
      ]
  });
});


// Dashboard home page
app.get('/dashboard', (req, res) => {
  // This would typically check for authentication
  res.render('dashboard/waste-comp-main', {
    layout: 'dashboard',
    title: 'GC Dashboard | Main Dashboard'
  })
})


// User routes
// Get all users
app.get('/dashboard/users', async (req, res) => {
  // const users = await getUsers()
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
  })
})

app.get('/dashboard/partners', async (req, res) => {
  //const users = await getUsers()
  res.render('dashboard/partners', {
    layout: 'dashboard',
    title: 'GC Dashboard | Partner Organizations'
  })
  //res.send(users)
})

// API: Get locations from json
app.get('/locations', async (req, res) => {
  // Get all location names
  const locations = await PSGCResource.getAll()
  res.send(locations)
})

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
