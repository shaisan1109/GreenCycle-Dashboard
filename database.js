// .env setup
import 'dotenv/config'

import fetch from 'node-fetch'
import mysql from 'mysql2'
import { PSGCResource } from 'psgc-areas';
import bcrypt from 'bcrypt'

// Collection of connections to the database
const sql = mysql.createPool({
    host: process.env.MYSQL_HOST, // for running this on other hosts (and hiding info)
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    port: process.env.MYSQL_PORT
}).promise()

/* ---------------------------------------
    USERS
--------------------------------------- */
// Get all users
export async function getUsers() {
    // Square brackets around variable = first item of that array
    // In this case, first item of result is the table values
    const [result] = await sql.query(`
        SELECT u.*, r.role_name
        FROM user u
        INNER JOIN user_roles r ON u.role_id = r.role_id`)
    return result
}

// Get one user by email
export async function getUserByEmail(email) {
    const [result] = await sql.query(`
        SELECT u.*, r.role_name, r.supertype
        FROM user u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE email=?`, [email])
    return result
}

// Get user by ID
export async function getUserById(id) {
    const [result] = await sql.query(`
        SELECT u.*, r.role_name
        FROM user u
        JOIN user_roles r ON u.role_id = r.role_id
        WHERE u.user_id=?
    `, [id])
    return result
}

// Get users with role
export async function getUsersOfRole(roleId) {
    const [result] = await sql.query(`SELECT * FROM user WHERE role_id=?`, [roleId])
    return result // important, to not return an array
}

