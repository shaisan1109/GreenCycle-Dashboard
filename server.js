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
  getPartners,getWasteDataWithCoordinates,
  getRolesOfSupertype, createClientRole,
  getApplications, getApplicationById, getApplicationsByEmail,
  approveApplication, rejectApplication, reconsiderApplication, revokeApproval,
  updateApplicationStatus, createApplication, resetApplicationStatus,
  deactivateUserByEmail,
  lastLogin,
  submitForm,
  getDataByLocation,
  getWasteGenById,
  getWasteCompById
} from './database.js'

// File Upload
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Philippine Standard Geographic Code
import { PSGCResource } from 'psgc-areas'

// Favicon
import favicon from 'serve-favicon'

/* ---------------------------------------
    EXPRESS
--------------------------------------- */
const app = express()

// To allow CORS
app.use(cors({ credentials: true }))

// Use JSON for data format
app.use(express.json())

// Set favicon
app.use(favicon('./favicon.ico'))

// Use the public folder for assets
app.use(express.static('public'))
app.use('/pictures', express.static('pictures'));

// Setup file uploads directory
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'verification-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

// Serve files from uploads directory
app.use('/uploads', express.static('uploads'));

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
  return str.toUpperCase()
})

// Check if value is NOT null
/* Ex: 
    {{#check value null}}
      {{this}}
    {{/check}}
*/
Handlebars.registerHelper('check', function(value, comparator) {
  return (value === comparator) ? '-' : value
})

// Check if value is equal to something
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this)
})

// Check if value is NOT equal to something
Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this)
})

// Show date in text form
// Ex: 25 Mar 2015
Handlebars.registerHelper('textDate', function(date) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  
  return date.toLocaleDateString(undefined, options) 
})

// Show datetime in text form
Handlebars.registerHelper('textDateTime', function(date) {
  // Set date string
  const dateOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  const dateString = date.toLocaleDateString(undefined, dateOptions)

  // Set time string
  const timeString = date.toLocaleTimeString("en-US")
  
  return `${dateString} ${timeString}` 
})

// Show number with commas
Handlebars.registerHelper('commaNumber', function(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
})

// Return json object
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

/* ---------------------------------------
    ROUTES (PUBLIC)
--------------------------------------- */
app.get('/', (req, res) => {
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

  // Update user's last login date
  lastLogin(user.user_id)

  // Save session
  req.session.save(err => {
    if (err) {
      console.error("Session save error:", err)
    }
    res.json({ success: true, message: "Login successful" });
  })
});

// Log out current user
app.delete('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid'); // Clear session cookie
      res.status(200).json({ message: "Logged out successfully" });
  });
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

