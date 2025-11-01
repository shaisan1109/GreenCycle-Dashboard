import express from 'express'
import { engine } from 'express-handlebars'
import cors from 'cors'
import PDFDocument from 'pdfkit';
import cookieParser from "cookie-parser";
import cron from "node-cron";

// Session
import session from 'express-session'
const store = new session.MemoryStore();

// For PDF report generation
import puppeteer from 'puppeteer';

// Import database functions
import {
  getUsers, getUserByEmail, createUser, getUsersOfRole, getUserById,
  deleteRole, getAllUsers,getTopDashboardData,
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
  updateUserRole,
  getWasteComplianceStatus,
  getWasteComplianceStatusFromSummary,
  getSectorComplianceStatus,
  getSectorComplianceStatusFromSummary,
  createRevisionEntry,
  updateCurrentLog,
  getRevisionEntryCount,
  getRevisionEntries,
  updateForm,
  getPendingData,
  getUserWasteComplianceSummary,
  getUserSectorComplianceSummary,
  getWasteNonCompliantClients,
  getSectorNonCompliantClients,
  getNotifications,
  getUnreadNotifCount,
  getNotifStatus,
  updateNotifRead,
  createNotification,
  deleteNotification,
  getDeadlineTimer,
  getRolesOfSupertypes,
  createCompanyRole,
  getAllCompanies,
  getTaskClaimStatus,
  claimTask,
  unclaimTask,
  createTask,
  completeTask,
  getTaskByEntryId,
  updateNotifReadBatch,
  deleteNotificationsBatch,
  getNotificationCount,
  getWasteComplianceByUser,
  getSectorComplianceByUser,
  groupComplianceData,
  getSummaryParticipants,
  getWasteQuotasByOrganization,
  getSectorQuotasByOrganization,
  getOrganizations,
  updateWasteQuotaForOrg,
updateSectorQuotaForOrg,
getTimeSeriesData,
runHybridSimulation,
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

app.use(cookieParser());

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

      // Pending data count = total of 'Pending Review' and 'Revised' entries
      const pendingCount = await getDataForReviewCount(req.session.user.id, 'Pending Review')
      const revisedCount = await getDataForReviewCount(req.session.user.id, 'Revised')
      const pendingData = pendingCount + revisedCount

      // Retrieve user's current notif count
      const notifCount = await getUnreadNotifCount(req.session.user.id)

      // Retrieve entry revision count
      const revisionCount = await getDataByUserCount(req.session.user.id, 'Needs Revision')

      // Retrieve compliance entry count
      const wasteClients = await getWasteNonCompliantClients(req.session.user.id)
      const sectorClients = await getSectorNonCompliantClients(req.session.user.id)
      const cmpCount = wasteClients.length
      const secCount = sectorClients.length
      const cmpTotalCount = cmpCount + secCount

      // Make it available to views and routes
      res.locals.pendingApplications = pendingApplications
      res.locals.pendingData = pendingData
      res.locals.notifCount = notifCount
      res.locals.revisionCount = revisionCount
      res.locals.cmpTotalCount = cmpTotalCount
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
  extname: 'hbs',
  defaultLayout: 'main',
  helpers: {
    ifNotEquals: function (a, b, options) {
      return a !== b ? options.fn(this) : options.inverse(this);
    },
    ifArrayNotEmpty: function (array, options) {
      return Array.isArray(array) && array.length > 0 ? options.fn(this) : options.inverse(this);
    },
    uppercase: function (str) {
      return str ? str.toUpperCase() : '';
    },
    formatNumber: function (value) {
      if (value == null || value === '') return '0';
      return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
      });
    },
    integer: function (value) {
      if (value == null || value === '') return '0';
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
  }
}));

app.set('view engine', 'hbs');
app.set('views', './views');
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
// server.js

// API route for deadline timer
app.get("/api/deadline/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const timer = await getDeadlineTimer(userId);
    res.json(timer);
  } catch (err) {
    console.error("Error fetching deadline:", err);
    res.status(500).json({ error: "Failed to fetch deadline" });
  }
});


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
    companyName: 'GreenCycle Consulting Inc.',
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

app.get('/dashboard', async (req, res) => {
  try {
    const { topSectors,
      topWasteTypes } = await getTopDashboardData();

    res.render('dashboard/dashboard-home', {
      layout: 'dashboard',
      title: 'Main Dashboard | GC Dashboard',
      current_home: true,
      topSectors,
      topWasteTypes
    });
  } catch (err) {
    console.error("Error fetching top data:", err);
    res.status(500).send("Failed to load dashboard data.");
  }
});


// Waste guide
app.get('/dashboard/guide', (req, res) => {
  res.render('dashboard/guide', {
    layout: 'dashboard',
    title: 'Waste Guide | GC Dashboard',
    current_guide: true
  })
})

app.get('/dashboard/deadline', async (req, res) => {
  try {
    const deadline = new Date('2025-08-30T23:59:59Z'); // Example

    res.render('dashboard/deadline', {
      layout: 'dashboard',     // uses dashboard.hbs layout
      current_deadline: true,  // highlights nav link
      deadline: deadline.toISOString()
    });
  } catch (err) {
    console.error("Error loading deadline:", err);
    res.status(500).send("Failed to load deadline page");
  }
});



// User notifs
app.get('/dashboard/notifications', async (req, res) => {
  const currentUser = req.session.user.id

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Initialize
  const [notifications, total] = await Promise.all([
    getNotifications(currentUser, limit, offset),
    getNotificationCount(currentUser)
  ]);
  const totalPages = Math.ceil(total / limit);
  const startEntry = total === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, total);

  res.render('dashboard/notifications', {
    layout: 'dashboard',
    title: 'Notifications | GC Dashboard',
    current_notifs: true,
    notifications,
    currentPage: page,
    totalPages,
    totalNotifs: total,
    startEntry,
    endEntry
  })
})

// Toggle notif
app.post('/notifications/toggle/:notifId', async (req, res) => {
  const notifId = parseInt(req.params.notifId);
  const isRead = req.body.isRead ? 1 : 0;

  try {
    await updateNotifRead(notifId, isRead);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
})

// Link button sets notif to read
app.post('/notifications/read/:id', async (req, res) => {
  const notifId = req.params.id;
  const { isRead } = req.body;

  try {
    await updateNotifRead(notifId, isRead);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update notification:', err);
    res.status(500).json({ success: false });
  }
});

// Notif batch action
app.patch('/notifications/mark-read-batch', async (req, res) => {
  try {
    const { ids, is_read } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No notification IDs provided' });
    }

    await updateNotifReadBatch(ids, is_read ? 1 : 0);

    res.json({ success: true });
  } catch (err) {
    console.error('Batch mark-read error:', err);
    res.status(500).json({ success: false });
  }
});

// Delete notif using x button
app.delete('/notifications/delete/:id', async (req, res) => {
  const notifId = req.params.id;
  try {
    await deleteNotification(notifId)

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to delete notification:', err);
    res.status(500).json({ success: false });
  }
});

// Delete notif thru selection
app.delete('/notifications/delete-batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    }

    await deleteNotificationsBatch(ids);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Batch delete error:', err);
    res.status(500).json({ success: false });
  }
});

// Update notif count
app.get('/notifications/update-count', async (req, res) => {
  try {
    // Assuming you store the logged-in user's ID in the session
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Get total notification count
    const totalCount = await getUnreadNotifCount(userId);

    return res.json({ success: true, total: totalCount });
  } catch (error) {
    console.error('Error updating notification count:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching notification count' });
  }
});