// Create a new user entry
export async function createUser(roleId, lastName, firstName, email, password, contactNo, companyName) {
    const result = await sql.query(`
        INSERT INTO user (user_id, role_id, lastname, firstname, email, password, contact_no, company_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [0, roleId, lastName, firstName, email, password, contactNo, companyName])
    
    // Return new object if successful
    const id = result[0].insertId
    return getUserById(id)
}

export async function lastLogin(userId) {
    await sql.query(`UPDATE user SET last_login = now(), successful_logins = successful_logins + 1 WHERE user_id=?`, [userId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

export async function hashPassword(newPass, userId) {
    await sql.query(`UPDATE user SET password = ? WHERE user_id = ?`, [newPass, userId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

export async function wrongPassword(userId) {
    await sql.query(`UPDATE user SET failed_logins = failed_logins + 1 WHERE user_id=?`, [userId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// Deactivate user by email
export async function deactivateUserByEmail(email) {
    const [result] = await sql.query(`
        UPDATE user 
        SET active = 0
        WHERE email = ?
    `, [email])
    
    return result.affectedRows > 0
}

/* ---------------------------------------
    WASTE CATEGORIES
--------------------------------------- */
export async function getSectors() {
    const [result] = await sql.query(`SELECT * FROM greencycle.sector`)
    return result
}

export async function getWasteSupertypes() {
    const [result] = await sql.query(`SELECT * FROM greencycle.waste_supertype`)
    return result
}

export async function getWasteTypes() {
    const [result] = await sql.query(`SELECT * FROM greencycle.waste_type`)
    return result
}

// Get supertypes AND types
export async function getAllTypes() {
    const [result] = await sql.query(`
        SELECT st.id AS supertype_id, st.name AS supertype_name,
            t.id AS type_id, t.name AS type_name
        FROM greencycle.waste_supertype st
        JOIN greencycle.waste_type t ON st.id = t.supertype_id
        ORDER BY st.id, t.id    
    `)
    return result
}

/* ---------------------------------------
    DATA SUBMISSION
--------------------------------------- */
export async function submitForm(user_id, title, region_id, province_id, municipality_id, location_name, population, per_capita, annual, collection_start, collection_end, wasteComposition) {

   try {
       // Insert into date_entry table
       const [dataEntryResult] = await sql.query(
           `INSERT INTO greencycle.data_entry (user_id, title, region_id, province_id, municipality_id, location_name, population, per_capita, annual, date_submitted, collection_start, collection_end, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'Pending Review')`, 
           [user_id, title, region_id, province_id, municipality_id, location_name, population, per_capita, annual, collection_start, collection_end]
       );

       const data_entry_id = dataEntryResult.insertId;

       // Ensure data_entry_id is valid
       if (!data_entry_id) {
           throw new Error("Failed to insert into data_entry, data_entry_id is NULL.");
       }

       // Insert into waste_composition table (only if wasteComposition is provided)
       if (wasteComposition) {
           // Create array of values
            const values = wasteComposition.map(item => [
                data_entry_id,
                item.sector_id,
                item.type_id,
                item.waste_amount
            ]);

            // Create placeholders for bulk insert
            const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');

            const insertQuery = `
                INSERT INTO data_waste_composition (data_entry_id, sector_id, type_id, waste_amount)
                VALUES ${placeholders}
            `;

            try {
                await sql.query(insertQuery, values.flat());
            } catch (err) {
                console.error('DB Error:', err);
            }
       }

       return { success: true, message: "Form submitted successfully!" };

   } catch (error) {
       console.error("Database error:", error);
       throw new Error("Error inserting data into the database.");
   }
}

// Fetch regions, provinces, municipalities, and cities dynamically
async function fetchPSGCData() {
    try {
        const [municipalities, cities] = await Promise.all([
            PSGCResource.getMunicipalities(),
            PSGCResource.getCities()
        ]);

        return { municipalities, cities };
    } catch (error) {
        console.error("Error fetching PSGC data:", error);
        return null;
    }
}

async function getLocationName(regionCode, provinceCode, municipalityCode, existingMunicipalityName) {
    try {
        // 🟢 Use existing municipality or city name if it's already in the database
        if (existingMunicipalityName && existingMunicipalityName.trim() !== "") {
            console.log(`Using existing municipality/city name: ${existingMunicipalityName}`);
            return existingMunicipalityName;
        }

        console.log(`Searching for region code: ${regionCode}`);

        const psgcRegions = await PSGCResource.getRegions();

        // 🔹 Find the region name using the regionEquivalence mapping
        const regionName = psgcRegions?.find(r => r.code === regionCode)?.name ||
                             `Unknown Region (${regionCode})`;
        if (!regionName) {
            console.error(`Region not found for code: ${regionCode}`);
            return `Unknown Region (${regionCode})`;
        }

        // 🔹 Find the province name if applicable
        const psgcProvinces = await PSGCResource.getProvinces()

        const provinceName = psgcProvinces?.find(p => p.code === provinceCode)?.name ||
                             `Unknown Province (${provinceCode})`;
        if (!provinceName) {
            console.error(`Region not found for code: ${provinceCode}`);
            return `Unknown Region (${provinceCode})`;
        }

        
        // 🔹 Fetch municipality or city name from PSGC data
        const psgcData = await fetchPSGCData();

        const locationName = psgcData?.municipalities?.find(m => m.code === municipalityCode)?.name ||
                             psgcData?.cities?.find(c => c.code === municipalityCode)?.name ||
                             `Unknown Municipality/City (${municipalityCode})`;

        // 🔹 Format the full location name correctly
        const fullLocationName = [regionName, provinceName, locationName]
            .filter(Boolean) // Remove empty values
            .join(", ");

        console.log(`Resolved Location Name: ${fullLocationName}`);
        return fullLocationName;
    } catch (error) {
        console.error("Error fetching location:", error);
        return null;
    }
}

// Function to fetch coordinates using OpenStreetMap API
async function getCoordinates(locationName) {
    const locationParts = locationName.split(",").map(part => part.trim());

    let formattedLocation = "Philippines"; // Default country

    // Extract location values safely
    const region = locationParts[0] || null;
    const province = locationParts[1] || null;
    const municipality = locationParts[2] || null;
    
    // Check what data is available and format accordingly
    if (municipality) {
        formattedLocation = `${municipality}, Philippines`; // Municipality/City
    } else if (province) {
        formattedLocation = `${province}, Philippines`; // Province
    } else if (region) {
        formattedLocation = `${region}, Philippines`; // Region
    }

    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formattedLocation)}`;

    try {
        console.log(`Fetching coordinates for: ${formattedLocation}`); // Debugging output
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.length > 0) {
            return { latitude: data[0].lat, longitude: data[0].lon };
        } else {
            console.error("Location not found:", formattedLocation);
            return null;
        }
    } catch (error) {
        console.error("Error fetching coordinates:", error);
        return null;
    }
}

