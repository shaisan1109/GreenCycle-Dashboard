// .env setup
import 'dotenv/config'

import fetch from 'node-fetch'
import mysql from 'mysql2'
import { PSGCResource } from 'psgc-areas';

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
export async function createUser(roleId, lastName, firstName, email, password, contactNo) {
    const result = await sql.query(`
        INSERT INTO user (user_id, role_id, lastname, firstname, email, password, contact_no)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [0, roleId, lastName, firstName, email, password, contactNo])
    
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

/* ---------------------------------------
    DATA SUBMISSION
--------------------------------------- */
export async function submitForm(user_id, region_id, province_id, municipality_id, location_name, population, per_capita, annual, collection_start, collection_end, wasteComposition) {

   try {
       // Insert into date_entry table
       const [dataEntryResult] = await sql.query(
           `INSERT INTO greencycle.data_entry (user_id, region_id, province_id, municipality_id, location_name, population, per_capita, annual, date_submitted, collection_start, collection_end, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'Pending Review')`, 
           [user_id, region_id, province_id, municipality_id, location_name, population, per_capita, annual, collection_start, collection_end]
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
export async function createApplication(firstName, lastName, email, contactNo, verificationDoc) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Insert new application with pending status
    // application_id is auto-generated via trigger
    const result = await sql.query(`
        INSERT INTO user_applications (
            lastname, firstname, email, contact_no, 
            verification_doc, status, submission_date
        )
        VALUES (?, ?, ?, ?, ?, 'Pending Review', ?)
    `, [lastName, firstName, email, contactNo, verificationDoc, today])
    
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
        
        // 3. Create user in users table
        // Using role_id 4 (Government) as default for client applications
        await connection.query(`
            INSERT INTO user (
                role_id, lastname, firstname, email, 
                password, contact_no, verified
            )
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [
            4, // Default role for client applications (Government)
            application.lastname,
            application.firstname,
            application.email,
            'ChangeMe123', // Default password that needs to be changed on first login
            application.contact_no,
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
            dat.data_entry_id, dat.location_name,
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

// Get all data for review EXCEPT for current user
// Current user cannot review their own reports
export async function getDataForReview(currentUser) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.user_id, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = 'Pending Review' AND NOT dat.user_id = ${currentUser}
        ORDER BY dat.data_entry_id DESC
    `)

    return result
}

// Get all data by user and sort according to IDs in descending order (recent to oldest)
export async function getDataByUser(userId) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ${userId}
        ORDER BY dat.data_entry_id DESC
    `)

    return result
}

// Get approved data entries from a location
export async function getDataByLocation(locationCode) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.location_name,
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
        SELECT
        wc.material_id, m.material_name, wc.subtype_remarks, o.origin_name, wc.waste_amount
        FROM waste_composition wc
        JOIN waste_materials m ON wc.material_id = m.id
        JOIN waste_origins o ON wc.origin_id = o.id
        WHERE wc.waste_gen_id = ?
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