// Display data summary
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
  const { title, region, province, municipality, barangay, author, company, startDate, endDate, aggregation } = req.query

  try {
      /* ------ LOCATION NAME ------ */
      // Use the most specific locationCode available
      const locationCode = barangay || municipality || province || region || null;
      const wasteCompliances = await getWasteComplianceStatusFromSummary(title, region, province, locationCode, author, company, startDate, endDate);
      const sectorCompliances = await getSectorComplianceStatusFromSummary(title, region, province, locationCode, author, company, startDate, endDate);
      
      // Prepare PSGC data for location names
      const psgcRegions = await PSGCResource.getRegions()
      const psgcProvinces = await PSGCResource.getProvinces()
      const psgcMunicipalities = await PSGCResource.getMunicipalities()
      const psgcCities = await PSGCResource.getCities()

      // Barangay data
      const psgcBarangays = await PSGCResource.getBarangays()
      const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

      // Get location names
      const regionName = getPsgcName(psgcRegions, region) || 'ALL'
      const provinceName = getPsgcName(psgcProvinces, province) || 'ALL'
      const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || 'ALL'
      const barangayName = getPsgcName(psgcBarangays, barangay) || getPsgcName(psgcMunicDistricts, barangay) || getPsgcName(psgcCities, barangay) || 'ALL'

      /* ------ AVERAGE DATA ------ */
      // Retrieve summary data of given location
      const avgInfo = await getAvgInfoWithFilters(title, locationCode, author, company, startDate, endDate)

      // Initialize waste comp
      const sectors = await getSectors()
      const supertypes = await getAllTypes()
      const avgData = await getAvgWasteCompositionWithFilters(title, locationCode, author, company, startDate, endDate);
      const participants = await getSummaryParticipants(title, region, province, locationCode, author, company, startDate, endDate);

      // Initialize time series data
      //const timeSeriesData = getTimeSeriesData(title, locationCode, author, company, startDate, endDate, aggregation || 'daily');
      const timeSeriesData = await getTimeSeriesData(title, locationCode, author, company, startDate, endDate, aggregation || 'daily');

      console.log(timeSeriesData)

      /* ------ DATA COORDS ------ */
      const coords = await getFilteredDataCoords(title, locationCode, author, company, startDate, endDate)
      
      // Filter out null values
      const validCoords = coords.filter(loc => loc.latitude && loc.longitude);

      /* -------- CHART BUILDER -------- */
      // Create a lookup map for waste amounts
      const wasteMap = {}; // type_id -> { sector_id -> total_waste_amount }
      for (const row of avgData) {
        if (!wasteMap[row.type_id]) wasteMap[row.type_id] = {};
        wasteMap[row.type_id][row.sector_id] = Number(row.total_waste_amount);
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
      sectors.forEach(s => (sectorTotals[s.id] = 0));

      const summaryEntries = []; // collect before sorting

      for (const supertype of Object.values(supertypeMap)) {
        const baseColor = baseHexMap[supertype.name] || '#9e9e9e';
        const sectorSubtotals = {};
        sectors.forEach(s => (sectorSubtotals[s.id] = 0));

        let supertypeTotal = 0;

        // Sort internal types by weight
        const sortedTypes = supertype.types
          .map(type => {
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
          })
          .sort((a, b) => b.value - a.value);

        // Apply shaded colors
        const totalTypes = sortedTypes.length;
        sortedTypes.forEach((item, i) => {
          item.color = shadeBarColor(baseColor, i, totalTypes);
        });

        // Bar chart per supertype
        barChartData[supertype.name] = {
          labels: sortedTypes.map(t => t.label),
          data: sortedTypes.map(t => t.value),
          legend: sortedTypes,
        };

        // Collect entry for later sorting
        summaryEntries.push({
          name: supertype.name,
          total: Number(supertypeTotal.toFixed(3)),
          color: baseColor,
        });

        // Optional: store sector subtotals and percentages on supertype object
        for (const id in sectorSubtotals) {
          sectorSubtotals[id] = sectorSubtotals[id].toFixed(3);
        }

        supertype.sectorTotals = sectorSubtotals;
        supertype.totalWeight = supertypeTotal.toFixed(3);
        supertype.percentage =
          grandTotal > 0
            ? ((supertypeTotal / grandTotal) * 100).toFixed(3)
            : "0.000";

        supertype.types.forEach(type => {
          type.totalWeight = type.weight.toFixed(3);
          type.percentage =
            grandTotal > 0
              ? ((type.weight / grandTotal) * 100).toFixed(3)
              : "0.000";
        });
      }

      // ===== Sort and push summary results =====
      summaryEntries.sort((a, b) => b.total - a.total);

      for (const e of summaryEntries) {
        summaryData.labels.push(e.name);
        summaryData.data.push(e.total);
        summaryData.backgroundColor.push(e.color);

        legendData.push({
          label: e.name,
          value: e.total,
          color: e.color,
        });
      }

      // ===== Rebuild detailedData using sorted summary order =====
      detailedData.labels = [];
      detailedData.data = [];
      detailedData.backgroundColor = [];

      for (const e of summaryEntries) {
        const supertype = Object.values(supertypeMap).find(s => s.name === e.name);
        if (!supertype) continue;

        // Get sorted subtypes again (you already have them stored)
        const sortedTypes = supertype.types
          .slice() // clone
          .sort((a, b) => b.weight - a.weight);

        sortedTypes.forEach((t, i) => {
          if (t.weight > 0) {
            detailedData.labels.push(t.name);
            detailedData.data.push(Number(t.weight.toFixed(3)));
            detailedData.backgroundColor.push(
              shadeColor(e.color, -0.3 + 0.08 * i)
            );
          }
        });
      }

      // ===== Sector Bar Chart =====
      const sectorBarData = sectors
        .map((sector, i) => ({
          label: sector.name,
          value: Number(sectorTotals[sector.id]?.toFixed(3)) || 0,
          color: `hsl(${210 + i * 15}, 70%, 55%)`,
        }))
        .sort((a, b) => b.value - a.value);

      // ===== Sector Pie Charts =====
      const sectorPieData = {};
      for (const sector of sectors) {
        const sectorId = sector.id;
        const rawTotals = Object.values(supertypeMap)
          .map(supertype => {
            let subtotal = 0;
            for (const type of supertype.types) {
              subtotal += Number(type.amounts?.[sectorId] || 0);
            }
            return {
              label: supertype.name,
              value: Number(subtotal.toFixed(3)),
              color: baseHexMap[supertype.name] || '#9E9E9E',
            };
          })
          .sort((a, b) => b.value - a.value);

        sectorPieData[sector.name] = {
          labels: rawTotals.map(r => r.label),
          data: rawTotals.map(r => r.value),
          backgroundColor: rawTotals.map(r => r.color),
        };
      }

      // Generate waste recommendations
      const sortedLegend = [...legendData].sort((a, b) => b.value - a.value);

      // Icon mapping by category (base icons only, color will be set by priority)
      const iconMap = {
        'Biodegradable': 'fa-seedling',
        'Recyclable': 'fa-recycle',
        'Residual': 'fa-trash',
        'Special/Hazardous': 'fa-radiation'
      };

      const recommendations = sortedLegend.map((item, index) => {
        const cat = item.label;
        const value = item.value;
        const iconClass = iconMap[cat] || 'fa-question-circle'; // fallback icon
        let priorityClass = '';
        let message = '';

        if (value === 0) {
          priorityClass = 'low-priority';
          message = `<strong>${cat}</strong> has <strong>no recorded data</strong> for this period. <em>This may indicate either the absence of this waste type or a gap in reporting. Review data collection practices to confirm accuracy and completeness.</em>`;
        } else if (index === 0) {
          priorityClass = 'high-priority';
          message = `<strong>${cat}</strong> is the <strong>largest contributor</strong> to overall waste. <em>Focus efforts on waste reduction, community education, alternative disposal methods (e.g., composting or recycling), and stronger enforcement of waste segregation at source.</em>`;
        } else if (index === 1 || index === 2) {
          priorityClass = 'mid-priority';
          message = `<strong>${cat}</strong> represents a <strong>moderate proportion</strong> of total waste. <em>Monitor trends closely and implement consistent collection programs to sustain or improve performance.</em>`;
        } else {
          priorityClass = 'low-priority';
          message = `<strong>${cat}</strong> makes up a <strong>small share</strong> of total waste. <em>Maintain proper collection and monitoring to ensure this remains accurate and that waste of this type continues to be well-managed.</em>`;
        }

        return `
          <div class="${priorityClass}" style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <i class="fas ${iconClass} insight-icon" style="font-size: 1.8rem; flex-shrink: 0; margin-top: auto; margin-bottom: auto;"></i>
            <span>${message}</span>
          </div>
        `;
      });

      const groupedByOrg = participants.reduce((acc, p) => {
        if (!p.company_name) return acc;
        if (!acc[p.company_name]) acc[p.company_name] = new Set();
        acc[p.company_name].add(p.author_name);
        return acc;
      }, {});

      // Convert to array for Handlebars
      const orgGroups = Object.entries(groupedByOrg).map(([company_name, users]) => ({
        company_name,
        users: Array.from(users)
      }));

      // Collect unique location strings
      const uniqueLocations = [...new Set(participants.map(p => {
        const region = getPsgcName(psgcRegions, p.region_id);
        const province = getPsgcName(psgcProvinces, p.province_id);
        const municipality = getPsgcName(psgcMunicipalities, p.municipality_id) || getPsgcName(psgcCities, p.municipality_id);
        const barangay = getPsgcName(psgcBarangays, p.barangay_id) || getPsgcName(psgcMunicDistricts, p.barangay_id) || getPsgcName(psgcCities, p.barangay_id);

        return [barangay, municipality, province, region].filter(Boolean).join(", ");
      }).filter(Boolean))];

      // Compliance narratives
      const wasteComplianceNarrative = generateCategoryComplianceNarrative(wasteCompliances);
      const sectorComplianceNarrative = generateSectorComplianceNarrative(sectorCompliances);

      res.render('dashboard/view-data-summary', {
        layout: 'dashboard',
        title: 'Data Summary | GC Dashboard',
        current_all: true,
        query: req.query, // Pass current query
        avgInfo: avgInfo[0],
        barChartData: JSON.stringify(barChartData),
        supertypeDemo: JSON.stringify(supertypeMap),
        grandTotal: grandTotal.toFixed(3),
        summaryPieData: JSON.stringify(summaryData),
        detailedPieData: JSON.stringify(detailedData),
        orgGroups,
        uniqueLocations,
        legendData,
        wasteCompliances,
        sectorCompliances,
        recommendations,
        sectorBarData: JSON.stringify(sectorBarData),
        sectorPieData: JSON.stringify(sectorPieData),
        regionName, provinceName, municipalityName, barangayName,
        locations: JSON.stringify(validCoords), // map coords
        show_generate_btn: true,
        isSummary: true,
        wasteComplianceNarrative,
        sectorComplianceNarrative,
        timeSeriesData: JSON.stringify(timeSeriesData)
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
    title, region, province, municipality, barangay, author, company, startDate, endDate
  } = req.query;

  // Use the most specific locationCode available
  const locationCode = barangay || municipality || province || region || null;

  const [data, totalCount, companies] = await Promise.all([
    getDataWithFilters(limit, offset, title, locationCode, author, company, startDate, endDate),
    getFilteredDataCount(title, locationCode, author, company, startDate, endDate),
    getAllCompanies()
  ]);

  // Prefill location dropdowns
  let prefill = {}

  if(region) prefill.region = region
  if(province) prefill.province = province
  if(municipality) prefill.municipality = municipality
  if(barangay) prefill.barangay = barangay

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
    prefill,
    companies
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

  // Get data and counts
  const data = await getPendingData(omitUser, limit, offset)
  let pendingCount = await getDataForReviewCount(omitUser, 'Pending Review')
  const revisionCount = await getDataForReviewCount(omitUser, 'Needs Revision')
  const revisedCount = await getDataForReviewCount(omitUser, 'Revised')

  console.log(data)

  pendingCount += revisedCount
  const totalCount = pendingCount

  // Pagination offset
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-pending', {
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
    currentPage: page,
    currentUser: omitUser
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

  // Get data and counts
  const data = await getDataForReview(omitUser, 'Needs Revision', limit, offset)
  let pendingCount = await getDataForReviewCount(omitUser, 'Pending Review')
  const revisionCount = await getDataForReviewCount(omitUser, 'Needs Revision')
  const revisedCount = await getDataForReviewCount(omitUser, 'Revised')

  pendingCount += revisedCount
  const totalCount = revisionCount

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

  // If status is 'Needs Revision', get revision logs and count
  let revisionLogs = {}
  let revisionCount = 0

  if(wasteGen.status === 'Needs Revision') {
    revisionLogs = await getRevisionEntries(entryId)
    revisionCount = await getRevisionEntryCount(entryId)
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
    current_in_progress: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    entryId,
    revisionCount,
    revisionLogs
  })
})