export async function getWasteDataWithCoordinates() {
    const [rows] = await sql.query(`
        SELECT 
            l.location_id, 
            l.region, l.region_name, 
            l.province, l.province_name, 
            l.municipality, l.municipality_name, 
            l.barangay, 
            l.latitude, l.longitude,
            wc.id AS waste_id, wc.waste_gen_id, wc.material_id, wc.origin_id, wc.waste_amount, wc.subtype_remarks,
            wg.waste_gen_id, wg.client_id, wg.population, wg.per_capita, wg.annual, wg.date_submitted, wg.year_collected
        FROM locations l
        LEFT JOIN waste_generation wg ON l.location_id = wg.location_id
        LEFT JOIN waste_composition wc ON wg.location_id = wc.waste_gen_id;
            `);


    for (let row of rows) {
        const locationName = await getLocationName(row.region, row.province, row.municipality);
        console.log(`Fetched Name for Location ID ${row.location_id}: ${locationName}`);

        if (!row.latitude || !row.longitude) {
            const coords = await getCoordinates(locationName);
            if (coords) {
                row.latitude = coords.latitude;
                row.longitude = coords.longitude;

                console.log(`Updated Coordinates for ${locationName}: ${coords.latitude}, ${coords.longitude}`);

                const locationParts = locationName.split(",").map(part => part.trim());

                let regionName = locationParts[0] || null;
                const provinceCode = row.province ? row.province : null;
                const municipalityCode = row.municipality ? row.municipality : null;


            // Ensure proper formatting of province and municipality names
                let provinceName = provinceCode ? locationParts[1] || null : null;
                let municipalityName = municipalityCode 
                    ? locationParts[2] || locationParts[1] || null  // Ensure the correct assignment
                    : (!provinceCode && locationParts[1]) ? locationParts[1] : null;

                // Special handling for NCR: No province, but ensure municipality is assigned
                if (row.region === "0" && municipalityCode) {
                    provinceName = null;  // NCR has no province
                    municipalityName = locationParts[1] || null;  // Assign city/municipality correctly
                }

                await sql.query(
                    `UPDATE locations SET latitude = ?, longitude = ?, region_name = ?, province_name = ?, municipality_name = ? WHERE location_id = ?`,
                    [coords.latitude, coords.longitude, regionName, provinceName, municipalityName, row.location_id]
                );
 
                
                await sql.query(
                    `UPDATE locations SET latitude = ?, longitude = ?, region_name = ?, province_name = ?, municipality_name = ? WHERE location_id = ?`,
                    [coords.latitude, coords.longitude, regionName, provinceName, municipalityName, row.location_id]
                );

            }
        }
    }
    return rows;
}

/* ---------------------------------------
    PARTNERS
--------------------------------------- */

// Get all partners
export async function getPartners() {
    const [result] = await sql.query(`SELECT * FROM partner_org`)
    return result
}

/* ---------------------------------------
    ROLES
--------------------------------------- */

// Get roles with supertype as parameter
// 0 - Admin, 1 - GC Staff, 2 - Client
export async function getRolesOfSupertype(supertype) {
    const [result] = await sql.query(`
        SELECT ur.*, COUNT(u.user_id) AS user_count
        FROM user_roles ur
        LEFT JOIN user u ON ur.role_id = u.role_id
        WHERE ur.supertype = ${supertype}
        GROUP BY ur.role_id`)
    return result
}

