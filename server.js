import express from 'express'
import { engine } from 'express-handlebars'
import cors from 'cors'

// Session
import session from 'express-session'
const store = new session.MemoryStore();

// Import database functions
import {
  getUsers, getUserByEmail, createUser, getUsersOfRole, getUserById,
  deleteRole, getAllUsers,
  updateRoleName,
  getPartners, getOrgRoles,
  getRolesOfSupertype, createClientRole,
  getApplications, getApplicationById, getApplicationsByEmail,
  approveApplication, rejectApplication, reconsiderApplication, revokeApproval,
  updateApplicationStatus, createApplication, resetApplicationStatus,
  lastLogin,
  getSectors, submitForm,
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
  hashPassword,
  getDataByStatusPaginated,
  getTotalDataCountByStatus,
  getDataWithFilters,
  getFilteredDataCount,
  getTopContributors,
  getLatestSubmissions,
  getTopReportingRegions,
  getMonthlySubmissions,
  getAvgWasteCompositionWithFilters,
  getAvgInfoWithFilters,
  getDataByUserCount,
  getCoordinates,
  getFilteredDataCoords,
  getEntryLocationName,
  fetchCoordinates,
  createLocationEntry,
  removeUserRole,
  updateUserRole
} from './database.js'

// File Upload
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Philippine Standard Geographic Code
import { PSGCResource } from 'psgc-areas'

// Favicon
import favicon from 'serve-favicon'

// SheetJS
import * as XLSX from 'xlsx'

// Password encryption
import bcrypt from 'bcrypt'
const SALT_ROUNDS = 10 // bcrypt salt rounds

/* ---------------------------------------
    EXPRESS
--------------------------------------- */
const app = express()

// To allow CORS
app.use(cors({ credentials: true }))

// Use JSON for data format
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// Set favicon
app.use(favicon('./favicon.ico'))

// Use the public folder for assets
app.use(express.static('public'))
app.use('/pictures', express.static('pictures'));

// File paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

const xlsxUpload = multer({ dest: 'uploads/' })

// Serve files from uploads directory
app.use('/uploads', express.static('uploads'));

/* ---------------------------------------
    CHART DISPLAY FUNCTIONS
--------------------------------------- */

