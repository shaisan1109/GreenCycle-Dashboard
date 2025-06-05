import express from 'express'
import { engine } from 'express-handlebars'
import Handlebars from 'handlebars'
import cors from 'cors'

// Session
import session from 'express-session'
const store = new session.MemoryStore();

// Import database functions
import {
  getUsers, getUserByEmail, createUser, getUsersOfRole,
  getPartners,getWasteDataWithCoordinates,
  getRolesOfSupertype, createClientRole,
  getApplications, getApplicationById, getApplicationsByEmail,
  approveApplication, rejectApplication, reconsiderApplication, revokeApproval,
  updateApplicationStatus, createApplication, resetApplicationStatus,
  deactivateUserByEmail,
  lastLogin,
  getSectors, submitForm,
  getDataByLocation,
  getWasteGenById, getWasteCompById, getDataByStatus,
  getWasteSupertypes,
  getWasteTypes,
  getDataByUser,
  getPsgcName,
  updateDataStatus,
  getDataForReview,
  getAllTypes
} from './database.js'

// File Upload
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Philippine Standard Geographic Code
import { PSGCResource } from 'psgc-areas'

// Favicon
import favicon from 'serve-favicon'

// SheetJS
import * as XLSX from 'xlsx'

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
})

// Default value fallback (e.g., 0)
Handlebars.registerHelper('default', (value, fallback) => value != null ? value : fallback);

// Add helper for data entry colspan
Handlebars.registerHelper('add', (a, b) => a + b);

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
    supertype: user.supertype,
    company: user.company_name
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
  res.render('dashboard/view-data-search', {
    layout: 'dashboard',
    title: 'GC Dashboard | Main Dashboard',
    current_home: true
  })
})

// Get all approved data entries
app.get('/dashboard/data/all', async (req, res) => {
  const data = await getDataByStatus('Approved')

  res.render('dashboard/view-data-all', {
    layout: 'dashboard',
    title: 'GC Dashboard | All Data Entries',
    data,
    current_all: true
  })
})

app.get('/dashboard/data/submissions', async (req, res) => {
  const currentUser = req.session.user.id
  const data = await getDataForReview(currentUser)

  res.render('dashboard/view-data-all', {
    layout: 'dashboard',
    title: 'GC Dashboard | Data Submissions for Review',
    data,
    current_datasubs: true
  })
})

// Get all data entries by one user
app.get('/dashboard/data/user/:id', async (req, res) => {
  const user = Number(req.session.user.id)
  const data = await getDataByUser(user)

  res.render('dashboard/view-data-all', {
    layout: 'dashboard',
    title: 'GC Dashboard | Your Reports',
    data,
    current_user_report: true
  })
})

// View one data entry (for review)
app.get('/dashboard/data/review/:id', async (req, res) => {
  const entryId = req.params.id
  const reviewer = req.session.user.id
  const wasteGen = await getWasteGenById(entryId)

  const sectors = await getSectors()
  const supertypes = await getWasteSupertypes()
  const types = await getWasteTypes()

  // Map types to supertypes
  for (const supertype of supertypes) {
    supertype.types = types.filter(t => t.supertype_id === supertype.id)
  }

  //const wasteComp = await getWasteCompById(entryId)

  res.render('dashboard/view-data-review', {
    layout: 'dashboard',
    title: `GC Dashboard | Entry #${entryId}`,
    wasteGen,
    //wasteComp,
    current_datasubs: true,
    sectors,
    supertypes,
    types,
    entryId,
    reviewer
  })
})