// Create new client role
export async function createClientRole(roleName) {
    const result = await sql.query(`
        INSERT INTO user_roles (role_id, supertype, role_name)
        VALUES (?, ?, ?)
    `, [0, 2, roleName])
    
    // Return new object if successful
    const id = result[0].insertId
    return getRoleById(id)
}

// Get role by ID
export async function getRoleById(id) {
    const [result] = await sql.query(`SELECT * FROM user_roles WHERE role_id=?`, [id])
    return result
}

/* ---------------------------------------
    USER APPLICATIONS
--------------------------------------- */
// Get all applications
export async function getApplications() {
    const [result] = await sql.query(`SELECT * FROM user_applications ORDER BY submission_date DESC`)
    return result
}

// Get count of pending applications
export async function getPendingApplicationCount() {
    const [result] = await sql.query(`
        SELECT COUNT(application_id)
        FROM greencycle.user_applications
        WHERE status = 'Pending Review'    
    `)
    return result[0]['COUNT(application_id)']
}

// Get application by ID
export async function getApplicationById(id) {
    const [result] = await sql.query(`SELECT * FROM user_applications WHERE application_id = ?`, [id])
    return result
}

// Get applications by email
export async function getApplicationsByEmail(email) {
    const [result] = await sql.query(`
        SELECT * FROM user_applications 
        WHERE email = ?
        ORDER BY submission_date DESC
    `, [email])
    return result
}

// Functions for application approval/rejection workflow
export async function reconsiderApplication(appId, adminNotes) {
    return updateApplicationStatus(appId, 'Pending Review', adminNotes)
}

export async function revokeApproval(appId, adminNotes) {
    // First, update application status to Pending Review
    const result = await updateApplicationStatus(appId, 'Pending Review', adminNotes)
    
    return result
}

// Create new application (no application_id needed as trigger handles it)
export async function createApplication(firstName, lastName, email, contactNo, companyName, verificationDoc) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Insert new application with pending status
    // application_id is auto-generated via trigger
    const result = await sql.query(`
        INSERT INTO user_applications (
            lastname, firstname, email, contact_no, company_name,
            verification_doc, status, submission_date
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Pending Review', ?)
    `, [lastName, firstName, email, contactNo, companyName, verificationDoc, today])
    
    // Get the last inserted ID (using the auto-increment trigger logic)
    const [idResult] = await sql.query(`
        SELECT application_id FROM user_applications 
        ORDER BY CAST(SUBSTRING(application_id, 4) AS UNSIGNED) DESC 
        LIMIT 1
    `);
    
    if (idResult && idResult.length > 0) {
        return getApplicationById(idResult[0].application_id);
    }
    
    return null;
}

// Update application status
export async function updateApplicationStatus(appId, status, adminNotes) {
    // If status is null, only update admin_notes
    if (status === null) {
        await sql.query(`
            UPDATE user_applications 
            SET admin_notes = ?
            WHERE application_id = ?
        `, [adminNotes, appId])
    } else {
        await sql.query(`
            UPDATE user_applications 
            SET status = ?, 
                admin_notes = ?
            WHERE application_id = ?
        `, [status, adminNotes, appId])
    }
    
    return getApplicationById(appId)
}