// Client application form route
app.get('/apply', async (req, res) => {
  try {
    const clientRoles = await getRolesOfSupertype(2)
    const partners = await getPartners()
    
    res.render('application-form', {
      layout: 'public',
      title: 'Apply for Access | GreenCycle',
      current_apply: true,
      clientRoles,
      partners
    });
  } catch (error) {
    console.error('Error loading application form:', error)
    res.status(500).render('error', { 
      layout: 'public',
      message: 'Error loading application form' 
    })
  }
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

app.get('/dashboard/data/:id', async (req, res) => {
  const id = req.params.id
  const wasteGen = await getWasteGenById(id)
  const wasteComp = await getWasteCompById(id)

  res.render('dashboard/view-data', {
    layout: 'dashboard',
    title: `GC Dashboard | Entry #${id}`,
    wasteGen,
    wasteComp,
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

app.get('/dashboard/partners', async (req, res) => {
  const partners = await getPartners()
  res.render('dashboard/partners', {
    layout: 'dashboard',
    title: 'GC Dashboard | Partner Organizations',
    partners,
    current_partners: true
  })
})

app.get('/tests', async (req, res) => {
  try {
      const wasteData = await getWasteDataWithCoordinates();
      console.log("Fetched Waste Data:", wasteData); // Debugging output

      res.render('tests', {
          layout: 'public',
          title: 'Test Table',
          wasteData 
      });
  } catch (error) {
      console.error("Error fetching waste data:", error);
      res.status(500).send("Internal Server Error");
  }
});

app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report', {
    layout: 'dashboard',
    title: 'GC Dashboard | Submit Your Report',
    current_report: true
  })
})

// API: Submit data form to SQL
const wasteMaterialMap = {
  "paper": 1,
  "glass": 2,
  "metal": 3,
  "plastic": 4,
  "kitchen_waste": 5,
  "hazardous_waste": 6,
  "electrical_waste": 7,
  "organic": 8,
  "inorganic": 9
};

const wasteOriginMap = {
  "Residential": 1,
  "Commercial": 2,
  "Institutional": 3,
  "Industrial": 4,
  "Health": 5,
  "Livestock": 6 // Corrected to match "Agricultural and Livestock"
};

app.post("/submit-report", async (req, res) => {
  try {
    console.log("Received payload:", req.body); // Debugging line
    const { name, company_name, region, province, municipality, barangay, 
        population, per_capita, annual, date_submitted, year_collected, 
        date_start, date_end, location_id, wasteComposition } = req.body;

    const formattedWasteComposition = wasteComposition.map((entry) => {
        console.log(entry);

        if (!entry.material_name || !entry.origin) {
            console.error("Missing name or origin in:", entry);
            return null;  // Skip this entry
        }

        return {
            material_id: wasteMaterialMap[entry.material_name.toLowerCase()] || null,
            origin_id: Number(entry.origin) || null,
            waste_amount: entry.waste_amount || 0,  // Ensure weight is always a number
            subtype_remarks: entry.subtype_remarks || null
        };
    }).filter(entry => entry !== null); // Remove any invalid entries

    console.log(formattedWasteComposition);

    // Submit form data
    const result = await submitForm(
        name, company_name, region, province, municipality, barangay, 
        population, per_capita, annual, date_submitted, 
        year_collected, date_start, date_end, formattedWasteComposition
    );

    // 🔹 Fetch updated waste data after submitting the report
    const wasteData = await getWasteDataWithCoordinates();
    console.log("Updated waste data:", wasteData);

    res.status(200).json({
        message: "Report submitted successfully",
        reportResult: result,
        updatedWasteData: wasteData
    });

  } catch (error) {
    console.error("Error processing report:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});



// API: Get locations from json
app.get('/locations', async (req, res) => {
  // Get all location names
  const locations = await PSGCResource.getAll()
  res.send(locations)
})

app.get('/test-locations', async (req, res) => {
  // Get all location names
  const [municipalities, cities] = await Promise.all([
    PSGCResource.getMunicipalities(),
    PSGCResource.getCities()
  ]);

  const locations = { municipalities, cities };
  res.send(locations)
})

// API: Create user
app.post('/users', async (req, res) => {
  const { roleId, lastName, firstName, email, password, contactNo } = req.body
  const user = await createUser(roleId, lastName, firstName, email, password, contactNo)
  res.send(user)
})

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

/* ---------------------------------------
    USER APPLICATION API ENDPOINTS
--------------------------------------- */

// API: Submit new application
app.post('/api/applications', upload.single('verificationDoc'), async (req, res) => {
  try {
    const { firstName, lastName, email, contactNo } = req.body
    
    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }

    // Check if email already exists in users
    const existingUser = await getUserByEmail(email);
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }
    
    // Check for existing applications with the same email
    const existingApplications = await getApplicationsByEmail(email);
    if (existingApplications && existingApplications.length > 0) {
      const pendingApp = existingApplications.find(app => app.status === 'Pending Review');
      if (pendingApp) {
        return res.status(400).json({ success: false, message: 'You already have a pending application' });
      }
    }
    
    // Get uploaded file path (if any)
    const verificationDoc = req.file ? req.file.filename : null
    
    // Create the application
    const result = await createApplication(
      firstName, lastName, email, contactNo, verificationDoc
    )
    
    res.status(201).json({ 
      success: true, 
      message: 'Application submitted successfully',
      data: result 
    })
  } catch (error) {
    console.error('Error submitting application:', error)
    
    // If file was uploaded but application creation failed, remove the file
    if (req.file) {
      fs.unlink(path.join(uploadDir, req.file.filename), (err) => {
        if (err) console.error('Error deleting file:', err)
      })
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while submitting your application' 
    })
  }
})

// API: Get all applications
app.get('/api/applications', async (req, res) => {
  try {
    const applications = await getApplications()
    res.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    res.status(500).json({ success: false, message: 'Error fetching applications' })
  }
})

// API: Get single application
app.get('/api/applications/:id', async (req, res) => {
  try {
    const id = req.params.id
    const application = await getApplicationById(id)
    
    if (!application || application.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' })
    }
    
    res.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
    res.status(500).json({ success: false, message: 'Error fetching application' })
  }
})

// API: Update application status
app.put('/api/applications/:id/status', async (req, res) => {
  try {
    const id = req.params.id
    const { status, adminNotes } = req.body
    
    // Basic validation
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' })
    }
    
    let result
    
    if (status === 'Approved') {
      // Approve application and create user
      result = await approveApplication(id, adminNotes || '')
    } else if (status === 'Rejected') {
      // Reject application
      result = await rejectApplication(id, adminNotes || '')
    } else if (status === 'Pending Review') {
      // Reset to pending
      result = await resetApplicationStatus(id, adminNotes || '')
    } else {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }
    
    res.json({ 
      success: true,
      message: `Application ${id} status updated to ${status}`,
      data: result
    })
  } catch (error) {
    console.error('Error updating application status:', error)
    res.status(500).json({ 
      success: false,
      message: 'Error updating application status' 
    })
  }
})

// API: Update application notes
app.put('/api/applications/:id/notes', async (req, res) => {
  try {
    const id = req.params.id
    const { adminNotes } = req.body
    
    // Update admin notes in database using the existing status
    const application = await getApplicationById(id);
    if (!application || application.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    
    const result = await updateApplicationStatus(id, application[0].status, adminNotes)
    
    res.json({ 
      success: true,
      message: 'Notes updated successfully',
      data: result
    })
  } catch (error) {
    console.error('Error updating notes:', error)
    res.status(500).json({ 
      success: false,
      message: 'Error updating notes' 
    })
  }
})

// Get waste data from a location
app.get('/api/waste-data/:location', async (req, res) => {
  try {
    const location = req.params.location
    const dataEntries = await getDataByLocation(location)
    
    if (!dataEntries || dataEntries.length === 0) {
      return res.status(404).json({ success: false, message: 'Data not found' })
    }
    
    res.json(dataEntries)
  } catch (error) {
    console.error('Error fetching data:', error)
    res.status(500).json({ success: false, message: 'Error fetching data' })
  }
})

// 404 page: for routes that do not match any of the above
// NOTE: HAS TO ALWAYS BE THE LAST ROUTE
app.get('*', function(req, res){
  res.render('not-found', {
    layout: 'public',
    title: '404: Page Not Found'
  })
})

/* ---------------------------------------
    APP LISTENER
--------------------------------------- */
const port = 3000
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