// Get approved data entries by current user
app.get('/dashboard/data/user/approved', async (req, res) => {
  const user = Number(req.session.user.id)

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Retrieve data and count
  const [data, totalCount] = await Promise.all([
    getDataByUser(user, 'Approved', limit, offset),
    getDataByUserCount(user, 'Approved')
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

// Get data entries for revision by current user
app.get('/dashboard/data/user/revision', async (req, res) => {
  // Current user
  const user = req.session.user.id

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Get data and counts
  const data = await getDataByUser(user, 'Needs Revision', limit, offset)
  const revisionCount = await getDataByUserCount(user, 'Needs Revision')
  const pendingCount = await getDataByUserCount(user, 'Pending Review')

  // Set current total count
  const totalCount = revisionCount

  // Pagination offset
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-all', {
    layout: 'dashboard',
    title: 'Submissions in Progress | GC Dashboard',
    data,
    current_in_progress: true,
    revision: true,
    totalPages,
    totalCount,
    pendingCount,
    revisionCount,
    startEntry,
    endEntry,
    currentPage: page
  })
})

// Get data entries for revision by current user
app.get('/dashboard/data/user/pending', async (req, res) => {
  // Current user
  const user = req.session.user.id

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  // Get data and counts
  const data = await getDataByUser(user, 'Pending Review', limit, offset)
  const revisionCount = await getDataByUserCount(user, 'Needs Revision')
  const pendingCount = await getDataByUserCount(user, 'Pending Review')

  // Set current total count
  const totalCount = pendingCount

  // Pagination offset
  const totalPages = Math.ceil(totalCount / limit);
  const startEntry = totalCount === 0 ? 0 : offset + 1;
  const endEntry = Math.min(offset + limit, totalCount);

  res.render('dashboard/list-data-all', {
    layout: 'dashboard',
    title: 'Submissions in Progress | GC Dashboard',
    data,
    current_in_progress: true,
    pending: true,
    totalPages,
    totalCount,
    pendingCount,
    revisionCount,
    startEntry,
    endEntry,
    currentPage: page
  })
})

// View one data entry (for review)
app.get('/dashboard/data/review/:id', async (req, res) => {
  const entryId = req.params.id
  const reviewer = req.session.user.id

  const [wasteGen, sectors, supertypes, wasteComp, revisionEntryCount, taskStatus] = await Promise.all([
    getWasteGenById(entryId),
    getSectors(),
    getAllTypes(),
    getWasteCompById(entryId),
    getRevisionEntryCount(entryId),
    getTaskClaimStatus(entryId, reviewer)
  ]);

  // If revision log count is greater than 0, retrieve entries
  let revisionLogs = {}
  if(revisionEntryCount > 0) revisionLogs = await getRevisionEntries(entryId)

  // Create lookup: { [type_id]: { [sector_id]: amount } }
  const wasteMap = {};
  for (const { type_id, sector_id, waste_amount } of wasteComp) {
    wasteMap[type_id] ??= {};
    wasteMap[type_id][sector_id] = waste_amount;
  }

  // Build supertypes + types + waste amounts
  const supertypeMap = {};
  for (const row of supertypes) {
    const { supertype_id, supertype_name, type_id, type_name } = row;
    supertypeMap[supertype_id] ??= { id: supertype_id, name: supertype_name, types: [] };
    supertypeMap[supertype_id].types.push({
      id: type_id,
      name: type_name,
      amounts: wasteMap[type_id] || {},
    });
  }

  // Compute total weight per type and grand total
  let grandTotal = 0;
  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      const total = Object.values(type.amounts).reduce((sum, val) => sum + Number(val), 0);
      type.totalWeight = total.toFixed(3);
      grandTotal += total;
    }
  }

  // Compute % of total for each type
  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      type.percentage = grandTotal
        ? ((type.totalWeight / grandTotal) * 100).toFixed(3)
        : '0.000';
    }
  }

  // Sector totals (grand total per sector across all types)
  const sectorTotals = Object.fromEntries(sectors.map(s => [s.id, 0]));
  for (const supertype of Object.values(supertypeMap)) {
    for (const type of supertype.types) {
      for (const [sectorId, value] of Object.entries(type.amounts)) {
        sectorTotals[sectorId] += Number(value);
      }
    }
  }

  // Compute subtotal per supertype (per sector) and its percentage
  for (const supertype of Object.values(supertypeMap)) {
    const subTotals = Object.fromEntries(sectors.map(s => [s.id, 0]));
    let subtotalWeight = 0;

    for (const type of supertype.types) {
      for (const [sectorId, val] of Object.entries(type.amounts)) {
        subTotals[sectorId] += Number(val);
        subtotalWeight += Number(val);
      }
    }

    // Format
    for (const id in subTotals) {
      subTotals[id] = subTotals[id].toFixed(3);
    }

    supertype.sectorTotals = subTotals;
    supertype.totalWeight = subtotalWeight.toFixed(3);
    supertype.percentage = grandTotal
      ? ((subtotalWeight / grandTotal) * 100).toFixed(3)
      : '0.000';
  }

  res.render('dashboard/view-data-review', {
    layout: 'dashboard',
    title: `${wasteGen.title} | GC Dashboard`,
    wasteGen,
    submitter: wasteGen.user_id,
    title: wasteGen.title,
    current_datasubs: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    entryId,
    reviewer,
    revisionEntryCount,
    revisionLogs,
    taskStatus
  })
})

