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
  getAllTypes,
  wrongPassword,
  getEditHistory,
  getLatestEdit,
  createEditEntry,
  getLatestDataEntry,
  getPendingApplicationCount,
  getDataForReviewCount,
  getAvgInfo,
  getAvgWasteComposition
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

// Set notifs for logged in users
const loginSetup = async (req, res, next) => {
  try {
    // Ensure user is authenticated
    if (!req.session || !req.session.user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
    } else if (req.session && req.session.user) {
      // Retrieve data from DB (replace with your DB query)
      const pendingApplications = await getPendingApplicationCount()
      const pendingData = await getDataForReviewCount(req.session.user.id)

      // Make it available to views and routes
      res.locals.pendingApplications = pendingApplications
      res.locals.pendingData = pendingData
    }

    next();
  } catch (err) {
    next(err);
  }
};

// Lock out dashboard AND its child routes for logged in users
app.use('/dashboard', loginSetup)

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
  if (typeof num !== "number") {
    num = parseFloat(num);
  }

  if (isNaN(num)) return '';

  const [integerPart, decimalPart] = num.toFixed(3).split('.');

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
});

// Return json object
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
})

// Default value fallback (e.g., 0)
Handlebars.registerHelper('default', (value, fallback) => value != null ? value : fallback);

// Add helper for data entry colspan
Handlebars.registerHelper('add', (a, b) => a + b);

Handlebars.registerHelper('toFixed', function (value, digits) {
  return Number(value).toFixed(digits);
});

Handlebars.registerHelper('calcPercent', function (value, fullArray) {
  // Expect fullArray to be an array of objects: { value: number }
  let total = 0;

  if (Array.isArray(fullArray)) {
    total = fullArray.reduce((sum, item) => sum + parseFloat(item.value || 0), 0);
  }

  if (total === 0) return '0';
  
  const percent = (parseFloat(value) / total) * 100;
  return percent.toFixed(3).replace(/\.?0+$/, ''); // Trim trailing zeros
});