// View one data entry
app.get('/dashboard/data/:id', async (req, res) => {
  /* -------- INITIALIZATION -------- */

  // Initialize main data entry
  const id = req.params.id
  const wasteGen = await getWasteGenById(id)

  // Initialize waste comp
  const sectors = await getSectors()
  const supertypes = await getAllTypes()
  const wasteComp = await getWasteCompById(id)

  // Create a lookup map for waste amounts
  const wasteMap = {};
  for (const row of wasteComp) {
      if (!wasteMap[row.type_id]) wasteMap[row.type_id] = {};
      wasteMap[row.type_id][row.sector_id] = row.waste_amount;
  }

  /* -------- TABLE INITIALIZATION -------- */

  // Group types under supertypes
  const supertypeMap = {};
  for (const row of supertypes) {
      if (!supertypeMap[row.supertype_id]) {
          supertypeMap[row.supertype_id] = {
              id: row.supertype_id,
              name: row.supertype_name,
              types: []
          };
      }
      supertypeMap[row.supertype_id].types.push({
          id: row.type_id,
          name: row.type_name,
          amounts: wasteMap[row.type_id] || {}
      });
  }

  // Grand total (for "percentage" column) for each type
  let grandTotal = 0;

  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      const amounts = type.amounts || {};
      const total = Object.values(amounts).reduce((a, b) => a + Number(b), 0);
      type.totalWeight = total;
      grandTotal += total;
    }
  }

  // Compute percentage for each type's total weight
  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      type.percentage = grandTotal > 0
        ? ((type.totalWeight / grandTotal) * 100).toFixed(3)
        : '0.000';
    }
  }

  // Grand total of all sectors
  // -- Initialize sector totals
  const sectorTotals = {}; // { sector_id: total }
  for (const sector of sectors) {
    sectorTotals[sector.id] = 0;
  }

  // -- Sum up sector values
  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      for (const [sectorIdStr, value] of Object.entries(type.amounts || {})) {
        const sectorId = Number(sectorIdStr);
        sectorTotals[sectorId] += Number(value);
      }
    }
  }

  /* -------- PIE CHART -------- */

  // Total per supertype
  const supertypeTotals = {}; // { supertype_id: totalWaste }

  for (const row of supertypes) {
    const typeId = row.type_id;
    const supertypeId = row.supertype_id;

    const amounts = wasteMap[typeId] || {};
    const typeTotal = Object.values(amounts).reduce((a, b) => a + Number(b), 0);

    if (!supertypeTotals[supertypeId]) supertypeTotals[supertypeId] = 0;
    supertypeTotals[supertypeId] += typeTotal;
  }

  // Map to { labels: [], data: [] }
  const pieData = {
      labels: [],
      data: []
  };
  const supertypeNames = {};

  for (const row of supertypes) {
      supertypeNames[row.supertype_id] = row.supertype_name;
  }

  // Sort supertypes from highest to lowest
  const sortedSupertypes = Object.entries(supertypeTotals)
    .map(([id, total]) => ({ name: supertypeNames[id], total: Number(total) }))
    .sort((a, b) => b.total - a.total);

  for (const item of sortedSupertypes) {
      pieData.labels.push(item.name);
      pieData.data.push(item.total);
  }

  //res.json(supertypeMap)

  /* -------- RENDER PAGE -------- */

  res.render('dashboard/view-data-entry', {
    layout: 'dashboard',
    title: `GC Dashboard | Entry #${id}`,
    wasteGen,
    current_all: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    pieData: JSON.stringify(pieData), // pass as JSON for Chart.js
    sectorTotals,
    grandTotal: grandTotal.toFixed(3)
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

// Data submission menu
app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report-menu', {
    layout: 'dashboard',
    title: 'GC Dashboard | Data Submission Menu',
    current_report: true
  })
})

// Submit data by manual form
app.get('/dashboard/submit-report/form', async (req, res) => {
  const sectors = await getSectors()
  const supertypes = await getWasteSupertypes()
  const types = await getWasteTypes()

  // Map types to supertypes
  for (const supertype of supertypes) {
    supertype.types = types.filter(t => t.supertype_id === supertype.id)
  }

  res.render('dashboard/data-form', {
    layout: 'dashboard',
    title: 'GC Dashboard | Data Submission Form',
    current_report: true,
    sectors,
    supertypes,
    types
  })
})

// Submit data by uploading a spreadsheet
app.get('/dashboard/submit-report/upload', async (req, res) => {
  res.render('dashboard/data-upload', {
    layout: 'dashboard',
    title: 'GC Dashboard | Upload Data Spreadsheet',
    current_report: true
  })
})

app.post("/submit-report", async (req, res) => {
  // Request body
  const {
    region, province, municipality, population, per_capita, annual, date_start, date_end, wasteComposition
  } = req.body;

  // Prepare PSGC data for location names
  const psgcRegions = await PSGCResource.getRegions()
  const psgcProvinces = await PSGCResource.getProvinces()
  const psgcMunicipalities = await PSGCResource.getMunicipalities()
  const psgcCities = await PSGCResource.getCities()

  // Get location names
  const regionName = getPsgcName(psgcRegions, region)
  const provinceName = getPsgcName(psgcProvinces, province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || null

  // Set full location name
  const parts = [municipalityName, provinceName, regionName].filter(Boolean)
  const fullLocation = parts.join(', ')

  try {
    // Format waste composition entries for insertion to DB
    const newWasteComp = wasteComposition.map((entry) => {
        return {
          sector_id: entry.sector_id,
          type_id: entry.type_id,
          waste_amount: Number(entry.waste_amount) || 0,  // Ensure weight is always a number
        };
    }).filter(entry => entry !== null); // Remove any invalid entries

    // Submit form data
    const result = await submitForm(
      req.session.user.id, region, province, municipality, fullLocation, population, per_capita, annual, date_start, date_end, newWasteComp
    );

    res.status(200).json({
        message: "Report submitted successfully",
        reportResult: result,
        //updatedWasteData: wasteData
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

/* ---------------------------------------
    DATA REVIEW API ENDPOINTS
--------------------------------------- */

app.patch('/api/data/:id/status', async (req, res) => {
  try {
    const id = req.params.id
    const { status, rejectionReason, reviewedBy } = req.body
    
    // Basic validation
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' })
    }
    
    let result = await updateDataStatus(id, status, rejectionReason || '', reviewedBy)
    
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