// Main category colors
const baseHexMap = {
  'Biodegradable': '#4caf50',    // green
  'Recyclable': '#2196f3',       // blue
  'Residual': '#ff9800',         // orange
  'Special/Hazardous': '#f44336' // red
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
      const pendingData = await getDataForReviewCount(req.session.user.id, 'Pending Review')

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
app.use('/control-panel', loginSetup)

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

import './handlebars-helpers.js'

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

// Login API
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user in database
    const userList = await getUserByEmail(email);

    // If user is not found, send error
    if (!userList || userList.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Set user once entry is found
    const user = userList[0];
    const storedPassword = user.password

    // Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, storedPassword);
    if (!isMatch) {
      await wrongPassword(user.user_id); // update wrong password count
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Set session info
    req.session.authenticated = true;
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
    };

    await lastLogin(user.user_id); // Add current datetime to user's last login

    req.session.save(err => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ success: false, message: 'Session error' });
      }
      res.json({ success: true, message: 'Login successful' });
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
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
    const orgRoles = await getOrgRoles();
    res.render('application-form', {
      layout: 'public',
      title: 'Apply for Access | GreenCycle',
      current_apply: true,
      clientRoles,
      orgRoles,
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

// Dashboard home page
app.get('/dashboard', (req, res) => {
  res.render('dashboard/dashboard-home', {
    layout: 'dashboard',
    title: 'Main Dashboard | GC Dashboard',
    current_home: true
  })
})

// Dashboard home page
app.get('/dashboard/guide', (req, res) => {
  res.render('dashboard/guide', {
    layout: 'dashboard',
    title: 'Waste Guide | GC Dashboard',
    current_guide: true
  })
})

app.get('/dashboard/data/summary', async (req, res, next) => {
  // Clean query before proceeding
  const cleanedQuery = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value !== '') cleanedQuery[key] = value;
  }

  if (Object.keys(cleanedQuery).length !== Object.keys(req.query).length) {
    // Redirect to cleaned URL if any empty values were found
    const queryString = new URLSearchParams(cleanedQuery).toString();
    return res.redirect(`/dashboard/data/summary?${queryString}`);
  }

  next();
}, async (req, res) => {
  const { title, region, province, municipality, author, company, startDate, endDate } = req.query

  try {
      /* ------ LOCATION NAME ------ */
      // Use the most specific locationCode available
      const locationCode = municipality || province || region || null;

      // Prepare PSGC data for location names
      const psgcRegions = await PSGCResource.getRegions()
      const psgcProvinces = await PSGCResource.getProvinces()
      const psgcMunicipalities = await PSGCResource.getMunicipalities()
      const psgcCities = await PSGCResource.getCities()

      // Get location names
      const regionName = getPsgcName(psgcRegions, region) || 'ALL'
      const provinceName = getPsgcName(psgcProvinces, province) || 'ALL'
      const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || 'ALL'

      /* ------ AVERAGE DATA ------ */
      // Retrieve summary data of given location
      const avgInfo = await getAvgInfoWithFilters(title, locationCode, author, company, startDate, endDate)

      // Initialize waste comp
      const sectors = await getSectors()
      const supertypes = await getAllTypes()
      const avgData = await getAvgWasteCompositionWithFilters(title, locationCode, author, company, startDate, endDate)

      /* ------ DATA COORDS ------ */
      const coords = await getFilteredDataCoords(title, locationCode, author, company, startDate, endDate)
      
      // Filter out null values
      const validCoords = coords.filter(loc => loc.latitude && loc.longitude);

      /* -------- CHART BUILDER -------- */
      // Create a lookup map for waste amounts
      const wasteMap = {}; // type_id -> { sector_id -> avg_waste_amount }
      for (const row of avgData) {
        if (!wasteMap[row.type_id]) wasteMap[row.type_id] = {};
        wasteMap[row.type_id][row.sector_id] = Number(row.avg_waste_amount);
      }

      const supertypeMap = {};
      let grandTotal = 0;

      for (const row of supertypes) {
        if (!supertypeMap[row.supertype_id]) {
          supertypeMap[row.supertype_id] = {
            id: row.supertype_id,
            name: row.supertype_name,
            types: []
          };
        }

        const amounts = wasteMap[row.type_id] || {};
        const total = Object.values(amounts).reduce((a, b) => a + b, 0);
        grandTotal += total;

        supertypeMap[row.supertype_id].types.push({
          id: row.type_id,
          name: row.type_name,
          amounts,
          weight: total
        });
      }

      const summaryData = { labels: [], data: [], backgroundColor: [] };
      const detailedData = { labels: [], data: [], backgroundColor: [] };
      const legendData = [];
      const barChartData = {};
      const sectorTotals = {};
      sectors.forEach(s => sectorTotals[s.id] = 0);

      for (const supertype of Object.values(supertypeMap)) {
        const baseColor = baseHexMap[supertype.name] || '#9e9e9e';
        const sectorSubtotals = {};
        sectors.forEach(s => sectorSubtotals[s.id] = 0);

        let supertypeTotal = 0;

        const sortedTypes = supertype.types.map(type => {
          const weight = type.weight;
          const amounts = type.amounts;

          for (const [sid, val] of Object.entries(amounts)) {
            const sidNum = Number(sid);
            sectorSubtotals[sidNum] += val;
            sectorTotals[sidNum] += val;
          }

          supertypeTotal += weight;

          return { label: type.name, value: weight };
        }).sort((a, b) => b.value - a.value);

        const totalTypes = sortedTypes.length;
        sortedTypes.forEach((item, i) => {
          item.color = shadeBarColor(baseColor, i, totalTypes);
        });

        barChartData[supertype.name] = {
          labels: sortedTypes.map(t => t.label),
          data: sortedTypes.map(t => t.value),
          legend: sortedTypes
        };

        summaryData.labels.push(supertype.name);
        summaryData.data.push(Number(supertypeTotal.toFixed(3)));
        summaryData.backgroundColor.push(baseColor);
        legendData.push({
          label: supertype.name,
          value: Number(supertypeTotal.toFixed(3)),
          color: baseColor
        });

        sortedTypes.forEach((t, i) => {
          if (t.value > 0) {
            detailedData.labels.push(t.label);
            detailedData.data.push(Number(t.value.toFixed(3)));
            detailedData.backgroundColor.push(shadeColor(baseColor, -0.17 + 0.15 * i));
          }
        });
      }

      const sectorBarData = sectors.map((sector, i) => ({
        label: sector.name,
        value: Number(sectorTotals[sector.id]?.toFixed(3)) || 0,
        color: `hsl(${210 + i * 15}, 70%, 55%)`
      })).sort((a, b) => b.value - a.value);

      const sectorPieData = {};
      for (const sector of sectors) {
        const sectorId = sector.id;
        const rawTotals = Object.values(supertypeMap).map(supertype => {
          let subtotal = 0;
          for (const type of supertype.types) {
            subtotal += Number(type.amounts?.[sectorId] || 0);
          }
          return {
            label: supertype.name,
            value: Number(subtotal.toFixed(3)),
            color: baseHexMap[supertype.name] || '#9E9E9E'
          };
        }).sort((a, b) => b.value - a.value);

        sectorPieData[sector.name] = {
          labels: rawTotals.map(r => r.label),
          data: rawTotals.map(r => r.value),
          backgroundColor: rawTotals.map(r => r.color)
        };
      }

      res.render('dashboard/view-data-summary', {
        layout: 'dashboard',
        title: 'Data Summary | GC Dashboard',
        current_all: true,
        query: req.query, // Pass current query
        avgInfo: avgInfo[0],
        barChartData: JSON.stringify(barChartData),
        summaryPieData: JSON.stringify(summaryData),
        detailedPieData: JSON.stringify(detailedData),
        legendData,
        sectorBarData: JSON.stringify(sectorBarData),
        sectorPieData: JSON.stringify(sectorPieData),
        regionName, provinceName, municipalityName,
        locations: JSON.stringify(validCoords) // map coords
      })
    } catch (err) {
      console.error('Summary Error:', err);  // Log the actual error
      res.status(500).send('Error loading search results');
    }
})