Handlebars.registerHelper('gt', function (a, b) {
  return Number(a) > Number(b);
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
app.post('/api/login/success', async (req, res) => {
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

// Login failed (when the email is right but the password isn't)
app.post('/api/login/wrong-pass', async (req, res) => {
  const userId = Number(req.body.userId)
  wrongPassword(userId)
  res.json({ success: true, message: "Wrong password" })
})

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
  res.render('dashboard/dashboard-home', {
    layout: 'dashboard',
    title: 'Main Dashboard | GC Dashboard',
    current_home: true
  })
})

// Data search
app.get('/dashboard/search', async (req, res) => {
  const locationCode = req.query.location;
  const { region, province, municipality } = req.query

  // If there's no location query, show just the search input page
  if (!locationCode) {
    res.render('dashboard/view-data-search', {
      layout: 'dashboard',
      title: 'Data Search | GC Dashboard',
      current_search: true
    })
  } else {
    // Otherwise, show the actual results page
    try {
      /* ------ LOCATION NAME ------ */
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

      /* ------ AVERAGE DATA ------ */
      // Retrieve summary data of given location
      const avgInfo = await getAvgInfo(locationCode)
      const avgData = await getAvgWasteComposition(locationCode)

      /* ------ RAW DATA ENTRIES ------ */
      const entries = await getDataByLocation(locationCode);

      /* -------- PIE CHART -------- */
      const sectors = await getSectors()
      const supertypes = await getAllTypes()

      // Create a lookup map for waste amounts
      const wasteMap = {};
      for (const row of avgData) {
          if (!wasteMap[row.type_id]) wasteMap[row.type_id] = {};
          wasteMap[row.type_id][row.sector_id] = row.avg_waste_amount;
      }

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

      // Generate summary pie
      const summaryData = {
        labels: [],
        data: [],
        backgroundColor: []
      };

      // Generate detailed pie
      const detailedData = {
        labels: [],
        data: [],
        backgroundColor: []
      };

      // Generate shades (for detailed pie chart)
      function shadeColor(hex, percent) {
        let f = parseInt(hex.slice(1),16),
            t = percent<0?0:255,
            p = percent<0?percent*-1:percent,
            R = f>>16,
            G = f>>8&0x00FF,
            B = f&0x0000FF;
        return `rgb(${Math.round((t-R)*p+R)}, ${Math.round((t-G)*p+G)}, ${Math.round((t-B)*p+B)})`;
      }

      const baseHexMap = {
        'Biodegradable': '#4caf50',    // green
        'Recyclable': '#2196f3',       // blue
        'Residual': '#ff9800',         // orange
        'Special/Hazardous': '#f44336' // red
      };

      const supertypeTotals = Object.values(supertypeMap).map(supertype => {
      const total = supertype.types.reduce((sum, t) => {
        return sum + Object.values(t.amounts || {}).reduce((a, b) => a + Number(b), 0);
      }, 0);
        return { supertype, total };
      });

      // Sort descending by total
      supertypeTotals.sort((a, b) => b.total - a.total);

      for (const { supertype, total } of supertypeTotals) {
        const supertypeName = supertype.name;
        const baseColor = baseHexMap[supertypeName];

        // Summary pie entry
        summaryData.labels.push(supertypeName);
        summaryData.data.push(Number(total.toFixed(3)));
        summaryData.backgroundColor.push(baseColor);

        // Detailed entries (types under this supertype)
        // Calculate total weight per type
        const typeWeights = supertype.types.map(type => {
          const weight = Object.values(type.amounts || {}).reduce((a, b) => a + Number(b), 0);
          return { name: type.name, weight };
        });

        // Sort types descending by weight
        typeWeights.sort((a, b) => b.weight - a.weight);

        // Add sorted types to chart data
        typeWeights.forEach((type, i) => {
          if (type.weight > 0) {
            detailedData.labels.push(type.name);
            detailedData.data.push(Number(type.weight.toFixed(3)));
            detailedData.backgroundColor.push(shadeColor(baseColor, -0.17 + 0.15 * i));
          }
        });
      }

      // Combine them for easier rendering
      const legendData = summaryData.labels.map((label, i) => ({
        label,
        value: summaryData.data[i],
        color: summaryData.backgroundColor[i]
      }));

      /* -------- BAR CHART -------- */

      const barChartData = {}; // keyed by supertype name or ID

      for (const supertype of Object.values(supertypeMap)) {
        const labels = [];
        const data = [];

        for (const type of supertype.types) {
          labels.push(type.name);

          const weight = Object.values(type.amounts || {}).reduce((a, b) => a + Number(b), 0);
          data.push(Number(weight.toFixed(3)));
        }

        barChartData[supertype.name] = {
          color: baseHexMap[supertype.name] || '#9e9e9e',
          labels,
          data
        };
      }

      // If location query is given and results do exist
      if(entries.length > 0) {
        res.render('dashboard/view-data-result', {
          layout: 'dashboard',
          title: 'Data Search Result | GC Dashboard',
          current_search: true,
          fullLocation,
          avgInfo: avgInfo[0],
          barChartData: JSON.stringify(barChartData),
          summaryPieData: JSON.stringify(summaryData),
          detailedPieData: JSON.stringify(detailedData),
          legendData,
          entries
        });
      } else { // If location query is given, but there are no results
        res.render('dashboard/view-data-none', {
          layout: 'dashboard',
          title: 'Data Search Result | GC Dashboard',
          current_search: true,
          fullLocation
        });
      }
    } catch (err) {
      res.status(500).send('Error loading search results');
    }
  }
})

// Get all approved data entries
app.get('/dashboard/data/all', async (req, res) => {
  const data = await getDataByStatus('Approved')

  res.render('dashboard/view-data-all', {
    layout: 'dashboard',
    title: 'All Data Entries | GC Dashboard',
    data,
    current_all: true
  })
})

// View data submissions
app.get('/dashboard/data/submissions', async (req, res) => {
  const currentUser = req.session.user.id
  const data = await getDataForReview(currentUser)

  res.render('dashboard/view-data-all', {
    layout: 'dashboard',
    title: 'Data Submissions for Review | GC Dashboard',
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
    title: 'Your Reports | GC Dashboard',
    data,
    current_user_report: true
  })
})

// View one data entry (for review)
app.get('/dashboard/data/review/:id', async (req, res) => {
  const entryId = req.params.id
  const reviewer = req.session.user.id
  const wasteGen = await getWasteGenById(entryId)

  // Initialize waste comp
  const sectors = await getSectors()
  const supertypes = await getAllTypes()
  const wasteComp = await getWasteCompById(entryId)

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
      type.totalWeight = total.toFixed(3);
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

  // Set up subtotal rows
  for (const supertype of Object.values(supertypeMap)) {
    const sectorTotals = {};
    let totalWeight = 0;

    for (const sector of sectors) {
      sectorTotals[sector.id] = 0;
    }

    for (const type of supertype.types) {
      for (const [sectorIdStr, val] of Object.entries(type.amounts || {})) {
        const sectorId = Number(sectorIdStr);
        const amount = Number(val);
        sectorTotals[sectorId] += amount;
        totalWeight += amount;
      }
    }

    // Format each value to 3 decimal places
    for (const id in sectorTotals) {
      sectorTotals[id] = sectorTotals[id].toFixed(3);
    }

    supertype.sectorTotals = sectorTotals;      // { sector_id: subtotal }
    supertype.totalWeight = totalWeight.toFixed(3);        // e.g., 250
    supertype.percentage = grandTotal > 0
      ? ((totalWeight / grandTotal) * 100).toFixed(3)
      : '0.000';
  }

  res.render('dashboard/view-data-review', {
    layout: 'dashboard',
    title: `${wasteGen.title} | GC Dashboard`,
    wasteGen,
    current_datasubs: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    entryId,
    reviewer
  })
})

// View data entry edit history
app.get('/dashboard/data/:id/history', async (req, res) => {
  const entryId = req.params.id
  const wasteGen = await getWasteGenById(entryId)
  const editPointers = await getEditHistory(entryId)

  res.render('dashboard/view-edit-history', {
    layout: 'dashboard',
    title: `${wasteGen.title} (Edit History) | GC Dashboard`,
    wasteGen,
    editPointers
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

  // Initialize latest editing date
  let latestEdit = await getLatestEdit(id)

  if(latestEdit.length > 0) {
    latestEdit = latestEdit[0].datetime
  } else {
    latestEdit = ''
  }

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
      type.totalWeight = total.toFixed(3);
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

  // Set up subtotal rows
  for (const supertype of Object.values(supertypeMap)) {
    const sectorTotals = {};
    let totalWeight = 0;

    for (const sector of sectors) {
      sectorTotals[sector.id] = 0;
    }

    for (const type of supertype.types) {
      for (const [sectorIdStr, val] of Object.entries(type.amounts || {})) {
        const sectorId = Number(sectorIdStr);
        const amount = Number(val);
        sectorTotals[sectorId] += amount;
        totalWeight += amount;
      }
    }

    // Format each value to 3 decimal places
    for (const id in sectorTotals) {
      sectorTotals[id] = sectorTotals[id].toFixed(3);
    }

    supertype.sectorTotals = sectorTotals;      // { sector_id: subtotal }
    supertype.totalWeight = totalWeight.toFixed(3);        // e.g., 250
    supertype.percentage = grandTotal > 0
      ? ((totalWeight / grandTotal) * 100).toFixed(3)
      : '0.000';
  }

  /* -------- PIE CHART -------- */

  // Generate summary pie
  const summaryData = {
    labels: [],
    data: [],
    backgroundColor: []
  };

  // Generate detailed pie
  const detailedData = {
    labels: [],
    data: [],
    backgroundColor: []
  };

  // Generate shades (for detailed pie chart)
  function shadeColor(hex, percent) {
    let f = parseInt(hex.slice(1),16),
        t = percent<0?0:255,
        p = percent<0?percent*-1:percent,
        R = f>>16,
        G = f>>8&0x00FF,
        B = f&0x0000FF;
    return `rgb(${Math.round((t-R)*p+R)}, ${Math.round((t-G)*p+G)}, ${Math.round((t-B)*p+B)})`;
  }

  // Generate shades (for detailed pie chart)
  function clamp(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function shadeBarColor(baseColor, index, total) {
    // Assume baseColor is in hex: "#4caf50"
    const base = hexToRgb(baseColor); // Convert hex to RGB object

    // Example: darken based on index
    const factor = 0.75 + (index / (total * 1.5)); // Adjust factor to taste

    const r = clamp(base.r * factor);
    const g = clamp(base.g * factor);
    const b = clamp(base.b * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }

  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  const baseHexMap = {
    'Biodegradable': '#4caf50',    // green
    'Recyclable': '#2196f3',       // blue
    'Residual': '#ff9800',         // orange
    'Special/Hazardous': '#f44336' // red
  };

  const supertypeTotals = Object.values(supertypeMap).map(supertype => {
  const total = supertype.types.reduce((sum, t) => {
    return sum + Object.values(t.amounts || {}).reduce((a, b) => a + Number(b), 0);
  }, 0);
    return { supertype, total };
  });

  // Sort descending by total
  supertypeTotals.sort((a, b) => b.total - a.total);

  for (const { supertype, total } of supertypeTotals) {
    const supertypeName = supertype.name;
    const baseColor = baseHexMap[supertypeName];

    // Summary pie entry
    summaryData.labels.push(supertypeName);
    summaryData.data.push(Number(total.toFixed(3)));
    summaryData.backgroundColor.push(baseColor);

    // Detailed entries (types under this supertype)
    // Calculate total weight per type
    const typeWeights = supertype.types.map(type => {
      const weight = Object.values(type.amounts || {}).reduce((a, b) => a + Number(b), 0);
      return { name: type.name, weight };
    });

    // Sort types descending by weight
    typeWeights.sort((a, b) => b.weight - a.weight);

    // Add sorted types to chart data
    typeWeights.forEach((type, i) => {
      if (type.weight > 0) {
        detailedData.labels.push(type.name);
        detailedData.data.push(Number(type.weight.toFixed(3)));
        detailedData.backgroundColor.push(shadeColor(baseColor, -0.17 + 0.15 * i));
      }
    });
  }

  // Combine them for easier rendering
  const legendData = summaryData.labels.map((label, i) => ({
    label,
    value: summaryData.data[i],
    color: summaryData.backgroundColor[i]
  }));

  /* -------- BAR CHART -------- */

  const barChartData = {}; // keyed by supertype name or ID

  for (const supertype of Object.values(supertypeMap)) {
    const baseColor = baseHexMap[supertype.name] || '#9e9e9e';
    const legend = [];

    // Collect and sort types by weight
    const sortedTypes = supertype.types.map(type => {
      const weight = Object.values(type.amounts || {}).reduce((a, b) => a + Number(b), 0);
      return {
        label: type.name,
        value: Number(weight.toFixed(3))
      };
    }).sort((a, b) => b.value - a.value);

    // Assign shaded color to each
    const total = sortedTypes.length;
    sortedTypes.forEach((item, i) => {
      item.color = shadeBarColor(baseColor, i, total); // example: lighter/darker shades per index
    });

    barChartData[supertype.name] = {
      labels: sortedTypes.map(item => item.label),
      data: sortedTypes.map(item => item.value),
      legend: sortedTypes
    };
  }

  /* -------- RENDER PAGE -------- */

  res.render('dashboard/view-data-entry', {
    layout: 'dashboard',
    title: `${wasteGen.title} | GC Dashboard`,
    wasteGen,
    current_all: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    barChartData: JSON.stringify(barChartData),
    summaryPieData: JSON.stringify(summaryData),
    detailedPieData: JSON.stringify(detailedData),
    legendData,
    latestEdit
  })
})

// User routes
// Get all users
app.get('/dashboard/users', async (req, res) => {
  const users = await getUsers()
  res.render('dashboard/users', {
    layout: 'dashboard',
    title: 'Users | GC Dashboard',
    users,
    current_users: true
  })
})

// Get one user from ID (user profile)
app.get('/dashboard/profile', async (req, res) => {
  res.render('dashboard/user-profile', {
    layout: 'dashboard',
    title: `Profile`
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
    title: 'Create New Staff Account | GC Dashboard',
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
    title: 'Roles | GC Dashboard',
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
    title: 'User Applications | GC Dashboard',
    current_userapp: true,
    applications
  })
})

app.get('/dashboard/partners', async (req, res) => {
  const partners = await getPartners()
  res.render('dashboard/partners', {
    layout: 'dashboard',
    title: 'Partner Organizations | GC Dashboard',
    partners,
    current_partners: true
  })
})

// Data submission menu
app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report-menu', {
    layout: 'dashboard',
    title: 'Data Submission Menu | GC Dashboard',
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
    title: 'Data Submission Form | GC Dashboard',
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
    title: 'Upload Data Spreadsheet | GC Dashboard',
    current_report: true
  })
})

app.post("/api/data/submit-report", async (req, res) => {
  // Request body
  const {
    title, region, province, municipality, population, per_capita, annual, date_start, date_end, wasteComposition
  } = req.body;

  const currentUser = req.session.user.id

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

    // Push form data to db
    await submitForm(
      currentUser, title, region, province, municipality, fullLocation, population, per_capita, annual, date_start, date_end, newWasteComp
    );

    // Get ID of new data
    const idResult = await getLatestDataEntry()
    const newId = idResult[0].data_entry_id

    // Insert first edit history entry
    const result = await createEditEntry(newId, currentUser, 'Data entry submitted')

    res.status(200).json({
        message: "Report submitted successfully",
        reportResult: result,
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
    const reviewerId = req.session.user.id
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
    
    // Update data entry
    await updateDataStatus(id, status, rejectionReason || null, reviewedBy)
    
    // Update data entry edit history
    let result
    
    if(status === 'Approved')
      await createEditEntry(id, reviewedBy, 'Approved data entry')
    else if(status === 'Rejected')
      await createEditEntry(id, reviewedBy, `Rejected data entry | ${rejectionReason}`)

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
    APP LISTENER AND APP LOCALS FUNCTIONS
--------------------------------------- */

const port = 3000
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
