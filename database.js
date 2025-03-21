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
    await sql.query(`UPDATE user SET last_login = now() WHERE user_id=?`, [userId], function (err, result) {
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
    FORM SUBMISSION
--------------------------------------- */
export async function submitForm(name, company_name, region, province, municipality,
    barangay, population, per_capita, annual, date_submitted, year_collected, date_start, date_end, formattedWasteComposition) {
   try {
       // Insert into clients table
       const [clientResult] = await sql.query(
           `INSERT INTO clients (name, company_name) VALUES (?, ?)`, 
           [name, company_name]
       );
       const client_id = clientResult.insertId;

       // Insert into locations table
       const [locationResult] = await sql.query(
           `INSERT INTO locations (region, province, municipality, barangay) VALUES (?, ?, ?, ?)`, 
           [region, province, municipality, barangay]
       );
       const location_id = locationResult.insertId;
       const location_code = location_id; // Assuming location_code is the same as location_id

       // Insert into waste_generation table
       const [wasteGenResult] = await sql.query(
           `INSERT INTO waste_generation (client_id, location_id, population, per_capita, annual, date_submitted, year_collected, collection_start, collection_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
           [client_id, location_id, population, per_capita, annual, date_submitted, year_collected, date_start, date_end]
       );

       const collection_id = wasteGenResult.insertId;

       // Ensure collection_id is valid
       if (!collection_id) {
           throw new Error("Failed to insert into waste_generation, collection_id is NULL.");
       }


       // Insert into waste_composition table (only if wasteComposition is provided)
       if (formattedWasteComposition && formattedWasteComposition.length > 0) {
           const connection = await sql.getConnection(); // Get a connection from the pool

           try {
               await connection.beginTransaction(); // Start transaction

               // Construct bulk insert values
               let insertValues = [];
               let insertPlaceholders = [];
               
               for (const entry of formattedWasteComposition) {
                   let { material_id, origin_id, waste_amount, subtype_remarks } = entry;

                   const [materialResult] = await connection.query(
                       `SELECT id FROM waste_materials WHERE id = ?`, [material_id]
                   );
                   
                   if (materialResult.length === 0) {
                       throw new Error(`Invalid material category: ${material_id}`);
                   }
                                       
                   // Fetch origin_id from database (if necessary)
                   const [originResult] = await connection.query(
                       `SELECT id FROM waste_origins WHERE id = ?`, [origin_id]
                   );

                   if (originResult.length === 0) {
                       throw new Error(`Invalid origin ID: ${origin_id}`);
                   }

                   // Prepare values for bulk insert
                   insertValues.push(collection_id, material_id, origin_id, waste_amount, subtype_remarks || null);
                   insertPlaceholders.push("(?, ?, ?, ?, ?)");
               }

               // Perform bulk insertion
               const query = `
                   INSERT INTO waste_composition (waste_gen_id, material_id, origin_id, waste_amount, subtype_remarks) 
                   VALUES ${insertPlaceholders.join(", ")}
               `;
               
               await connection.query(query, insertValues);

               await connection.commit(); // Commit transaction if successful
           } catch (error) {
               await connection.rollback(); // Rollback on error
               console.error("Error inserting waste composition:", error);
               throw new Error("Failed to insert waste composition data.");
           } finally {
               connection.release(); // Release the connection back to the pool
           }
       }

       return { success: true, message: "Form submitted successfully!" };

   } catch (error) {
       console.error("Database error:", error);
       throw new Error("Error inserting data into the database.");
   }
}

const regionEquivalence = {
    "NCR": '0',
    "Cordillera Administrative Region (CAR)": '1',
    "Region I (Ilocos Region)": '2',
    "Region II (Cagayan Valley)": '3',
    "Region III (Central Luzon)": '4',
    "Region IV-A (CALABARZON)": '5',
    "MIMAROPA Region": '6',
    "Region V (Bicol Region)": '7',
    "Region VI (Western Visayas)": '8',
    "Region VII (Central Visayas)": '9',
    "Region VIII (Eastern Visayas)": '10',
    "Region IX (Zamboanga Peninsula)": '11',
    "Region X (Northern Mindanao)": '12',
    "Region XI (Davao Region)": '13',
    "Region XII (SOCCSKSARGEN)": '14',
    "Region XIII (Caraga)": '15',
    "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)": '16'
};

const provinceCAR = {
    "Abra": '0',
    "Benguet": '1',
    "Ifugao": '2',
    "Kalinga": '3',
    "Mountain Province": '4',
    "Apayao": '5',
    
};
const provinceIllocos={
    "Ilocos Norte": '0',
    "Ilocos Sur": '1',
    "La Union": '2',
    "Pangasinan": '3',
};
const provinceCagayan={
    "Batanes": '0',
    "Cagayan": '1',
    "Isabela": '2',
    "Nueva Vizcaya": '3',
    "Quirino": '4',
};
const provinceCentralLuzon={
    "Bataan": '0',
    "Bulacan": '1',
    "Nueva Ecija": '2',
    "Pampanga": '3',
    "Tarlac": '4',
    "Zambales": '5',
    "Aurora": '6',
};
const provinceCALABARZON ={
    "Batangas": '0',
    "Cavite": '1',
    "Laguna": '2',
    "Quezon": '3',
    "Rizal": '4',
};
const provinceMIMAROPA={
    "Marinduque": '0',
    "Occidental Mindoro": '1',
    "Oriental Mindoro": '2',
    "Palawan": '3',
    "Romblon": '4',
};
const provinceBicol={
    "Albay": '0',
    "Camarines Norte": '1',
    "Camarines Sur": '2',
    "Catanduanes": '3',
    "Masbate": '4',
    "Sorsogon": '5',
};
const provinceWestVis={
    "Aklan": '0',
    "Antique": '1',
    "Capiz": '2',
    "Iloilo": '3',
    "Negros Occidental": '4',
    "Guimaras": '5',
};
const provinceCentralVis={
    "Bohol": '0',
    "Cebu": '1',
    "Negros Oriental": '2',
    "Siquijor": '3',
};
const provinceEastVis={ 
    "Eastern Samar": '0',
    "Leyte": '1',
    "Northern Samar": '2',
    "Samar": '3',
    "Southern Leyte": '4',
    "Biliran": '5',
};
const provinceZamb={
    "Zamboanga del Norte": '0',
    "Zamboanga del Sur": '1',
    "Zamboanga Sibugay": '2',
};
const provinceNorthMin={
    "Bukidnon": '0',
    "Camiguin": '1',
    "Lanao del Norte": '2',
    "Misamis Occidental": '3',
    "Misamis Oriental": '4',
};
const provinceDavao={
    "Davao del Norte": '0',
    "Davao del Sur": '1',
    "Davao Oriental": '2',
    "Davao de Oro": '3',
    "Davao Occidental": '4',
};
const provinceSOCCSKSARGEN={
    "Cotabato": '0',
    "South Cotabato": '1',
    "Sultan Kudarat": '2',
    "Sarangani": '3',
};
const provinceCaraga={
    "Agusan del Norte": '0',
    "Agusan del Sur": '1',
    "Surigao del Norte": '2',
    "Surigao del Sur": '3',
    "Dinagat Islands": '4',
};
const provinceBARMM={
    "Basilan": '0',
    "Lanao del Sur": '1',
    "Sulu": '2',
    "Tawi-Tawi": '3',
    "Maguindanao del Norte": '4',
    "Maguindanao del Sur": '5',
    "Ligawasan":'6'
};


// Fetch regions, provinces, and municipalities dynamically (Municipalities and Cities only)
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

        // 🔹 Find the region name using the regionEquivalence mapping
        const regionName = Object.keys(regionEquivalence).find(key => regionEquivalence[key] === regionCode);
        if (!regionName) {
            console.error(`Region not found for code: ${regionCode}`);
            return `Unknown Region (${regionCode})`;
        }

        // 🔹 Determine which province mapping to use
        let provinceMapping;
        switch (regionCode) {
            case '1': provinceMapping = provinceCAR; break;
            case '2': provinceMapping = provinceIllocos; break;
            case '3': provinceMapping = provinceCagayan; break;
            case '4': provinceMapping = provinceCentralLuzon; break;
            case '5': provinceMapping = provinceCALABARZON; break;
            case '6': provinceMapping = provinceMIMAROPA; break;
            case '7': provinceMapping = provinceBicol; break;
            case '8': provinceMapping = provinceWestVis; break;
            case '9': provinceMapping = provinceCentralVis; break;
            case '10': provinceMapping = provinceEastVis; break;
            case '11': provinceMapping = provinceZamb; break;
            case '12': provinceMapping = provinceNorthMin; break;
            case '13': provinceMapping = provinceDavao; break;
            case '14': provinceMapping = provinceSOCCSKSARGEN; break;
            case '15': provinceMapping = provinceCaraga; break;
            case '16': provinceMapping = provinceBARMM; break;
            default: 
                console.error(`Unknown region code: ${regionCode}`);
                provinceMapping = null;
        }

        // 🔹 Find the province name if applicable
        let provinceName = null; // Set explicitly to null unless found.
        if (provinceMapping && provinceCode) {
            provinceName = Object.keys(provinceMapping)
                .find(key => String(provinceMapping[key]) === String(provinceCode)) || null;
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

// Get data entries from a location
export async function getDataByLocation(locationCode) {
    const [result] = await sql.query(`
        SELECT
            loc.region, loc.province, loc.municipality,
            c.name, c.company_name,
            wg.*
        FROM waste_generation wg
        JOIN locations loc ON wg.location_id = loc.location_id
        JOIN clients c ON wg.client_id = c.client_id
        WHERE loc.region = ${locationCode}
        OR loc.province = ${locationCode}
        OR loc.municipality = ${locationCode}
    `)
    return result
}

// Get single data entry
export async function getWasteGenById(id) {
    const [result] = await sql.query(`
        SELECT
            c.name, c.company_name,
            wg.*
        FROM waste_generation wg
        JOIN clients c ON wg.client_id = c.client_id
        WHERE wg.waste_gen_id = ?
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