// Approve application and create user
export async function approveApplication(appId, adminNotes) {
    // Start a transaction
    const connection = await sql.getConnection()
    try {
        await connection.beginTransaction()
        
        // 1. Update application status to 'Approved'
        await connection.query(`
            UPDATE user_applications 
            SET status = 'Approved', 
                admin_notes = ?
            WHERE application_id = ?
        `, [adminNotes, appId])
        
        // 2. Get application data
        const [applicationData] = await connection.query(
            `SELECT * FROM user_applications WHERE application_id = ?`, 
            [appId]
        )
        
        if (applicationData.length === 0) {
            throw new Error('Application not found')
        }
        
        const application = applicationData[0]
        
        // Set default hashed password
        const hashedPassword = await bcrypt.hash('ChangeMe123', 10)

        // 3. Create user in users table
        // Using role_id 4 (Government) as default for client applications
        await connection.query(`
            INSERT INTO user (
                role_id, lastname, firstname, email, 
                password, contact_no, company_name, verified
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            4, // Default role for client applications (Government)
            application.lastname,
            application.firstname,
            application.email,
            hashedPassword, // Default password that needs to be changed on first login
            application.contact_no,
            application.company_name,
            1 // Set as verified since application is approved
        ])
        
        // Commit the transaction
        await connection.commit()
        
        return getApplicationById(appId)
    } catch (error) {
        // Rollback in case of error
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

// Reject application 
export async function rejectApplication(appId, adminNotes) {
    return updateApplicationStatus(appId, 'Rejected', adminNotes)
}

// Move application back to pending
export async function resetApplicationStatus(appId, adminNotes) {
    return updateApplicationStatus(appId, 'Pending Review', adminNotes)
}

/* ---------------------------------------
    DATA RETRIEVAL
--------------------------------------- */

// Get all data with status
export async function getDataByStatus(status) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = '${status}'
        ORDER BY dat.data_entry_id DESC
    `)

    return result
}

// Get all data with status (paginated version)
export async function getDataByStatusPaginated(status, limit, offset) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = ?
        ORDER BY dat.data_entry_id DESC
        LIMIT ? OFFSET ?
    `, [status, limit, offset]);

    return result;
}

// Get data with filters
export async function getDataWithFilters(limit, offset, title, locationCode, name, companyName, startDate, endDate) {
    // Unmodified query
    let query = `
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = 'Approved'`;

    // Stores filters and parameters
    const conditions = [];
    const params = [];

    // Add filters only if values are provided
    if (title) {
        conditions.push(`dat.title LIKE ?`);
        params.push(`%${title}%`);
    }

    if (locationCode) {
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ?)`);
        params.push(locationCode, locationCode, locationCode);
    }

    if (name) {
        conditions.push(`(u.lastname LIKE ? OR u.firstname LIKE ?)`);
        params.push(`%${name}%`, `%${name}%`);
    }

    if (companyName) {
        conditions.push(`u.company_name LIKE ?`);
        params.push(`%${companyName}%`);
    }

    // Optional date range logic
    if (startDate && endDate) {
        conditions.push(`(dat.collection_start >= ? AND dat.collection_end <= ?)`);
        params.push(startDate, endDate);
    } else if (startDate) {
        conditions.push(`dat.collection_start >= ?`);
        params.push(startDate);
    } else if (endDate) {
        conditions.push(`dat.collection_end <= ?`);
        params.push(endDate);
    }

    // Combine all filters
    if (conditions.length > 0) {
        query += ` AND ` + conditions.join(' AND ');
    }

    // Apply pagination
    query += ` ORDER BY dat.data_entry_id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Return final result
    const [result] = await sql.query(query, params);
    return result;
}

// Get count of data with filters
export async function getFilteredDataCount(title, locationCode, name, companyName, startDate, endDate) {
  let query = `
    SELECT COUNT(*) as count
    FROM data_entry dat
    JOIN user u ON u.user_id = dat.user_id
    WHERE dat.status = 'Approved'
  `;

  const conditions = [];
  const params = [];

  if (title) {
    conditions.push(`dat.title LIKE ?`);
    params.push(`%${title}%`);
  }

  if (locationCode) {
    conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ?)`);
    params.push(locationCode, locationCode, locationCode);
  }

  if (name) {
    conditions.push(`(u.lastname LIKE ? OR u.firstname LIKE ?)`);
    params.push(`%${name}%`, `%${name}%`);
  }

  if (companyName) {
    conditions.push(`u.company_name LIKE ?`);
    params.push(companyName);
  }

  if (startDate && endDate) {
    conditions.push(`(dat.collection_start >= ? AND dat.collection_end <= ?)`);
    params.push(startDate, endDate);
  } else if (startDate) {
    conditions.push(`dat.collection_start >= ?`);
    params.push(startDate);
  } else if (endDate) {
    conditions.push(`dat.collection_end <= ?`);
    params.push(endDate);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  const [result] = await sql.query(query, params);
  return result[0].count;
}