// Get all approved data entries
app.get('/dashboard/data/all', async (req, res, next) => {
  // Clean query before proceeding
  const cleanedQuery = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (value !== '') cleanedQuery[key] = value;
  }

  if (Object.keys(cleanedQuery).length !== Object.keys(req.query).length) {
    // Redirect to cleaned URL if any empty values were found
    const queryString = new URLSearchParams(cleanedQuery).toString();
    return res.redirect(`/dashboard/data/all?${queryString}`);
  }

  next();
}, async (req, res) => { // Actual route content
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const {
    title, region, province, municipality, author, company, startDate, endDate
  } = req.query;

  // Use the most specific locationCode available
  const locationCode = municipality || province || region || null;

  const [data, totalCount] = await Promise.all([
    getDataWithFilters(limit, offset, title, locationCode, author, company, startDate, endDate),
    getFilteredDataCount(title, locationCode, author, company, startDate, endDate)
  ]);

  // Prefill location dropdowns
  let prefill = {}

  if(region) prefill.region = region
  if(province) prefill.province = province
  if(municipality) prefill.municipality = municipality

  // Page handler
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-all', {
    layout: 'dashboard',
    title: 'All Data Entries | GC Dashboard',
    data,
    currentPage: page,
    totalPages,
    totalCount,
    startEntry,
    endEntry,
    current_all: true,
    query: req.query, // Pass current query so you can preserve form values
    prefill
  });
});

// View data submissions
app.get('/dashboard/data/submissions/pending', async (req, res) => {
  // Current user cannot review their own works
  const omitUser = req.session.user.id

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const [data, totalCount, revisionCount] = await Promise.all([
    getDataForReview(omitUser, 'Pending Review', limit, offset),
    getDataForReviewCount(omitUser, 'Pending Review'),
    getDataForReviewCount(omitUser, 'Needs Revision')
  ]);

  // Pagination offset
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-all', {
    layout: 'dashboard',
    title: 'Data Submissions for Review | GC Dashboard',
    data,
    current_datasubs: true,
    pending: true,
    totalPages,
    totalCount,
    pendingCount: totalCount,
    revisionCount,
    startEntry,
    endEntry,
    currentPage: page
  })
})