// Claim a task
app.post('/api/task/:id/claim', async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const claimed_by = req.session.user.id; // assuming session stores current user

    const affected = await claimTask(taskId, claimed_by);
    if (affected === 0) {
      req.flash('error', 'Task has already been claimed by someone else.');
    }

    // Redirect explicitly to referrer or fallback to tasks route
    const backUrl = req.get('Referrer') || '/dashboard/data/submissions/pending';
    res.redirect(backUrl);
  } catch (err) {
    console.error('Error claiming task:', err);
    next(err);
  }
});

// Unclaim a task
app.post('/api/task/:id/unclaim', async (req, res, next) => {
  try {
    const taskId = req.params.id;

    await unclaimTask(taskId);

    // Redirect to task list after unclaiming
    res.redirect('/dashboard/data/submissions/pending');
  } catch (err) {
    console.error('Error unclaiming task:', err);
    next(err);
  }
});

function generateCategoryComplianceNarrative(categoryRows) {
  if (!categoryRows || !categoryRows.length) {
    return "No waste category compliance data available for this entry.";
  }

  const compliant = categoryRows.filter(c => c.compliance_status === 'Compliant');
  const nonCompliant = categoryRows.filter(c => c.compliance_status === 'Non-Compliant');

  // use correct field names for summary route
  const avgDiversion = categoryRows.reduce((sum, c) => sum + Number(c.diversion_percentage || c.diversion_pct || 0), 0) / categoryRows.length;
  const avgTarget = categoryRows.reduce((sum, c) => sum + Number(c.target_percentage || c.target_rate || 0), 0) / categoryRows.length;

  let narrative = `<div class='insight-compliance'>Among the four major waste categories, the overall average diversion rate is <b>${avgDiversion.toFixed(2)}%</b>, compared to the average target rate of <b>${avgTarget.toFixed(2)}%</b>.<br><br> `;

  if (compliant.length === categoryRows.length) {
    narrative += "All waste categories met or exceeded their diversion targets, indicating strong compliance across the board.";
  } else if (nonCompliant.length === categoryRows.length) {
    narrative += "<b style='color:red'>None of the waste categories achieved their diversion targets</b>, showing a need for improved waste recovery efforts.";
  } else {
    const compliantNames = compliant.map(c => c.supertype_name).join(", ");
    const nonCompliantNames = nonCompliant.map(c => c.supertype_name).join(", ");

    narrative += `The following categories are compliant: <b>${compliantNames || 'None'}</b>. `;
    narrative += `Meanwhile, the following are non-compliant: <b style='color:red'>${nonCompliantNames || 'None'}</b>. `;
    narrative += "This mixed performance suggests that certain waste streams are being managed more effectively than others.";
  }

  narrative += "</div>";

  return narrative;
}


function generateSectorComplianceNarrative(sectorRows) {
  if (!sectorRows || !sectorRows.length) {
    return "No waste sector compliance data available for this entry.";
  }

  const compliant = sectorRows.filter(s => s.compliance_status === 'Compliant');
  const nonCompliant = sectorRows.filter(s => s.compliance_status === 'Non-Compliant');

  // use correct field names for summary route
  const avgDiversion = sectorRows.reduce((sum, s) => sum + Number(s.diversion_percentage || s.diversion_pct || 0), 0) / sectorRows.length;
  const avgTarget = sectorRows.reduce((sum, s) => sum + Number(s.target_percentage || s.target_rate || 0), 0) / sectorRows.length;

  let narrative = `<div class='insight-compliance'>Across all economic sectors, the average diversion rate is <b>${avgDiversion.toFixed(2)}%</b>, compared to the target rate of <b>${avgTarget.toFixed(2)}%</b>.<br><br>`;

  if (compliant.length === sectorRows.length) {
    narrative += "All sectors are compliant, reflecting broad adherence to waste management targets.";
  } else if (nonCompliant.length === sectorRows.length) {
    narrative += "<b style='color:red'>All sectors are non-compliant</b>, indicating significant challenges in meeting diversion goals.";
  } else {
    const compliantNames = compliant.map(s => s.sector_name || s.name).join(", ");
    const nonCompliantNames = nonCompliant.map(s => s.sector_name || s.name).join(", ");

    narrative += `Compliant sectors include: <b>${compliantNames || 'None'}</b>. `;
    narrative += `Non-compliant sectors include: <b style='color:red'>${nonCompliantNames || 'None'}</b>. `;
    narrative += "This suggests that compliance levels vary depending on the sector's waste generation and collection efficiency.";
  }

  narrative += "</div>";

  return narrative;
}