// Get count of data entries (for pagination)
export async function getTotalDataCountByStatus(status) {
    const [[{ count }]] = await sql.query(`
        SELECT COUNT(*) as count
        FROM data_entry
        WHERE status = ?
    `, [status]);

    return count;
}

// Get all data for review EXCEPT for current user
// Current user cannot review their own reports
export async function getDataForReview(currentUser, limit, offset) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.user_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = 'Pending Review' AND NOT dat.user_id = ${currentUser}
        ORDER BY dat.data_entry_id DESC
        LIMIT ${limit} OFFSET ${offset}
    `)

    return result
}

// Get *number* of entries to review (for notifications)
export async function getDataForReviewCount(currentUser) {
    const [result] = await sql.query(`
        SELECT COUNT(data_entry_id)
        FROM greencycle.data_entry
        WHERE status = 'Pending Review' AND NOT user_id = ${currentUser}
    `)
    return result[0]['COUNT(data_entry_id)']
}

// Get all data by user and sort according to IDs in descending order (recent to oldest)
export async function getDataByUser(userId, limit, offset) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ${userId}
        ORDER BY dat.data_entry_id DESC
        LIMIT ${limit} OFFSET ${offset}
    `)

    return result
}

// Count data made by user
export async function getDataByUserCount(userId) {
    const [[{ count }]] = await sql.query(`
        SELECT COUNT(*) as count
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ?
    `, [userId]);

    return count;
}