// View data entries needing revision
app.get('/dashboard/data/submissions/revision', async (req, res) => {
  // Current user cannot review their own works
  const omitUser = req.session.user.id

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const [data, totalCount, pendingCount] = await Promise.all([
    getDataForReview(omitUser, 'Needs Revision', limit, offset),
    getDataForReviewCount(omitUser, 'Needs Revision'),
    getDataForReviewCount(omitUser, 'Pending Review')
  ]);

  // Pagination offset
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-all', {
    layout: 'dashboard',
    title: 'Data Submissions for Revision | GC Dashboard',
    data,
    current_datasubs: true,
    revision: true,
    totalPages,
    totalCount,
    revisionCount: totalCount,
    pendingCount,
    startEntry,
    endEntry,
    currentPage: page
  })
})

// Data WIP view (for Your Submissions tab)
app.get('/dashboard/data/wip/:id', async (req, res) => {
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

  res.render('dashboard/view-data-wip', {
    layout: 'dashboard',
    title: `${wasteGen.title} | GC Dashboard`,
    wasteGen,
    current_user_report: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    entryId
  })
})

// Get all data entries by one user (Your Submissions)
app.get('/dashboard/data/user/:id', async (req, res) => {
  const user = Number(req.session.user.id)

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Retrieve data and count
  const [data, totalCount] = await Promise.all([
    getDataByUser(user, limit, offset),
    getDataByUserCount(user)
  ]);

  // Pagination button variables
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-user', {
    layout: 'dashboard',
    title: 'Your Reports | GC Dashboard',
    data,
    current_user_report: true,
    currentPage: page,
    totalPages,
    totalCount,
    startEntry,
    endEntry
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
  const id = req.params.id;
  const wasteGen = await getWasteGenById(id);
  const sectors = await getSectors();
  const supertypes = await getAllTypes();
  const wasteComp = await getWasteCompById(id);

  // Retrieve location coordinates
  const coords = await getCoordinates(wasteGen.location_name)
  if (!coords) {
    console.log('ERROR: Location not found.');
  }

  // Latest edit entry
  let latestEdit = await getLatestEdit(id);
  latestEdit = latestEdit.length > 0 ? latestEdit[0].datetime : '';

  // Create waste map
  const wasteMap = {};
  for (const row of wasteComp) {
    if (!wasteMap[row.type_id]) wasteMap[row.type_id] = {};
    wasteMap[row.type_id][row.sector_id] = row.waste_amount;
  }

  // Initialize sector totals
  const sectorTotals = {};
  sectors.forEach(s => sectorTotals[s.id] = 0);

  // Group types under supertypes and compute totals
  const supertypeMap = {};
  let grandTotal = 0;

  for (const row of supertypes) {
    if (!supertypeMap[row.supertype_id]) {
      supertypeMap[row.supertype_id] = {
        id: row.supertype_id,
        name: row.supertype_name,
        types: []
      };
    }

    const amounts = wasteMap[row.type_id] || {};
    const total = Object.values(amounts).reduce((a, b) => a + Number(b), 0);
    grandTotal += total;

    supertypeMap[row.supertype_id].types.push({
      id: row.type_id,
      name: row.type_name,
      amounts,
      weight: total
    });
  }

  // Prepare chart and table data
  const summaryData = { labels: [], data: [], backgroundColor: [] };
  const detailedData = { labels: [], data: [], backgroundColor: [] };
  const legendData = [];
  const barChartData = {};

  for (const supertype of Object.values(supertypeMap)) {
    const baseColor = baseHexMap[supertype.name] || '#9e9e9e';
    const sectorSubtotals = {};
    sectors.forEach(s => sectorSubtotals[s.id] = 0);

    let supertypeTotal = 0;

    const sortedTypes = supertype.types.map(type => {
      const weight = type.weight;
      const amounts = type.amounts || {};

      for (const [sid, val] of Object.entries(amounts)) {
        const sidNum = Number(sid);
        const amt = Number(val);
        sectorSubtotals[sidNum] += amt;
        sectorTotals[sidNum] += amt;
      }

      supertypeTotal += weight;

      return { label: type.name, value: weight };
    }).sort((a, b) => b.value - a.value);

    const totalTypes = sortedTypes.length;
    sortedTypes.forEach((item, i) => {
      item.color = shadeBarColor(baseColor, i, totalTypes);
    });

    barChartData[supertype.name] = {
      labels: sortedTypes.map(t => t.label),
      data: sortedTypes.map(t => t.value),
      legend: sortedTypes
    };

    summaryData.labels.push(supertype.name);
    summaryData.data.push(Number(supertypeTotal.toFixed(3)));
    summaryData.backgroundColor.push(baseColor);
    legendData.push({
      label: supertype.name,
      value: Number(supertypeTotal.toFixed(3)),
      color: baseColor
    });

    sortedTypes.forEach((t, i) => {
      if (t.value > 0) {
        detailedData.labels.push(t.label);
        detailedData.data.push(Number(t.value.toFixed(3)));
        detailedData.backgroundColor.push(shadeColor(baseColor, -0.17 + 0.15 * i));
      }
    });

    for (const id in sectorSubtotals) {
      sectorSubtotals[id] = sectorSubtotals[id].toFixed(3);
    }

    supertype.sectorTotals = sectorSubtotals;
    supertype.totalWeight = supertypeTotal.toFixed(3);
    supertype.percentage = grandTotal > 0 ? ((supertypeTotal / grandTotal) * 100).toFixed(3) : '0.000';

    supertype.types.forEach(type => {
      type.totalWeight = type.weight.toFixed(3);
      type.percentage = grandTotal > 0 ? ((type.weight / grandTotal) * 100).toFixed(3) : '0.000';
    });
  }

  // Sector bar chart data
  const sectorBarData = sectors.map((sector, i) => ({
    label: sector.name,
    value: Number(sectorTotals[sector.id]?.toFixed(3)) || 0,
    color: `hsl(${210 + i * 15}, 70%, 55%)`
  })).sort((a, b) => b.value - a.value);

  // Sector pie chart data
  const sectorPieData = {};
  for (const sector of sectors) {
    const sectorId = sector.id;
    const rawTotals = Object.values(supertypeMap).map(supertype => {
      let subtotal = 0;
      for (const type of supertype.types) {
        subtotal += Number(type.amounts?.[sectorId] || 0);
      }
      return {
        label: supertype.name,
        value: Number(subtotal.toFixed(3)),
        color: baseHexMap[supertype.name] || '#9E9E9E'
      };
    }).sort((a, b) => b.value - a.value);

    sectorPieData[sector.name] = {
      labels: rawTotals.map(r => r.label),
      data: rawTotals.map(r => r.value),
      backgroundColor: rawTotals.map(r => r.color)
    };
  }

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
    latestEdit,
    sectorBarData: JSON.stringify(sectorBarData),
    sectorPieData: JSON.stringify(sectorPieData),
    coords: JSON.stringify(coords)
  });
});

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