// View one data entry
app.get('/dashboard/data/:id', async (req, res) => {
  const id = req.params.id;
  const wasteGen = await getWasteGenById(id);
  const sectors = await getSectors();
  const supertypes = await getAllTypes();
  const wasteComp = await getWasteCompById(id);
  const wasteCompliance = await getWasteComplianceStatus(id);
  const sectorCompliance = await getSectorComplianceStatus(id);

  // Retrieve location coordinates
  const coords = await getCoordinates(wasteGen.location_name)

  // If location contains no coords, search for coords again
  if (!coords) {
    const fetchCoords = await fetchCoordinates(wasteGen.location_name)

    if(fetchCoords)
      await createLocationEntry(wasteGen.location_name, fetchCoords.latitude, fetchCoords.longitude)
  }

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

  const summaryEntries = []; // collect before sorting

  for (const supertype of Object.values(supertypeMap)) {
    const baseColor = baseHexMap[supertype.name] || '#9e9e9e';
    const sectorSubtotals = {};
    sectors.forEach(s => (sectorSubtotals[s.id] = 0));

    let supertypeTotal = 0;

    const sortedTypes = supertype.types
      .map(type => {
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
      })
      .sort((a, b) => b.value - a.value);

    const totalTypes = sortedTypes.length;
    sortedTypes.forEach((item, i) => {
      item.color = shadeBarColor(baseColor, i, totalTypes);
    });

    barChartData[supertype.name] = {
      labels: sortedTypes.map(t => t.label),
      data: sortedTypes.map(t => t.value),
      legend: sortedTypes,
    };

    // collect entry for later sorting
    summaryEntries.push({
      name: supertype.name,
      total: Number(supertypeTotal.toFixed(3)),
      color: baseColor,
    });

    for (const id in sectorSubtotals) {
      sectorSubtotals[id] = sectorSubtotals[id].toFixed(3);
    }

    supertype.sectorTotals = sectorSubtotals;
    supertype.totalWeight = supertypeTotal.toFixed(3);
    supertype.percentage =
      grandTotal > 0
        ? ((supertypeTotal / grandTotal) * 100).toFixed(3)
        : "0.000";

    supertype.types.forEach(type => {
      type.totalWeight = type.weight.toFixed(3);
      type.percentage =
        grandTotal > 0
          ? ((type.weight / grandTotal) * 100).toFixed(3)
          : "0.000";
    });
  }

  // ===== Sort and push summary results =====
  summaryEntries.sort((a, b) => b.total - a.total);

  for (const e of summaryEntries) {
    summaryData.labels.push(e.name);
    summaryData.data.push(e.total);
    summaryData.backgroundColor.push(e.color);

    legendData.push({
      label: e.name,
      value: e.total,
      color: e.color,
    });
  }

  // ===== Rebuild detailedData using sorted summary order =====
  detailedData.labels = [];
  detailedData.data = [];
  detailedData.backgroundColor = [];

  for (const e of summaryEntries) {
    const supertype = Object.values(supertypeMap).find(s => s.name === e.name);
    if (!supertype) continue;

    // Get sorted subtypes again (you already have them stored)
    const sortedTypes = supertype.types
      .slice() // clone
      .sort((a, b) => b.weight - a.weight);

    sortedTypes.forEach((t, i) => {
      if (t.weight > 0) {
        detailedData.labels.push(t.name);
        detailedData.data.push(Number(t.weight.toFixed(3)));
        detailedData.backgroundColor.push(
          shadeColor(e.color, -0.3 + 0.08 * i)
        );
      }
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

  // Generate waste recommendations
  const sortedLegend = [...legendData].sort((a, b) => b.value - a.value);

  // Icon mapping by category (base icons only, color will be set by priority)
  const iconMap = {
    'Biodegradable': 'fa-seedling',
    'Recyclable': 'fa-recycle',
    'Residual': 'fa-trash',
    'Special/Hazardous': 'fa-radiation'
  };

  // Print general recommendations (colored insight blocks)
  const recommendations = sortedLegend.map((item, index) => {
    const cat = item.label;
    const value = item.value;
    const iconClass = iconMap[cat] || 'fa-question-circle'; // fallback icon
    let priorityClass = '';
    let message = '';

    if (value === 0) {
      priorityClass = 'low-priority';
      message = `<strong>${cat}</strong> has <strong>no recorded data</strong> for this period. <em>This may indicate either the absence of this waste type or a gap in reporting. Review data collection practices to confirm accuracy and completeness.</em>`;
    } else if (index === 0) {
      priorityClass = 'high-priority';
      message = `<strong>${cat}</strong> is the <strong>largest contributor</strong> to overall waste. <em>Focus efforts on waste reduction, community education, alternative disposal methods (e.g., composting or recycling), and stronger enforcement of waste segregation at source.</em>`;
    } else if (index === 1 || index === 2) {
      priorityClass = 'mid-priority';
      message = `<strong>${cat}</strong> represents a <strong>moderate proportion</strong> of total waste. <em>Monitor trends closely and implement consistent collection programs to sustain or improve performance.</em>`;
    } else {
      priorityClass = 'low-priority';
      message = `<strong>${cat}</strong> makes up a <strong>small share</strong> of total waste. <em>Maintain proper collection and monitoring to ensure this remains accurate and that waste of this type continues to be well-managed.</em>`;
    }

    return `
      <div class="${priorityClass}" style="display: flex; align-items: flex-start; gap: 0.75rem;">
        <i class="fas ${iconClass} insight-icon" style="font-size: 1.8rem; flex-shrink: 0; margin-top: auto; margin-bottom: auto;"></i>
        <span>${message}</span>
      </div>
    `;
  });

  // Compliance narratives
  const wasteComplianceNarrative = generateCategoryComplianceNarrative(wasteCompliance);
  const sectorComplianceNarrative = generateSectorComplianceNarrative(sectorCompliance);

  res.render('dashboard/view-data-entry', {
    layout: 'dashboard',
    title: `${wasteGen.title} | GC Dashboard`,
    wasteGen,
    current_all: true,
    sectors,
    supertypes: Object.values(supertypeMap),
    supertypeDemo: JSON.stringify(supertypeMap),
    sectorTotals,
    grandTotal: grandTotal.toFixed(3),
    barChartData: JSON.stringify(barChartData),
    summaryPieData: JSON.stringify(summaryData),
    detailedPieData: JSON.stringify(detailedData),
    legendData,
    wasteCompliance,
    sectorCompliance,
    recommendations,
    sectorBarData: JSON.stringify(sectorBarData),
    sectorPieData: JSON.stringify(sectorPieData),
    coords: JSON.stringify(coords),
    show_generate_btn: true,
    data_entry: true,
    isSummary: false,
    entryId: req.params.id,
    wasteComplianceNarrative,
    sectorComplianceNarrative
  });
});

// Generate PDF report (data summary version)
app.post("/api/data/summary/pdf", async (req, res) => {
  const { sections, query } = req.body; // array of section IDs (from modal)

  if (!sections || !Array.isArray(sections)) {
    return res.status(400).json({ error: "Missing or invalid sections list" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: "new", // faster startup mode
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // improves perf in low-memory
        "--disable-extensions",
        "--disable-gpu"
      ]
    });
    const page = await browser.newPage();

    // User login cookie
    const cookies = req.headers.cookie
      ?.split(";")
      .map(c => {
        const [name, ...rest] = c.trim().split("=");
        return { name, value: rest.join("="), domain: "localhost" };
      }) || [];

    await page.setCookie(...cookies);

    const cleanedQuery = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== '') cleanedQuery[key] = value;
    }

    const queryString = new URLSearchParams(cleanedQuery).toString();
    const reportUrl = `http://localhost:3000/dashboard/data/summary?${queryString}`;

    // Navigate to report view page (server-rendered HTML)
    await page.setViewport({ width: 1440, height: 1080 });
    await page.goto(reportUrl, { waitUntil: "domcontentloaded" });

    // ensure page rendered
    await page.waitForSelector("body", { timeout: 10000 });

    // Expand all tab contents
    await page.evaluate(() => {
      document.querySelectorAll(".tabcontent, .bar-tabcontent, .sector-tabcontent")
        .forEach(el => {
          el.style.display = "block";
          el.style.visibility = "visible";
          el.style.opacity = "1";
          el.style.height = "auto";
        });
    });

    // Wait a tick to ensure they actually paint
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ensure bar charts render fully before export
    await page.evaluate(async () => {
      // Set CSS width only (do not touch canvas.width)
      document.querySelectorAll("canvas.bar-canvas").forEach(canvas => {
        const parentWidth = canvas.parentElement?.offsetWidth || 700;
        canvas.style.width = parentWidth + "px";
        canvas.style.maxWidth = parentWidth + "px";
        canvas.style.height = "auto";
      });

      // Ask Chart.js to resize if it's loaded
      if (window.Chart && window.Chart.instances) {
        Object.values(window.Chart.instances).forEach(chart => {
          try {
            if (chart.resize) chart.resize();
          } catch (e) {
            console.warn("Chart resize failed:", e);
          }
        });
      }

      // Give browser a repaint tick
      await new Promise(r => setTimeout(r, 1000));
    });

    // Convert canvases to images
    await page.evaluate(() => {
      document.querySelectorAll("canvas").forEach(canvas => {
        try {
          const img = document.createElement("img");
          img.src = canvas.toDataURL("image/png");
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          canvas.replaceWith(img);
        } catch (e) {
          console.error("Canvas export failed", e);
        }
      });
    });

    // Order map: array of arrays (each inner array = one page)
    const sectionGroups = [
      ["filters", "data-title", "data-info", "participants"],
      ["compliance-category", "compliance-sector"],
      ["trends-wastegen", "trends-percapita", "trends-category", "trends-compliance"],
      ["insights", "top-categories"],
      ["top-cats", "types-biodegradable"],
      ["types-recyclable"],
      ["types-residual"],
      ["types-special/hazardous"],
      ["top-sectors"],
      ["cats-per-sector", "top-residential", "top-commercial"],
      ["top-institutional", "top-industrial"],
      ["top-health", "top-agriculture and livestock"]
    ];

    // Extract HTML in print order
    const selectedHtml = await page.evaluate((groups, keepSections) => {
      const allSections = Array.from(document.querySelectorAll("[data-section]"))
        .reduce((map, el) => {
          map[el.getAttribute("data-section")] = el.outerHTML;
          return map;
        }, {});

      return groups.map(group => {
        const content = group
          .filter(id => keepSections.includes(id)) // only if selected
          .map(id => allSections[id] || "")
          .join("");
        return content ? `<div class="pdf-page">${content}</div>` : "";
      }).join("");
    }, sectionGroups, sections);

    // Build a new page with just the selected sections
    const printPage = await browser.newPage();
    await printPage.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/dashboard-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/admin-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/chart-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/print-style.css" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/handlebars/dist/handlebars.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://kit.fontawesome.com/2fcb76e57d.js" crossorigin="anonymous"></script>
        </head>
        <body>
          ${selectedHtml}
        </body>
      </html>
    `, { waitUntil: "domcontentloaded" });

    // Wait for all web fonts (including Font Awesome) to finish loading
    await printPage.evaluateHandle('document.fonts.ready');

    // Ensure Font Awesome icons are visible
    await printPage.waitForFunction(() => {
      const icons = Array.from(document.querySelectorAll("i.fas, i.fa, i.far, i.fab"));
      if (icons.length === 0) return true; // no icons to wait for
      return icons.every(icon => {
        const style = window.getComputedStyle(icon, "::before");
        return style && style.content && style.content !== "none" && style.content !== '""';
      });
    }, { timeout: 500 });

    // Generate PDF
    const pdfBuffer = await printPage.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 0.8,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm"
      }
    });

    await browser.close();

    // Send PDF as response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Waste_Report.pdf",
    });
    res.end(pdfBuffer);

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Generate PDF report
app.post("/api/data/:entryId(\\d+)/pdf", async (req, res) => {
  const { entryId } = req.params;
  const { sections } = req.body; // array of section IDs (from modal)

  console.log("DATA ENTRY MODE")

  if (!sections || !Array.isArray(sections)) {
    return res.status(400).json({ error: "Missing or invalid sections list" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: "new", // faster startup mode
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // improves perf in low-memory
        "--disable-extensions",
        "--disable-gpu"
      ]
    });
    const page = await browser.newPage();

    // User login cookie
    const cookies = req.headers.cookie
      ?.split(";")
      .map(c => {
        const [name, ...rest] = c.trim().split("=");
        return { name, value: rest.join("="), domain: "localhost" };
      }) || [];

    await page.setCookie(...cookies);

    await page.setViewport({ width: 1440, height: 1080 });

    // Navigate to report view page (server-rendered HTML)
    const reportUrl = `http://localhost:3000/dashboard/data/${entryId}`;
    await page.goto(reportUrl, { waitUntil: "domcontentloaded" });

    // ensure page rendered
    await page.waitForSelector("body", { timeout: 10000 });

    // Expand all tab contents
    await page.evaluate(() => {
      document.querySelectorAll(".tabcontent, .bar-tabcontent, .sector-tabcontent")
        .forEach(el => {
          el.style.display = "block";
          el.style.visibility = "visible";
          el.style.opacity = "1";
          el.style.height = "auto";
        });
    });

    // Wait a tick to ensure they actually paint
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Ensure bar charts render fully before export
    await page.evaluate(async () => {
      // Set CSS width only (do not touch canvas.width)
      document.querySelectorAll("canvas.bar-canvas").forEach(canvas => {
        const parentWidth = canvas.parentElement?.offsetWidth || 700;
        canvas.style.width = parentWidth + "px";
        canvas.style.maxWidth = parentWidth + "px";
        canvas.style.height = "auto";
      });

      // Ask Chart.js to resize if it's loaded
      if (window.Chart && window.Chart.instances) {
        Object.values(window.Chart.instances).forEach(chart => {
          try {
            if (chart.resize) chart.resize();
          } catch (e) {
            console.warn("Chart resize failed:", e);
          }
        });
      }

      // Give browser a repaint tick
      await new Promise(r => setTimeout(r, 1000));
    });

    // Convert canvases to images
    await page.evaluate(() => {
      document.querySelectorAll("canvas").forEach(canvas => {
        try {
          const img = document.createElement("img");
          img.src = canvas.toDataURL("image/png");
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          canvas.replaceWith(img);
        } catch (e) {
          console.error("Canvas export failed", e);
        }
      });
    });

    // Order map: array of arrays (each inner array = one page)
    const sectionGroups = [
      ["data-title", "data-info", "compliance-category", "compliance-sector"],
      ["insights", "top-categories"],
      ["top-cats", "types-biodegradable"],
      ["types-recyclable"],
      ["types-residual"],
      ["types-special/hazardous"],
      ["top-sectors"],
      ["cats-per-sector", "top-residential", "top-commercial"],
      ["top-institutional", "top-industrial"],
      ["top-health", "top-agriculture and livestock"],
      ["raw-desc", "raw-data"]
    ];

    // Extract HTML in print order
    const selectedHtml = await page.evaluate((groups, keepSections) => {
      const allSections = Array.from(document.querySelectorAll("[data-section]"))
        .reduce((map, el) => {
          map[el.getAttribute("data-section")] = el.outerHTML;
          return map;
        }, {});

      return groups.map(group => {
        const content = group
          .filter(id => keepSections.includes(id)) // only if selected
          .map(id => allSections[id] || "")
          .join("");
        return content ? `<div class="pdf-page">${content}</div>` : "";
      }).join("");
    }, sectionGroups, sections);

    // Build a new page with just the selected sections
    const printPage = await browser.newPage();
    await printPage.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/dashboard-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/admin-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/chart-style.css" />
          <link rel="stylesheet" type="text/css" href="http://localhost:3000/css/print-style.css" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/handlebars/dist/handlebars.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://kit.fontawesome.com/2fcb76e57d.js" crossorigin="anonymous"></script>
        </head>
        <body>
          ${selectedHtml}
        </body>
      </html>
    `, { waitUntil: "domcontentloaded" });

    // Wait for all web fonts (including Font Awesome) to finish loading
    await printPage.evaluateHandle('document.fonts.ready');

    // Ensure Font Awesome icons are visible
    await printPage.waitForFunction(() => {
      const icons = Array.from(document.querySelectorAll("i.fas, i.fa, i.far, i.fab"));
      if (icons.length === 0) return true; // no icons to wait for
      return icons.every(icon => {
        const style = window.getComputedStyle(icon, "::before");
        return style && style.content && style.content !== "none" && style.content !== '""';
      });
    }, { timeout: 500 });

    // Generate PDF
    const pdfBuffer = await printPage.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 0.8,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm"
      },
    });

    await browser.close();

    // Send PDF as response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=Waste_Report.pdf",
    });
    res.end(pdfBuffer);

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
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
app.get('/control-panel/users/create', async (req, res) => {
   const companyRoles = await getRolesOfSupertypes([0, 1]) 


  res.render('control-panel/create-user', {
    layout: 'control-panel',
    title: 'Create New Company Account | GC Dashboard',
    current_users: true,
    companyRoles
  });
});

// API: Add client role
app.post('/roles/client', async (req, res) => {
  const { roleName } = req.body
  const role = await createClientRole(roleName)
  res.send(role)
})

app.post('/roles/company', async (req, res) => {
  try {
    const { roleName, supertype } = req.body;
    if (!roleName) return res.status(400).json({ error: "Role name is required" });
    if (supertype === undefined) return res.status(400).json({ error: "Supertype is required" });

    await createCompanyRole(roleName, supertype);
    res.status(201).json({ message: "Company role created successfully" });
  } catch (err) {
    console.error("Error creating company role:", err);
    res.status(500).json({ error: "Server error creating company role" });
  }
});



// Data submission menu
app.get('/dashboard/submit-report', async (req, res) => {
  res.render('dashboard/submit-report-menu', {
    layout: 'dashboard',
    title: 'Data Submission Menu | GC Dashboard',
    current_report: true
  })
})

// Data editing form
app.get('/dashboard/edit-report/:id', async (req, res) => {
  const sectors = await getSectors()
  const supertypes = await getWasteSupertypes()
  const types = await getWasteTypes()

  // Map types to supertypes
  for (const supertype of supertypes) {
    supertype.types = types.filter(t => t.supertype_id === supertype.id)
  }

  const id = req.params.id
  const wasteGen = await getWasteGenById(id)
  const wasteComp = await getWasteCompById(id)

  // Location dropdown prefill
  const prefill = {
    region: wasteGen.region_id,
    province: wasteGen.province_id,
    municipality: wasteGen.municipality_id,
    barangay: wasteGen.barangay_id
  }

  // Format to 'YYYY-MM-DD'
  function formatDateOnly(isoString) {
    return isoString ? new Date(isoString).toISOString().slice(0, 10) : '';
  }

  wasteGen.collection_start = formatDateOnly(wasteGen.collection_start)
  wasteGen.collection_end = formatDateOnly(wasteGen.collection_end)

  // Map waste comp values for table prefill
  const wasteMap = {};
  for (const entry of wasteComp) {
    const key = `${entry.sector_id}-${entry.type_id}`;
    wasteMap[key] = entry.waste_amount;
  }

  res.render('dashboard/data-edit', {
    layout: 'dashboard',
    title: 'Edit Data Entry | GC Dashboard',
    current_user_report: true,
    sectors,
    supertypes,
    types,
    wasteGen,
    prefill,
    wasteMap,
    dataEntryId: req.params.id
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
      supertype_id, supertype_name, type_id, type_name
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

  // Barangays / municipal districts
  const psgcBarangays = await PSGCResource.getBarangays()
  const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

  // Get location names
  const regionName = getPsgcName(psgcRegions, formData.region)
  const provinceName = getPsgcName(psgcProvinces, formData.province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, formData.municipality) || getPsgcName(psgcCities, formData.municipality) || null
  const barangayName = getPsgcName(psgcBarangays, formData.barangay) || getPsgcName(psgcMunicDistricts, formData.barangay) || null

  // Set full location name
  const parts = [barangayName, municipalityName, provinceName, regionName].filter(Boolean)
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

    // Barangays / municipal districts
    const psgcBarangays = await PSGCResource.getBarangays()
    const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

    // Get location names
    const regionName = getPsgcName(psgcRegions, formData.region)
    const provinceName = getPsgcName(psgcProvinces, formData.province) || null
    const municipalityName = getPsgcName(psgcMunicipalities, formData.municipality) || getPsgcName(psgcCities, formData.municipality) || null
    const barangayName = getPsgcName(psgcBarangays, formData.barangay) || getPsgcName(psgcMunicDistricts, formData.barangay) || null

    // Set full location name
    const parts = [barangayName, municipalityName, provinceName, regionName].filter(Boolean)
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
    title, region, province, municipality, barangay, population, per_capita, annual, date_start, date_end, wasteComposition
  } = req.body;

  const currentUser = req.session.user.id

  // Prepare PSGC data for location names
  const psgcRegions = await PSGCResource.getRegions()
  const psgcProvinces = await PSGCResource.getProvinces()
  const psgcMunicipalities = await PSGCResource.getMunicipalities()
  const psgcCities = await PSGCResource.getCities()
  
  // Barangays / municipal districts
  const psgcBarangays = await PSGCResource.getBarangays()
  const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

  // Get location names
  const regionName = getPsgcName(psgcRegions, region)
  const provinceName = getPsgcName(psgcProvinces, province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || null
  const barangayName = getPsgcName(psgcBarangays, barangay) || getPsgcName(psgcMunicDistricts, barangay) || null

  // Set full location name
  const parts = [barangayName, municipalityName, provinceName, regionName].filter(Boolean)
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
    const formResult = await submitForm(
      currentUser, title, region, province, municipality, barangay, fullLocation, population, per_capita, annual, date_start, date_end, newWasteComp
    );

    // Create data review task for staff
    const dataEntryId = formResult.data_entry_id;
    await createTask(dataEntryId);

    res.status(200).json({
      message: "Report submitted successfully"
    });

  } catch (error) {
    console.error("Error processing report:", error);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

app.post("/api/data/edit-report", async (req, res) => {
  // Request body
  const {
    dataEntryId, title, region, province, municipality, barangay, population, per_capita, annual, date_start, date_end, wasteComposition, comment
  } = req.body;

  // Get current logged in user
  const currentUser = req.session.user.id

  // Prepare PSGC data for location names
  const psgcRegions = await PSGCResource.getRegions()
  const psgcProvinces = await PSGCResource.getProvinces()
  const psgcMunicipalities = await PSGCResource.getMunicipalities()
  const psgcCities = await PSGCResource.getCities()
  
  // Barangays / municipal districts
  const psgcBarangays = await PSGCResource.getBarangays()
  const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

  // Get location names
  const regionName = getPsgcName(psgcRegions, region)
  const provinceName = getPsgcName(psgcProvinces, province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || null
  const barangayName = getPsgcName(psgcBarangays, barangay) || getPsgcName(psgcMunicDistricts, barangay) || null

  // Set full location name
  const parts = [barangayName, municipalityName, provinceName, regionName].filter(Boolean)
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
    await updateForm(
      dataEntryId, title, region, province, municipality, barangay, fullLocation, population, per_capita, annual, date_start, date_end, newWasteComp
    );

    // Update entry status to Revised
    await updateDataStatus(dataEntryId, 'Revised')

    // Create new revision entry
    // Insert into data revision log
    const revisionId = await createRevisionEntry(dataEntryId, currentUser, 'Resubmitted', comment)

    // Update current revision
    await updateCurrentLog(dataEntryId, revisionId)

    // Finally, add task
    await createTask(dataEntryId)

    res.status(200).json({
      message: "Report submitted successfully"
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
    title, region, province, municipality, barangay, population, per_capita, annual, date_start, date_end, wasteMatrix, sectorsFromExcel
  } = req.body;

  const currentUser = req.session.user.id

  /* ------- LOCATION NAME ------- */
  // Prepare PSGC data for location names
  const psgcRegions = await PSGCResource.getRegions()
  const psgcProvinces = await PSGCResource.getProvinces()
  const psgcMunicipalities = await PSGCResource.getMunicipalities()
  const psgcCities = await PSGCResource.getCities()
  
  // Barangays / municipal districts
  const psgcBarangays = await PSGCResource.getBarangays()
  const psgcMunicDistricts = await PSGCResource.getMunicipalDistricts()

  // Get location names
  const regionName = getPsgcName(psgcRegions, region)
  const provinceName = getPsgcName(psgcProvinces, province) || null
  const municipalityName = getPsgcName(psgcMunicipalities, municipality) || getPsgcName(psgcCities, municipality) || null
  const barangayName = getPsgcName(psgcBarangays, barangay) || getPsgcName(psgcMunicDistricts, barangay) || null

  // Set full location name
  const parts = [barangayName, municipalityName, provinceName, regionName].filter(Boolean)
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
    const formResult = await submitForm(
      currentUser, title, region, province, municipality, barangay, fullLocation, population, per_capita, annual, date_start, date_end, wasteComposition
    )

    // Create data review task for staff
    const dataEntryId = formResult.data_entry_id
    await createTask(dataEntryId)

    res.status(200).json({
        message: "Report submitted successfully"
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
app.get('/dashboard/noncompliance', async (req, res) => {

  if (!req.session.user) {
    console.log('🚫 No session user found.');
    return res.redirect('/unauthorized');
  }

  const { id, supertype } = req.session.user;

   try {
    const wasteNonCompliantClients = await getWasteNonCompliantClients(id);
    const sectorNonCompliantClients = await getSectorNonCompliantClients(id);

    console.log(`✅ Loaded waste + sector non-compliant data for user ${id}`);

    // Create notifications for waste-type violations
    if (wasteNonCompliantClients.length > 0) {
      // Extract shared client info from the first item
      const { firstname, lastname, company_name } = wasteNonCompliantClients[0];

      // Collect all unique supertypes
      const supertypes = [...new Set(
        wasteNonCompliantClients.map(client => client.supertype_name)
      )];

      // Build message
      const message = `
        <b>${firstname} ${lastname}</b> (${company_name}) is currently 
        <span style="color:red;"><b>non-compliant</b></span> on the following data:
        <ul>
          ${supertypes.map(type => `<li>${type}</li>`).join('')}
        </ul>
      `;

      const link = '/dashboard/noncompliance';

      await createNotification(id, 'Noncompliance Warning', message, link);
    }

    // Create notifications for sector-based violations
    if (sectorNonCompliantClients.length > 0) {
      // Extract shared client info from the first item
      const { firstname, lastname, company_name } = sectorNonCompliantClients[0];

      // Collect all unique supertypes
      const sectors = [...new Set(
        sectorNonCompliantClients.map(client => client.sector_name)
      )];

      // Build message
      const message = `
        Client <b>${firstname} ${lastname}</b> (${company_name}) is currently 
        <span style="color:red;"><b>non-compliant</b></span> on the following sectors:
        <ul>
          ${sectors.map(type => `<li>${type}</li>`).join('')}
        </ul>
      `;

      const link = '/dashboard/noncompliance';

      await createNotification(id, 'Noncompliance Warning', message, link);
    }

    res.render('dashboard/noncompliance-notice', {
      layout: 'dashboard',
      title: 'Non-Compliance Notice | GC Dashboard',
      current_noncompliance: true,
      wasteClients: wasteNonCompliantClients,
      sectorClients: sectorNonCompliantClients
    });
  } catch (error) {
    console.error('❌ Error generating non-compliance:', error);
    res.status(500).send('Error generating non-compliance report.');
  }
});


app.post('/dashboard/noncompliance/pdf', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const firstname = req.session.user?.firstname || 'User';
    const lastname = req.session.user?.lastname || 'Name';
    const filename = `Non-Compliance-${firstname}-${lastname}.pdf`.replace(/\s+/g, '-');

    if (!userId) return res.status(401).send('Unauthorized');

    const wasteClients = await getWasteNonCompliantClients(userId);
    const sectorClients = await getSectorNonCompliantClients(userId);

    if ((!wasteClients || wasteClients.length === 0) && (!sectorClients || sectorClients.length === 0)) {
      return res.status(404).send('No non-compliant records found.');
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#2e7d32').text('GreenCycle Compliance Office', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#555').text('Official Non-Compliance Warning Notice', { align: 'center' });
    doc.moveDown(1);

    // Section: Waste Type Violations
    if (wasteClients.length > 0) {
      doc.fontSize(16).fillColor('#c62828').text('Waste Type Non-Compliance', { underline: true });
      doc.moveDown(0.5);

      wasteClients.forEach(client => {
        doc
          .fillColor('#c62828')
          .fontSize(14)
          .text(`${client.firstname} ${client.lastname} (${client.company_name})`, { underline: true });

        doc
          .moveDown(0.3)
          .fontSize(11)
          .fillColor('#333')
          .text(`Waste Type: ${client.supertype_name || client.sector_name}`)
          .text(`Total Submissions: ${client.entry_count}`)
          .text(`Total Collected: ${client.total_collected} kg`)
          .text(`Annual Generation: ${client.annual_generated} kg`)
          .text(`Achieved: ${client.actual_percent}%`)
          .text(`Target: ${client.target_percent}%`)
          .text('Status:', { continued: true })
          .fillColor(client.compliance_status === 'Compliant' ? 'green' : 'red')
          .text(`  ${client.compliance_status}`)
          .fillColor('black') // reset back to black for next sections
          .moveDown();


        doc
          .fillColor('#2e7d32')
          .fontSize(10)
          .text(`Please ensure future entries meet or exceed the required quota.`, {
            align: 'justify',
            indent: 20,
            lineGap: 2
          })
          .moveDown(1);

        doc
          .strokeColor('#66bb6a')
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke()
          .moveDown(1);
      });
    }

    // Section: Sector-Based Violations
    if (sectorClients.length > 0) {
      doc.addPage();
      doc.fontSize(16).fillColor('#c62828').text('Sector-Based Non-Compliance', { underline: true });
      doc.moveDown(0.5);

      sectorClients.forEach(client => {
        doc
          .fillColor('#c62828')
          .fontSize(14)
          .text(`${client.firstname} ${client.lastname} (${client.company_name})`, { underline: true });

        doc
          .moveDown(0.3)
          .fontSize(11)
          .fillColor('#333')
          .text(`Waste Type: ${client.supertype_name || client.sector_name}`)
          .text(`Total Submissions: ${client.entry_count}`)
          .text(`Total Collected: ${client.total_collected} kg`)
          .text(`Annual Generation: ${client.annual_generated} kg`)
          .text(`Achieved: ${client.actual_percent}%`)
          .text(`Target: ${client.target_percent}%`)
          .text('Status:', { continued: true })
          .fillColor(client.compliance_status === 'Compliant' ? 'green' : 'red')
          .text(`  ${client.compliance_status}`)
          .moveDown();

        doc
          .fillColor('#ad1457')
          .fontSize(10)
          .text(`Review your compliance per sector to avoid penalties.`, {
            align: 'justify',
            indent: 20,
            lineGap: 2
          })
          .moveDown(1);

        doc
          .strokeColor('#ef9a9a')
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke()
          .moveDown(1);
      });
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating PDF');
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
  const wasteCompliance = await   getWasteComplianceByUser();
  const sectorCompliance = await getSectorComplianceByUser();
  const groupedCompliance = await groupComplianceData(wasteCompliance, sectorCompliance);

  res.render('control-panel/entry-stats', {
    layout: 'control-panel',
    title: 'Data Entry Statistics | GC Control Panel',
    current_stats: true,
    entryCount,
    contributors,
    latestSubmissions,
    topRegions,
    monthlySubmissions: JSON.stringify(monthlySubmissions),
    wasteCompliance,
    sectorCompliance,
    groupedCompliance: JSON.stringify(groupedCompliance), // send as JSON
    
  });
})

// server.js — /api/simulation
app.get('/api/simulation', async (req, res) => {
  try {
    const {
      title, region, province, municipality, barangay,
      author, company, startDate, endDate
    } = req.query;

    // Read forecastMonths from client (default 12)
    const horizon = parseInt(req.query.forecastMonths, 10) || 12;

    const locationCode = barangay || municipality || province || region || null;

    // Grab monthly timeSeries data from DB (or whichever aggregation you want)
    const timeSeriesData = await getTimeSeriesData(title, locationCode, author, company, startDate, endDate, 'monthly');

    // Run hybrid simulation with requested horizon
    // iterations could be tuned, keep it moderate for responsiveness
    const simResult = runHybridSimulation(timeSeriesData, 1000, horizon);

    // The function returns an array: [{ step:0, mean, upper, lower }, ...]
    res.json({ success: true, horizon, simResult, timeSeriesData });
  } catch (err) {
    console.error('API Simulation error:', err);
    res.status(500).json({ success: false, message: 'Simulation failed' });
  }
});


// Compliance API for dropdown
app.get('/api/compliance', async (req, res) => {
  try {
    const category = req.query.category;

    const wasteCategories = ["Biodegradable", "Recyclable", "Residual", "Special/Hazardous"];
    const sectorCategories = ["Residential", "Commercial", "Institutional", "Industrial", "Health", "Agriculture and Livestock"];

    let data = [];

    if (wasteCategories.includes(category)) {
      data = await getWasteComplianceByUser(category);
    } else if (sectorCategories.includes(category)) {
      data = await getSectorComplianceByUser(category);
    }

    res.json(data);
  } catch (err) {
    console.error("Error fetching compliance data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


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

app.get('/control-panel/quotas', async (req, res) => {
  const org = req.query.org || null;
  const orgList = await getOrganizations();

  const selectedOrg = org || (orgList.length ? orgList[0] : null);

  let wasteQuotas = [];
  let sectorQuotas = [];

  if (selectedOrg) {
    wasteQuotas = await getWasteQuotasByOrganization(selectedOrg);
    sectorQuotas = await getSectorQuotasByOrganization(selectedOrg);
  }

  res.render('control-panel/quotas', {
    layout: 'control-panel',
    title: 'Compliance Quotas | GC Control Panel',
    current_quotas: true,
    orgList,
    selectedOrg,
    wasteQuotas,
    sectorQuotas
  });
});

app.post('/control-panel/quotas/update-waste', async (req, res) => {
  const { quota_id, quota_weight, waste_name } = req.body;
  const org = req.query.org;
  await updateWasteQuotaForOrg(org, waste_name, parseFloat(quota_weight));
  res.redirect(`/control-panel/quotas?org=${encodeURIComponent(org)}`);
});
app.post('/control-panel/quotas/update-sector', async (req, res) => {
  const { quota_id, quota_weight, sector_name } = req.body;
  const org = req.query.org;
  await updateSectorQuotaForOrg(org, sector_name, parseFloat(quota_weight));
  res.redirect(`/control-panel/quotas?org=${encodeURIComponent(org)}`);
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
    const entryId = req.params.id
    const { status, reviewedBy, comment, submitter, title } = req.body
    
    // Basic validation
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' })
    }
    
    // Update data entry
    await updateDataStatus(entryId, status)
    
    // Update data entry edit history
    let result
    
    if(status === 'Approved') {
      // Retrieve entry location name
      const locationName = await getEntryLocationName(entryId)

      // First, make sure entry's location exists in db
      const coords = await getCoordinates(locationName)

      // If coords do not exist, find coords for entry's location and insert into db
      if(!coords) {
        const fetchCoords = await fetchCoordinates(locationName)

        if(fetchCoords)
          await createLocationEntry(locationName, fetchCoords.latitude, fetchCoords.longitude)
      }

      // Send notification to user that the entry has been approved
      await createNotification(submitter, 'Approval', `Your data entry, <b>${title}</b>, has been Approved.`, `/dashboard/data/${entryId}`)

    }
    else if(status === 'Needs Revision') {
      // Insert into data revision log
      const revisionId = await createRevisionEntry(entryId, reviewedBy, 'Marked for Revision', comment)

      // Update current revision
      await updateCurrentLog(entryId, revisionId)

      // Send notification to user
      await createNotification(submitter, 'Revision Notice', `Your data entry, <b>${title}</b>, needs revision.`, `/dashboard/data/wip/${entryId}`)
    }

    // Complete task (actually deleting it)
    const taskId = await getTaskByEntryId(entryId);

    if (taskId) {
      await completeTask(taskId);
    }

    res.json({ 
      success: true,
      message: `Application ${entryId} status updated to ${status}`,
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
    NODE-CRON TIMER
--------------------------------------- */
// Run every 30 minutes (minute 0 and 30 of every hour)
cron.schedule("0,0 * * * *", async () => {
  console.log("⏰ Running deadline reminder job...");

  try {
    const users = await getUsers();

    for (const user of users) {
      const timer = await getDeadlineTimer(user.user_id);  // use user_id

      // Skip if no deadline, already submitted, or exempt
      if (!timer || !timer.deadline || timer.submitted || timer.exempt) continue;

      const deadline = new Date(timer.deadline);
      if (isNaN(deadline)) continue;  // prevent "Invalid Date"
      if (deadline <= new Date()) continue;  // deadline already passed

      const msg = `Reminder: Your data submission deadline is on ${deadline.toLocaleString()}. Please submit before time runs out.`;

      await createNotification(
        user.user_id,
        "Warning",   // shorter, fits DB column
        msg,
        "/dashboard"
      );

      console.log(`🔔 Reminder sent to user ${user.user_id}`);
    }
  } catch (err) {
    console.error("Failed to run reminder job:", err);
  }
});


/* ---------------------------------------
    APP LISTENER AND APP LOCALS FUNCTIONS
--------------------------------------- */

const port = 3000
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})