// Get approved data entries from a location
export async function getDataByLocation(locationCode) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE (dat.region_id = ${locationCode}
        OR dat.province_id = ${locationCode}
        OR dat.municipality_id = ${locationCode})
        AND dat.status = 'Approved'
        ORDER BY dat.data_entry_id DESC
    `)
    return result
}

/* ---------------------------------------
    DATA RETRIEVAL (SINGLE ENTRY)
--------------------------------------- */

// Get single data entry
export async function getWasteGenById(id) {
    const [result] = await sql.query(`
        SELECT
            dat.*,
            u.lastname, u.firstname, u.company_name
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.data_entry_id = ?
    `, [id])
    return result[0]
}

// Get waste composition data
export async function getWasteCompById(entryId) {
    const [result] = await sql.query(`
        SELECT sector_id, type_id, waste_amount
        FROM greencycle.data_waste_composition
        WHERE data_entry_id = ?
    `, [entryId])
    return result // important, to not return an array
}

/* ---------------------------------------
    DATA REVIEW
--------------------------------------- */

// Change status of data entry
export async function updateDataStatus(dataId, status, rejectionReason, reviewedBy) {
    await sql.query(`
        UPDATE greencycle.data_entry
        SET status = ?, rejection_reason = ?, reviewed_by = ?
        WHERE data_entry_id = ?
    `, [status, rejectionReason, reviewedBy, dataId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

/* ---------------------------------------
    PSGC FUNCTIONS
--------------------------------------- */

// Converts code (e.g., "130000000") to a location name
export function getPsgcName(locationSet, code) {
    const entry = locationSet.find(loc => loc.code === code)
    return entry ? entry.name : null
}

/* ---------------------------------------
    DATA EDITING HISTORY
--------------------------------------- */
export async function createEditEntry(entryId, editorId, remarks) {
    const result = await sql.query(`
        INSERT INTO greencycle.data_edit_history (data_entry_id, user_id, remarks)
        VALUES (?, ?, ?)
    `, [entryId, editorId, remarks])
    
    // Return new object if successful
    const id = result[0].insertId
    return getUserById(id)
}

export async function getEditHistory(entryId) {
    const [result] = await sql.query(`
        SELECT u.lastname, u.firstname, eh.datetime, eh.remarks
        FROM greencycle.data_edit_history eh
        JOIN greencycle.user u ON u.user_id = eh.user_id
        WHERE eh.data_entry_id = ?
        ORDER BY eh.datetime DESC
    `, [entryId])
    return result // important, to not return an array
}

export async function getLatestEdit(entryId) {
    const [result] = await sql.query(`
        SELECT datetime
        FROM greencycle.data_edit_history
        WHERE data_entry_id = ?
        ORDER BY datetime DESC
        LIMIT 1
    `, [entryId])
    return result // important, to not return an array
}

// Retrieve newest data entry (upon creation)
export async function getLatestDataEntry() {
    const [result] = await sql.query(`
        SELECT data_entry_id FROM data_entry 
        ORDER BY data_entry_id DESC 
        LIMIT 1
    `)
    return result // important, to not return an array
}

/* ---------------------------------------
    DATA AGGREGATION (NEW VERSION)
--------------------------------------- */
export async function getAvgInfoWithFilters(title, locationCode, name, companyName, startDate, endDate) {
    let query = `
        SELECT
            AVG(dat.per_capita) AS avg_per_capita,
            AVG(dat.annual) AS avg_annual,
            MIN(dat.collection_start) AS earliest_collection_start,
            MAX(dat.collection_end) AS latest_collection_end
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = 'Approved'`;

    const conditions = [];
    const params = [];

    if (title) {
        conditions.push(`dat.title LIKE ?`);
        params.push(`%${title}%`);
    }

    if (locationCode) {
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ?)`);
        params.push(locationCode, locationCode, locationCode);
    }

    if (name) {
        conditions.push(`(u.lastname LIKE ? OR u.firstname LIKE ?)`);
        params.push(`%${name}%`, `%${name}%`);
    }

    if (companyName) {
        conditions.push(`u.company_name LIKE ?`);
        params.push(`%${companyName}%`);
    }

    if (startDate && endDate) {
        conditions.push(`(dat.collection_start >= ? AND dat.collection_end <= ?)`);
        params.push(startDate, endDate);
    } else if (startDate) {
        conditions.push(`dat.collection_start >= ?`);
        params.push(startDate);
    } else if (endDate) {
        conditions.push(`dat.collection_end <= ?`);
        params.push(endDate);
    }

    if (conditions.length > 0) {
        query += ` AND ` + conditions.join(' AND ');
    }

    const [result] = await sql.query(query, params);
    return result; // important: single object, not array
}