// Data submission menu
app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report-menu', {
    layout: 'dashboard',
    title: 'Data Submission Menu | GC Dashboard',
    current_report: true
  })
})

// Manual form confirmation
app.post('/dashboard/submit-report/form/confirm', async (req, res) => {
  const rawData = req.body.jsonData
  const formData = JSON.parse(rawData) // convert string to object
  const wasteData = formData.wasteComposition

  // Sector and type metadata
  const sectors = await getSectors()
  const allTypes = await getAllTypes()

  // Structure form data into table
  // Group types under supertypes
  const supertypeMap = new Map();

  for (const row of allTypes) {
    const {
      supertype_id,
      supertype_name,
      type_id,
      type_name
    } = row;

    // Initialize supertype if not already in map
    if (!supertypeMap.has(supertype_id)) {
      supertypeMap.set(supertype_id, {
        name: supertype_name,
        types: []
      });
    }

    // Find waste amounts per sector for this type
    const amounts = {};
    for (const sector of sectors) {
      const match = wasteData.find(
        entry =>
          entry.type_id === String(type_id) &&
          entry.sector_id === String(sector.id)
      );
      amounts[sector.id] = match ? match.waste_amount : "0";
    }

    // Add this type to the supertype's types array
    supertypeMap.get(supertype_id).types.push({
      name: type_name,
      amounts
    });
  }

  // Convert map to array
  const supertypes = Array.from(supertypeMap.values());

  /* ------- LOCATION NAME ------- */
  // Prepare PSGC data for location names
  const psgcRegions = await PSGCResource.getRegions()
  const psgcProvinces = await PSGCResource.getProvinces()
  const psgcMunicipalities = await PSGCResource.getMunicipalities()
  const psgcCities = await PSGCResource.getCities()

  // Get location names
  const regionName = getPsgcName(psgcRegions, formData.region)
  const provinceName = getPsgcName(psgcProvinces, formData.province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, formData.municipality) || getPsgcName(psgcCities, formData.municipality) || null

  // Set full location name
  const parts = [municipalityName, provinceName, regionName].filter(Boolean)
  const fullLocation = parts.join(', ')

  res.render('dashboard/data-form-confirm', {
    layout: 'dashboard',
    title: 'Confirm Details | GC Dashboard',
    current_report: true,
    formDataRaw: formData,
    formData: JSON.stringify(formData),
    fullLocation,
    supertypes, // structured table data
    sectors
  })
})