export async function getAvgWasteCompositionWithFilters(title, locationCode, name, companyName, startDate, endDate) {
    let query = `
        SELECT
            dwc.sector_id,
            dwc.type_id,
            AVG(dwc.waste_amount) AS avg_waste_amount
        FROM data_entry dat
        JOIN data_waste_composition dwc ON dat.data_entry_id = dwc.data_entry_id
        JOIN user u ON dat.user_id = u.user_id
        WHERE dat.status = 'Approved'`;

    const conditions = [];
    const params = [];

    if (title) {
        conditions.push(`dat.title LIKE ?`);
        params.push(`%${title}%`);
    }

    if (locationCode) {
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ?)`);
        params.push(locationCode, locationCode, locationCode);
    }

    if (name) {
        conditions.push(`(u.lastname LIKE ? OR u.firstname LIKE ?)`);
        params.push(`%${name}%`, `%${name}%`);
    }

    if (companyName) {
        conditions.push(`u.company_name LIKE ?`);
        params.push(`%${companyName}%`);
    }

    if (startDate && endDate) {
        conditions.push(`(dat.collection_start >= ? AND dat.collection_end <= ?)`);
        params.push(startDate, endDate);
    } else if (startDate) {
        conditions.push(`dat.collection_start >= ?`);
        params.push(startDate);
    } else if (endDate) {
        conditions.push(`dat.collection_end <= ?`);
        params.push(endDate);
    }

    if (conditions.length > 0) {
        query += ` AND ` + conditions.join(' AND ');
    }

    // Add GROUP BY condition (for aggregation)
    query += ` GROUP BY dwc.sector_id, dwc.type_id`

    const [result] = await sql.query(query, params);
    return result; // important: single object, not array
}

/* ---------------------------------------
    CONTROL PANEL
--------------------------------------- */
export async function getTopContributors(limit) {
    let query = `
        SELECT 
            u.user_id, u.lastname, u.firstname,
            COUNT(dat.data_entry_id) AS entry_count
        FROM greencycle.data_entry AS dat
        JOIN greencycle.user AS u ON dat.user_id = u.user_id
        GROUP BY u.user_id, u.firstname, u.lastname
        ORDER BY entry_count DESC
    `;

    const values = [];

    if (limit && Number.isInteger(limit)) {
        query += ` LIMIT ?`;
        values.push(limit);
    }

    const [result] = await sql.query(query, values);
    return result;
}

// Get latest data entry submissions
export async function getLatestSubmissions(limit) {
    let query = `
        SELECT
            dat.title, u.lastname, u.firstname, dat.date_submitted, dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        ORDER BY dat.date_submitted DESC
    `;

    const values = [];

    if (limit && Number.isInteger(limit)) {
        query += ` LIMIT ?`;
        values.push(limit);
    }

    const [result] = await sql.query(query, values);
    return result;
}

// Get top reporting regions
export async function getTopReportingRegions(limit) {
    let query = `
        SELECT region_id, COUNT(data_entry_id) AS entry_count
        FROM greencycle.data_entry
        GROUP BY region_id
        ORDER BY entry_count DESC
    `;

    const values = [];
    if (limit && Number.isInteger(limit)) {
        query += ` LIMIT ?`;
        values.push(limit);
    }

    const [result] = await sql.query(query, values);

    // Get PSGC data once
    const psgcRegions = await PSGCResource.getRegions();

    // Add region name to each entry
    const resultWithNames = result.map(row => ({
        region_id: row.region_id,
        region_name: getPsgcName(psgcRegions, row.region_id),
        entry_count: row.entry_count
    }));

    return resultWithNames;
}

// Get monthly submissions and convert to Chart.js format
export async function getMonthlySubmissions() {
    const [result] = await sql.query(`
        WITH RECURSIVE months AS (
            SELECT DATE_FORMAT(DATE_FORMAT(NOW(), '%Y-01-01'), '%Y-%m-01') AS month_start
            UNION ALL
            SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
            FROM months
            WHERE month_start < DATE_FORMAT(DATE_FORMAT(NOW(), '%Y-12-01'), '%Y-%m-01')
        )
        SELECT 
            DATE_FORMAT(m.month_start, '%b %Y') AS month_label,
            COUNT(d.data_entry_id) AS entry_count
        FROM months m
        LEFT JOIN greencycle.data_entry d
            ON DATE_FORMAT(d.date_submitted, '%Y-%m') = DATE_FORMAT(m.month_start, '%Y-%m')
            AND YEAR(d.date_submitted) = YEAR(CURDATE())
        GROUP BY m.month_start
        ORDER BY m.month_start;
    `);

    return {
        labels: result.map(row => row.month_label), // ['Jan 2025', 'Feb 2025', ...]
        datasets: [{
            label: 'Monthly Submissions',
            data: result.map(row => row.entry_count), // [12, 5, 0, ...]
            backgroundColor: '#127009',
            borderColor: '#127009',
            fill: false,
            tension: 0,
        }]
    };
}