// Submit data by manual form
app.route('/dashboard/submit-report/form')
  .get(async (req, res) => { // User is filling up for the first time
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
      types,
      prefill: {}
    })
  })
  .post(async (req, res) => { // User has canceled submission and is returning to form
    const prefill = req.body

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
      types,
      prefill
    })
  })

// API path after user uploads filled spreadsheet
app.post("/dashboard/submit-report/upload/confirm", xlsxUpload.single('spreadsheet'), async (req, res) => {
  try {
    // Form data
    const formData = req.body

    /* ------- LOCATION NAME ------- */
    // Prepare PSGC data for location names
    const psgcRegions = await PSGCResource.getRegions()
    const psgcProvinces = await PSGCResource.getProvinces()
    const psgcMunicipalities = await PSGCResource.getMunicipalities()
    const psgcCities = await PSGCResource.getCities()

    // Get location names
    const regionName = getPsgcName(psgcRegions, formData.region)
    const provinceName = getPsgcName(psgcProvinces, formData.province) || null
    const municipalityName = getPsgcName(psgcMunicipalities, formData.municipality) || getPsgcName(psgcCities, formData.municipality) || null

    // Set full location name
    const parts = [municipalityName, provinceName, regionName].filter(Boolean)
    const fullLocation = parts.join(', ')

    /* ------- XLSX DATA EXTRACTION ------- */
    // Set up worksheet for reading
    const fileBuffer = fs.readFileSync(req.file.path);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Manual data
    const population = json[0]?.[1] || '';
    const perCapita = json[1]?.[1] || '';
    const annual = json[2]?.[1] || '';

    // Sector names are in row 6, from column 2 onward
    const sectorHeaderRow = 6;
    const sectors = json[sectorHeaderRow]?.slice(2) || [];

    // Waste data starts at row 7
    const matrixStartRow = 7;
    const wasteMatrix = [];

    let currentSupertype = '';

    for (let i = matrixStartRow; i < json.length; i++) {
      const row = json[i];
      if (!row || !row[1]) continue; // skip empty or invalid rows

      // Update supertype if column 0 is not null
      if (row[0]) currentSupertype = row[0];

      const type = row[1];
      const values = row.slice(2);

      wasteMatrix.push({ supertype: currentSupertype, type, values });
    }

    fs.unlinkSync(req.file.path) // Delete uploaded file after parsing

    res.render('dashboard/data-upload-confirm', {
      layout: 'dashboard',
      title: 'Confirm Details | GC Dashboard',
      fullLocation,
      population,
      perCapita,
      annual,
      sectors,
      wasteMatrix,
      wasteMatrixJson: JSON.stringify(wasteMatrix),
      formData: JSON.stringify(formData),
      formDataRaw: formData,
      sectorsJson: JSON.stringify(sectors)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing the spreadsheet.');
  }
})

// Submit data by uploading a spreadsheet
app.route('/dashboard/submit-report/upload')
  .get((req, res) => { // User is filling up for the first time
    res.render('dashboard/data-upload', {
      layout: 'dashboard',
      title: 'Upload Data Spreadsheet | GC Dashboard',
      current_report: true,
      prefill: {},
      reopenStep1: false
    })
  }) 
  .post((req, res) => { // User has canceled submission and is returning to form
    const prefill = req.body

    res.render('dashboard/data-upload', {
      layout: 'dashboard',
      title: 'Upload Data Spreadsheet | GC Dashboard',
      current_report: true,
      prefill,
      reopenStep1: true // so JS reopens Step 1
    })
  })

app.post("/api/data/submit-report/manual", async (req, res) => {
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
        }
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

// Conversion function for spreadsheet upload API
function buildWasteCompositionFromMatrix(wasteMatrix, sectorNames, typeMap, sectorMap) {
  const wasteComposition = [];

  for (const row of wasteMatrix) {
    const type_id = typeMap[row.type?.trim()];
    if (!type_id) continue; // Skip unknown waste types

    row.values.forEach((amount, index) => {
      const sectorName = sectorNames[index]?.trim();
      const sector_id = sectorMap[sectorName];
      if (!sector_id) return; // Skip unknown sectors

      wasteComposition.push({
        type_id,
        sector_id,
        waste_amount: Number(amount) || 0
      });
    });
  }

  return wasteComposition;
}

// Pass data to db if uploaded spreadsheet values are confirmed
app.post("/api/data/submit-report/upload", async (req, res) => {
  /* ------- REQUEST BODY ------- */
  const {
    title, region, province, municipality, population, per_capita, annual, date_start, date_end, wasteMatrix, sectorsFromExcel
  } = req.body;

  const currentUser = req.session.user.id

  /* ------- LOCATION NAME ------- */
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
  
  /* ------- WASTE MATRIX CONVERSION ------- */
  // Get definitions from db
  const types = await getWasteTypes()
  const sectors = await getSectors()

  // Convert to lookup maps
  const typeMap = Object.fromEntries(types.map(t => [t.name.trim(), t.id]))
  const sectorMap = Object.fromEntries(sectors.map(s => [s.name.trim(), s.id]))

  // Convert spreadsheet data to insertable data
  const wasteComposition = buildWasteCompositionFromMatrix(wasteMatrix, sectorsFromExcel, typeMap, sectorMap)

  try {
    // Push form data to db
    await submitForm(
      currentUser, title, region, province, municipality, fullLocation, population, per_capita, annual, date_start, date_end, wasteComposition
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
})

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
  const { roleId, lastName, firstName, email, password, contactNo, companyName } = req.body

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

  // Insert user in db
  const user = await createUser(roleId, lastName, firstName, email, hashedPassword, contactNo,companyName)
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
app.get('/users/all', async (req, res) => {
    try {
        const users = await getAllUsers(); // ✅ Use the helper function
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/your-route', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json(users);
    } catch (err) {
        console.error('Error fetching all users:', err);
        res.status(500).send('Error fetching users');
    }
});

/* ---------------------------------------
    CONTROL PANEL ROUTES
--------------------------------------- */
// Dashboard home page
app.get('/control-panel', async (req, res) => {
  res.render('control-panel/cp-home', {
    layout: 'control-panel',
    title: 'Home | GC Control Panel',
    current_home: true
  })
})

// Data entry statistics
app.get('/control-panel/entry-statistics', async (req, res) => {
  const entryCount = {
    approved: await getTotalDataCountByStatus('Approved'),
    pending: await getTotalDataCountByStatus('Pending Review'),
    rejected: await getTotalDataCountByStatus('Needs Revision')
  }
  const contributors = await getTopContributors(5)
  const latestSubmissions = await getLatestSubmissions(3)
  const topRegions = await getTopReportingRegions(5)
  const monthlySubmissions = await getMonthlySubmissions()

  res.render('control-panel/entry-stats', {
    layout: 'control-panel',
    title: 'Data Entry Statistics | GC Control Panel',
    current_stats: true,
    entryCount,
    contributors,
    latestSubmissions,
    topRegions,
    monthlySubmissions: JSON.stringify(monthlySubmissions)
  })
})

// Fetch top contributors (entry stats)
app.get('/api/control-panel/top-contributors', async (req, res) => {
  const contributors = await getTopContributors(); // full list, no limit
  res.json(contributors);
});

// Fetch top regions (entry stats)
app.get('/api/control-panel/top-regions', async (req, res) => {
  const regions = await getTopReportingRegions();
  res.json(regions);
});

// User routes
// Get all users
app.get('/control-panel/users', async (req, res) => {
  const users = await getUsers()
  res.render('control-panel/users', {
    layout: 'control-panel',
    title: 'Users | GC Control Panel',
    users,
    current_users: true
  })
})

app.get('/control-panel/roles', async (req, res) => {
  const adminRoles = await getRolesOfSupertype(0)
  const gcRoles = await getRolesOfSupertype(1)
  const clientRoles = await getRolesOfSupertype(2)

  res.render('control-panel/roles', {
    layout: 'control-panel',
    title: 'Roles | GC Control Panel',
    adminRoles,
    gcRoles,
    clientRoles,
    current_roles: true
  })
})
// In your users route file or main server file
app.get('/users/:user_id', async (req, res) => {
    const userId = req.params.user_id;

    try {
        const result = await getUserById(userId);

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result[0]; // your query returns an array

        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching user by ID:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/users/remove-role/:user_id', async (req, res) => {
  const userId = req.params.user_id;
  console.log(`Removing role for user: ${userId}`);

  try {
    await removeUserRole(userId);
    console.log('Role removed successfully');
    res.status(200).json({ message: 'Role removed successfully' });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// User applications page
app.get('/control-panel/user-applications', async (req, res) => {
  const applications = await getApplications()

  res.render('control-panel/user-applications', { 
    layout: 'control-panel',
    title: 'User Applications | GC Control Panel',
    current_userapp: true,
    applications
  })
})
app.put('/users/update-role', async (req, res) => {
    const { userId, newRoleId } = req.body;

    console.log(`Received role update request: userId=${userId}, newRoleId=${newRoleId}`);

    // Input validation
    if (!userId || !newRoleId) {
        return res.status(400).json({ error: 'Missing userId or newRoleId' });
    }

    if (isNaN(userId) || isNaN(newRoleId)) {
        return res.status(400).json({ error: 'Invalid userId or newRoleId format' });
    }

    try {
        const result = await updateUserRole(userId, newRoleId);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found or already assigned to this role' });
        }

        console.log(`Successfully updated user ${userId} to role ${newRoleId}`);
        res.status(200).json({ message: 'Role updated successfully' });

    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Database error occurred while updating role' });
    }
});


app.get('/control-panel/partners', async (req, res) => {
  const partners = await getPartners()
  res.render('control-panel/partners', {
    layout: 'control-panel',
    title: 'Partner Organizations | GC Control Panel',
    partners,
    current_partners: true
  })
})
// Update role name
app.put('/update-role-name/:role_id', async (req, res) => {
    const { role_id } = req.params;
    const { newName } = req.body;
    try {
        await updateRoleName(role_id, newName); // in database.js
        res.sendStatus(200);
    } catch (err) {
        console.error("Error updating role name:", err);
        res.status(500).send("Error updating role name");
    }
});

// Delete role
app.delete('/delete-role/:role_id', async (req, res) => {
    const { role_id } = req.params;
    try {
        await deleteRole(role_id); // in database.js
        res.sendStatus(200);
    } catch (err) {
        console.error("Error deleting role:", err);
        res.status(500).send("Error deleting role");
    }
});

// app.get('/get-users-by-role/:roleId', async (req, res) => {
//     const { roleId } = req.params;
//     try {
//         const [users] = await sql.query(`
//             SELECT u.user_id, u.username, u.full_name
//             FROM user u
//             WHERE u.role_id = ?
//         `, [roleId]);
//         res.json(users);
//     } catch (err) {
//         console.error('Error fetching users by role:', err);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

/* ---------------------------------------
    USER APPLICATION API ENDPOINTS
--------------------------------------- */

// API: Submit new application
app.post('/api/applications', upload.single('verificationDoc'), async (req, res) => {
  try {
    const {role_id, lastName, firstName, email, contactNo, companyName} = req.body;
// Also validate that role_id is not empty

console.log("=== Received Form Data ===");
console.log("First Name:", firstName);
console.log("Last Name:", lastName);
console.log("Email:", email);
console.log("Contact No:", contactNo);
console.log("Company Name:", companyName);
console.log("Role ID:", role_id);
console.log("==========================");
    
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
      role_id, lastName, firstName, email, contactNo, companyName, verificationDoc
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
    
    if(status === 'Approved') {
      await createEditEntry(id, reviewedBy, 'Approved data entry')

      // Retrieve entry location name
      const locationName = await getEntryLocationName(id)

      // First, make sure entry's location exists in db
      const coords = await getCoordinates(locationName)

      // If coords do not exist, find coords for entry's location and insert into db
      if(!coords) {
        const fetchCoords = await fetchCoordinates(locationName)

        if(fetchCoords)
          await createLocationEntry(locationName, fetchCoords.latitude, fetchCoords.longitude)
      }

    }
    else if(status === 'Needs Revision') {
      await createEditEntry(id, reviewedBy, `Needs Revision: ${rejectionReason}`)
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
