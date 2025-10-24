// .env setup
import 'dotenv/config'

import fetch from 'node-fetch'
import mysql from 'mysql2'
import { PSGCResource } from 'psgc-areas';
import bcrypt from 'bcrypt'

let sql;

if (process.env.MYSQL_URL) {
  // --- Railway or provided full URL connection ---
  sql = mysql.createPool(process.env.MYSQL_URL).promise();
  console.log('✅ Connected using MYSQL_URL (Railway)');
} else {
  // --- Local development fallback ---
  sql = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    port: process.env.MYSQL_PORT
  }).promise();
  console.log('✅ Connected using .env config (local)');
}

export default sql;

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

export async function getOrganizations() {
  const [rows] = await sql.query(`
    SELECT DISTINCT company_name 
    FROM user 
    WHERE company_name IS NOT NULL 
    ORDER BY company_name
  `);
  return rows.map(r => r.company_name);
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
    const [result] = await sql.query(`SELECT * FROM sector`)
    return result
}

export async function getWasteSupertypes() {
    const [result] = await sql.query(`SELECT * FROM waste_supertype`)
    return result
}

export async function getWasteTypes() {
    const [result] = await sql.query(`SELECT * FROM waste_type`)
    return result
}

// Get supertypes AND types
export async function getAllTypes() {
    const [result] = await sql.query(`
        SELECT st.id AS supertype_id, st.name AS supertype_name,
            t.id AS type_id, t.name AS type_name
        FROM waste_supertype st
        JOIN waste_type t ON st.id = t.supertype_id
        ORDER BY st.id, t.id    
    `)
    return result
}

/* ---------------------------------------
    DATA SUBMISSION
--------------------------------------- */
export async function submitForm(user_id, title, region_id, province_id, municipality_id, barangay_id, location_name, population, per_capita, annual, collection_start, collection_end, wasteComposition) {

   try {
       // Insert into date_entry table
       const [dataEntryResult] = await sql.query(
           `INSERT INTO data_entry (user_id, title, region_id, province_id, municipality_id, barangay_id, location_name, population, per_capita, annual, date_submitted, collection_start, collection_end, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'Pending Review')`, 
           [user_id, title, region_id, province_id, municipality_id, barangay_id, location_name, population, per_capita, annual, collection_start, collection_end]
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

       return { success: true, message: "Form submitted successfully!", data_entry_id };

   } catch (error) {
       console.error("Database error:", error);
       throw new Error("Error inserting data into the database.");
   }
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

// Get combined roles of Admin and Stall (0,1)
export async function getRolesOfSupertypes(supertypes = []) {
  // Ensure always an array
  const supArray = Array.isArray(supertypes) ? supertypes : [supertypes]
  const supStr = supArray.join(",") // e.g. [0,1] -> "0,1"
  

  const [result] = await sql.query(`
    SELECT ur.*, COUNT(u.user_id) AS user_count
    FROM user_roles ur
    LEFT JOIN user u ON ur.role_id = u.role_id
    WHERE ur.supertype IN (${supStr})
    GROUP BY ur.role_id
  `)
  return result
}

// Create a new role for a given supertype
export async function createCompanyRole(roleName, supertype) {
    const [result] = await sql.query(
        "INSERT INTO user_roles (role_name, supertype) VALUES (?, ?)",
        [roleName, supertype]
    );
    return result;
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
export async function removeUserRole(userId) {
  const [result] = await sql.query('UPDATE user SET role_id = 9 WHERE user_id = ?', [userId]);
  return result;
}
export async function updateUserRole(userId, newRoleId) {
    try {
        const [result] = await sql.query(
            'UPDATE user SET role_id = ? WHERE user_id = ?',
            [newRoleId, userId]
        );
        return result;
    } catch (err) {
        console.error('❌ SQL Error in updateUserRole:', err);
        throw err;
    }
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
        FROM user_applications
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
export async function getOrgRoles() {
    const [rows] = await sql.query(`
        SELECT role_id, role_name FROM user_roles WHERE supertype = 2
    `);
    return rows;
}
export async function updateRoleName(role_id, newName) {
    await sql.query(
        `UPDATE user_roles SET role_name = ? WHERE role_id = ?`,
        [newName, role_id]
    );
}

export async function deleteRole(role_id) {
    await sql.query(
        `DELETE FROM user_roles WHERE role_id = ?`,
        [role_id]
    );
}
// In database.js
export async function getAllUsers() {
    const [users] = await sql.query('SELECT * FROM user');
    return users;
}

// Create new application (no application_id needed as trigger handles it)
export async function createApplication(role_id, lastName,firstName, email, contactNo, companyName, verificationDoc) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Insert new application with pending status
    // application_id is auto-generated via trigger
    const result = await sql.query(`
        INSERT INTO user_applications (
            role_id, lastname, firstname, email, contact_no, company_name,
            verification_doc, status, submission_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?)
    `, [role_id, lastName, firstName, email, contactNo, companyName, verificationDoc, today])
    
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

export async function updateApplicationStatus(appId, status, adminNotes) {
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
    
    const updatedApp = await getApplicationById(appId);

    // You can return status or other flags here
    return updatedApp;
}


// Approve application and create user
export async function approveApplication(appId, adminNotes) {
    // Start a transaction
    const connection = await sql.getConnection();
    try {
        await connection.beginTransaction();
        
        // 1. Update application status to 'Approved'
        await connection.query(`
            UPDATE user_applications 
            SET status = 'Approved', 
                admin_notes = ?
            WHERE application_id = ?
        `, [adminNotes, appId]);
        
        // 2. Get application data
        const [applicationData] = await connection.query(
            `SELECT * FROM user_applications WHERE application_id = ?`, 
            [appId]
        );
        
        if (applicationData.length === 0) {
            throw new Error('Application not found');
        }
        
        const application = applicationData[0];
        
        // Set default hashed password
        const hashedPassword = await bcrypt.hash('ChangeMe123', 10);

        // 3. Create user in users table
        const [insertResult] = await connection.query(`
            INSERT INTO user (
                role_id, lastname, firstname, email, 
                password, contact_no, company_name, verified
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            application.role_id,
            application.lastname,
            application.firstname,
            application.email,
            hashedPassword,
            application.contact_no,
            application.company_name
        ]);

        const newUserId = insertResult.insertId;

        // 4. Populate default waste quotas for the new user
        await connection.query(`
            INSERT INTO compliance_quotas (waste_supertype_id, user_id, quota_weight)
            SELECT id, ?, 20.00
            FROM waste_supertype
            WHERE id NOT IN (
                SELECT waste_supertype_id 
                FROM compliance_quotas 
                WHERE user_id = ?
            )
        `, [newUserId, newUserId]);

        // 5. Populate default sector quotas for the new user
        await connection.query(`
            INSERT INTO sector_compliance_quotas (sector_id, user_id, quota_weight)
            SELECT id, ?, 20.00
            FROM sector
            WHERE id NOT IN (
                SELECT sector_id
                FROM sector_compliance_quotas
                WHERE user_id = ?
            )
        `, [newUserId, newUserId]);
        
        // Commit the transaction
        await connection.commit();
        
        return getApplicationById(appId);
    } catch (error) {
        // Rollback in case of error
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}


// Reject application 
export async function rejectApplication(appId, adminNotes) {
    const connection = await sql.getConnection()
    try {
        await connection.beginTransaction()

        // 1. Update the user_application status to 'Rejected' and add notes
        await connection.query(`
            UPDATE user_applications 
            SET status = 'Rejected', 
                admin_notes = ?
            WHERE application_id = ?
        `, [adminNotes, appId])

        // 2. If a user was already created before rejection (e.g., during review), set verified to 0
        const [userData] = await connection.query(`
            SELECT email FROM user_applications WHERE application_id = ?
        `, [appId])

        if (userData.length > 0) {
            const email = userData[0].email
            await connection.query(`
                UPDATE user 
                SET verified = 0
                WHERE email = ?
            `, [email])
        }

        await connection.commit()
        return { success: true }
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
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

// Get all company names for search filter
export async function getAllCompanies() {
    const [result] = await sql.query(`
        SELECT DISTINCT company_name
        FROM user
        ORDER BY company_name`);
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
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR dat.barangay_id = ?)`);
        params.push(locationCode, locationCode, locationCode, locationCode);
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
    conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR dat.barangay_id = ?)`);
    params.push(locationCode, locationCode, locationCode, locationCode);
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
    query += ' AND ' + conditions.join(' AND ');
  }

  const [result] = await sql.query(query, params);
  return result[0].count;
}

// Get coordinates of filtered data
export async function getFilteredDataCoords(title, locationCode, name, companyName, startDate, endDate) {
    let query = `
        SELECT
            c.latitude, c.longitude
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        LEFT JOIN coordinate c ON dat.location_name = c.location_name
        WHERE dat.status = 'Approved'`;

    const conditions = [];
    const params = [];

    if (title) {
        conditions.push(`dat.title LIKE ?`);
        params.push(`%${title}%`);
    }

    if (locationCode) {
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR dat.barangay_id = ?)`);
        params.push(locationCode, locationCode, locationCode, locationCode);
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
        query += ' AND ' + conditions.join(' AND ');
    }

    const [result] = await sql.query(query, params);
    return result;
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
export async function getDataForReview(currentUser, status, limit, offset) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.user_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE dat.status = '${status}' AND NOT dat.user_id = ${currentUser}
        ORDER BY dat.data_entry_id DESC
        LIMIT ${limit} OFFSET ${offset}
    `)

    return result
}

// Get pending data AND list of tasks
// First priority: current users, followed by unclaimed tasks.
// Tasks claimed by others go last
export async function getPendingData(currentUser, limit, offset) {
  const [result] = await sql.query(`
    SELECT
        dat.data_entry_id,
        dat.user_id,
        dat.title,
        dat.location_name,
        u.lastname,
        u.firstname,
        u.company_name,
        dat.region_id,
        dat.province_id,
        dat.municipality_id,
        dat.date_submitted,
        dat.collection_start,
        dat.collection_end,
        dat.status,
        rl.latest_revision_date,
        rt.status AS task_status,
        rt.claimed_by,
        staff.firstname AS staff_firstname,
        staff.lastname AS staff_lastname
    FROM data_entry dat
    JOIN user u ON u.user_id = dat.user_id
    LEFT JOIN (
        SELECT data_entry_id, MAX(created_at) AS latest_revision_date
        FROM data_entry_revision_log
        GROUP BY data_entry_id
    ) rl ON rl.data_entry_id = dat.data_entry_id
    LEFT JOIN review_tasks rt ON rt.data_entry_id = dat.data_entry_id
    LEFT JOIN user staff ON staff.user_id = rt.claimed_by
    WHERE (dat.status = 'Pending Review' OR dat.status = 'Revised')
      AND dat.user_id != ?
    ORDER BY 
        CASE 
            WHEN rt.claimed_by = ? THEN 0        -- Current user's claimed entries
            WHEN rt.status = 'Unclaimed' THEN 1  -- Unclaimed
            WHEN rt.status = 'Claimed' THEN 2    -- Claimed by others
            ELSE 3
        END,
        CASE 
            WHEN dat.status = 'Pending Review' THEN dat.date_submitted
            WHEN dat.status = 'Revised' THEN rl.latest_revision_date
        END DESC
    LIMIT ? OFFSET ?
  `, [currentUser, currentUser, limit, offset]);

  return result;
}

// Get *number* of entries to review (for notifications)
export async function getDataForReviewCount(currentUser, status) {
    const [result] = await sql.query(`
        SELECT COUNT(data_entry_id)
        FROM data_entry
        WHERE status = '${status}' AND NOT user_id = ${currentUser}
    `)
    return result[0]['COUNT(data_entry_id)']
}

// Get all data by user and sort according to IDs in descending order (recent to oldest)
export async function getDataByUser(userId, status, limit, offset) {
    const [result] = await sql.query(`
        SELECT
            dat.data_entry_id, dat.title, dat.location_name,
            u.lastname, u.firstname, u.company_name,
            dat.region_id, dat.province_id, dat.municipality_id,
            dat.date_submitted, dat.collection_start, dat.collection_end,
            dat.status
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ${userId} AND dat.status = '${status}'
        ORDER BY dat.data_entry_id DESC
        LIMIT ${limit} OFFSET ${offset}
    `)

    return result
}

// Count data made by user
export async function getDataByUserCount(userId, status) {
    const [[{ count }]] = await sql.query(`
        SELECT COUNT(*) as count
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ? AND dat.status = '${status}'
    `, [userId]);

    return count;
}


export async function getApprovedDataByUserCount(userId) {
    const [[{ count }]] = await sql.query(`
        SELECT COUNT(*) as count
        FROM data_entry dat
        JOIN user u ON u.user_id = dat.user_id
        WHERE u.user_id = ? AND dat.status = 'Approved'
    `, [userId]);

    return count;
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
        FROM data_waste_composition
        WHERE data_entry_id = ?
    `, [entryId])
    return result // important, to not return an array
}

// Get coordinates by location name
export async function getCoordinates(locationName) {
    const [rows] = await sql.query(`
        SELECT latitude, longitude 
        FROM coordinate
        WHERE location_name = ?`, [locationName]);
    return rows[0]; // Only one match since location_name is unique
}

/* ---------------------------------------
    DATA REVIEW
--------------------------------------- */

// Determine whether current user has claimed the task or not
export async function getTaskClaimStatus(entryId, currentUser) {
  const [result] = await sql.query(`
    SELECT 
      rt.id,
      rt.data_entry_id,
      rt.claimed_by,
      rt.status,
      staff.firstname AS staff_firstname,
      staff.lastname AS staff_lastname
    FROM review_tasks rt
    LEFT JOIN user staff ON staff.user_id = rt.claimed_by
    WHERE rt.data_entry_id = ?
  `, [entryId]);

  if (!result || result.length === 0) {
    return { status: 'Unclaimed', isClaimedByUser: false };
  }

  const task = result[0];
  return {
    ...task,
    isClaimedByUser: task.claimed_by === currentUser
  };
}

// Change status of data entry
export async function updateDataStatus(dataId, status) {
    await sql.query(`
        UPDATE data_entry
        SET status = ?
        WHERE data_entry_id = ?
    `, [status, dataId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// Retrieve location name of entry being reviewed
export async function getEntryLocationName(id) {
    const [rows] = await sql.query(`
        SELECT location_name 
        FROM data_entry
        WHERE data_entry_id = ?`, [id]);
    return rows[0]?.location_name || null; // Only one match since ID is unique
}

// Retrieve location via Nominatim
export async function fetchCoordinates(locationName) {
    let parts = locationName.split(',').map(p => p.trim());

    // Remove region if location has at least 2 commas (3 parts)
    if (parts.length >= 3) {
        parts = parts.slice(0, 2); // Keep only City and Province, or just Province
    }

    const formattedLocation = `${parts.join(', ')}, Philippines`;
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

// Insert location entry
export async function createLocationEntry(locationName, lat, lon) {
    const result = await sql.query(`
        INSERT INTO coordinate (location_name, latitude, longitude)
        VALUES (?, ?, ?)
    `, [locationName, lat, lon])
    
    // Return new object if successful
    return result[0].insertId
}

/* ---------------------------------------
    DATA REVIEW TASKS
--------------------------------------- */

// Create task when
// 1. Data entry is submitted
// 2. Data entry is re-submitted for review (revised)
export async function createTask(data_entry_id) {
    const result = await sql.query(`
        INSERT INTO review_tasks (data_entry_id)
        VALUES (?)
    `, [data_entry_id])
    
    // Return new object if successful
    return result.insertId
}

// export async function getTasks()

// When a user claims a task
// "AND" condition prevents two users from claiming simultaneously
export async function claimTask(taskId, claimed_by) {
    await sql.query(`
        UPDATE review_tasks
        SET claimed_by = ?, status = 'Claimed'
        WHERE id = ? AND (status = 'Unclaimed' OR claimed_by IS NULL)
    `, [claimed_by, taskId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// When a user unclaims a task
export async function unclaimTask(taskId) {
    await sql.query(`
        UPDATE review_tasks
        SET claimed_by = NULL, status = 'Unclaimed'
        WHERE id = ?
    `, [taskId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// Delete task when completed
export async function completeTask(taskId) {
    await sql.query(`DELETE FROM review_tasks WHERE id = ?`, [taskId]);
}

// Get task id by data entry id
export async function getTaskByEntryId(data_entry_id) {
  const [rows] = await sql.query(`
    SELECT id FROM review_tasks
    WHERE data_entry_id = ?
    LIMIT 1
  `, [data_entry_id]);

  return rows.length > 0 ? rows[0].id : null;
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
    DATA EDITING (NEW VERSION)
--------------------------------------- */

// Create revision log
export async function createRevisionEntry(data_entry_id, user_id, action, comment) {
    const result = await sql.query(`
        INSERT INTO data_entry_revision_log (data_entry_id, user_id, action, comment)
        VALUES (?, ?, ?, ?)
    `, [data_entry_id, user_id, action, comment])
    
    // Return new object if successful
    const id = result[0].insertId
    return id
}

// Update current log ID for data entry
export async function updateCurrentLog(dataId, newLogId) {
    await sql.query(`
        UPDATE data_entry
        SET current_log_id = ?
        WHERE data_entry_id = ?
    `, [newLogId, dataId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// Get revision log count
export async function getRevisionEntryCount(entryId) {
    const [result] = await sql.query(`
        SELECT COUNT(log_id)
        FROM data_entry_revision_log
        WHERE data_entry_id = ${entryId}    
    `)
    return result[0]['COUNT(log_id)']
}

// Get revision logs for a specific data entry
// And sort from latest to oldest
export async function getRevisionEntries(entryId) {
    const [result] = await sql.query(`
        SELECT dl.action, dl.comment, dl.created_at, u.lastname, u.firstname
        FROM data_entry_revision_log dl
        JOIN user u ON dl.user_id = u.user_id
        WHERE data_entry_id = ${entryId}
        ORDER BY created_at DESC
    `)

    return result
}

// Update data entry
export async function updateForm(data_entry_id, title, region_id, province_id, municipality_id, barangay_id, location_name, population, per_capita, annual, collection_start, collection_end, wasteComposition) {
    try {
        // Update the main data_entry record
        await sql.query(
            `UPDATE data_entry 
             SET title = ?, region_id = ?, province_id = ?, municipality_id = ?, barangay_id = ?, location_name = ?, population = ?, per_capita = ?, annual = ?, collection_start = ?, collection_end = ?, status = 'Pending Review'
             WHERE data_entry_id = ?`,
            [title, region_id, province_id, municipality_id, barangay_id, location_name, population, per_capita, annual, collection_start, collection_end, data_entry_id]
        );

        // Safer: update existing or insert new waste composition records
        if (wasteComposition && wasteComposition.length > 0) {
            for (const item of wasteComposition) {
                const [existing] = await sql.query(
                    `SELECT id FROM data_waste_composition 
                     WHERE data_entry_id = ? AND sector_id = ? AND type_id = ?`,
                    [data_entry_id, item.sector_id, item.type_id]
                );

                if (existing.length > 0) {
                    // Entry exists — update it
                    await sql.query(
                        `UPDATE data_waste_composition 
                         SET waste_amount = ? 
                         WHERE data_entry_id = ? AND sector_id = ? AND type_id = ?`,
                        [item.waste_amount, data_entry_id, item.sector_id, item.type_id]
                    );
                } else {
                    // Entry does not exist — insert it
                    await sql.query(
                        `INSERT INTO data_waste_composition (data_entry_id, sector_id, type_id, waste_amount)
                         VALUES (?, ?, ?, ?)`,
                        [data_entry_id, item.sector_id, item.type_id, item.waste_amount]
                    );
                }
            }
        }

        return { success: true, message: "Form updated successfully!" };

    } catch (error) {
        console.error("Database error:", error);
        throw new Error("Error updating data in the database.");
    }
}

/* ---------------------------------------
    DATA AGGREGATION (NEW VERSION)
--------------------------------------- */
export async function getAvgInfoWithFilters(title, locationCode, name, companyName, startDate, endDate) {
    let query = `
        SELECT
            SUM(dat.per_capita) AS avg_per_capita, -- keep alias for template compatibility
            SUM(dat.annual) AS avg_annual,         -- now totals instead of averages
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
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR dat.barangay_id = ?)`); 
        params.push(locationCode, locationCode, locationCode, locationCode);
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
    return result; // single object
}

export async function getAvgWasteCompositionWithFilters(title, locationCode, name, companyName, startDate, endDate) {
    let query = `
        SELECT
            dwc.sector_id,
            dwc.type_id,
            SUM(dwc.waste_amount) AS total_waste_amount
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
        conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR barangay_id = ?)`);
        params.push(locationCode, locationCode, locationCode, locationCode);
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

export async function getWasteComplianceStatus(dataEntryId) {
  const [rows] = await sql.query(`
    SELECT
        ws.name AS supertype_name,
        cq.quota_weight AS target_rate,   -- user-specific % target
        COALESCE(SUM(wc.waste_amount), 0) AS total_collected_weight,
        de.annual AS total_generation
    FROM data_entry de
    JOIN user u ON u.user_id = de.user_id
    JOIN compliance_quotas cq 
      ON cq.user_id = de.user_id
    JOIN waste_supertype ws 
      ON ws.id = cq.waste_supertype_id
    LEFT JOIN waste_type wt 
      ON wt.supertype_id = ws.id
    LEFT JOIN data_waste_composition wc 
      ON wc.type_id = wt.id AND wc.data_entry_id = de.data_entry_id
    WHERE de.data_entry_id = ?
    GROUP BY ws.id, cq.quota_weight, de.annual
  `, [dataEntryId]);

  return rows.map(r => {
    const diversionPct = r.total_generation > 0 
      ? (r.total_collected_weight / r.total_generation) * 100 
      : 0;

    return {
      supertype_name: r.supertype_name,
      total_collected_weight: Number(r.total_collected_weight).toFixed(3),
      total_generation: Number(r.total_generation).toFixed(3),
      diversion_pct: diversionPct.toFixed(2),
      target_rate: r.target_rate,
      compliance_status: diversionPct >= r.target_rate ? 'Compliant' : 'Non-Compliant'
    };
  });
}

export async function getSectorComplianceStatus(dataEntryId) {
  const [rows] = await sql.query(`
    SELECT
        s.name AS sector_name,
        scq.quota_weight AS target_rate,   -- user-specific % target
        COALESCE(SUM(wc.waste_amount), 0) AS total_collected_weight,
        de.annual AS total_generation
    FROM data_entry de
    JOIN user u ON u.user_id = de.user_id
    JOIN sector_compliance_quotas scq 
      ON scq.user_id = de.user_id
    JOIN sector s 
      ON s.id = scq.sector_id
    LEFT JOIN data_waste_composition wc 
      ON wc.sector_id = s.id AND wc.data_entry_id = de.data_entry_id
    WHERE de.data_entry_id = ?
    GROUP BY s.id, scq.quota_weight, de.annual
  `, [dataEntryId]);

  return rows.map(r => {
    const diversionPct = r.total_generation > 0
      ? (r.total_collected_weight / r.total_generation) * 100
      : 0;

    return {
      sector_name: r.sector_name,
      total_collected_weight: Number(r.total_collected_weight).toFixed(3),
      total_generation: Number(r.total_generation).toFixed(3),
      diversion_pct: diversionPct.toFixed(2),
      target_rate: r.target_rate,
      compliance_status: diversionPct >= r.target_rate ? 'Compliant' : 'Non-Compliant'
    };
  });
}

export async function getWasteComplianceStatusFromSummary(title, region, province, locationCode, author, company, startDate, endDate) {
  const [rows] = await sql.query(`
    WITH matching_entries AS (
      SELECT DISTINCT de.data_entry_id, de.annual, de.user_id
      FROM data_entry de
      JOIN user u ON de.user_id = u.user_id
      WHERE de.status = 'Approved'
        ${title ? 'AND de.title LIKE ?' : ''}
        ${locationCode ? `
          AND (
            de.region_id = ? OR 
            de.province_id = ? OR 
            de.municipality_id = ?
          )` : ''}
        ${author ? 'AND CONCAT(u.firstname, " ", u.lastname) LIKE ?' : ''}
        ${company ? 'AND u.company_name LIKE ?' : ''}
        ${startDate ? 'AND de.collection_start >= ?' : ''}
        ${endDate ? 'AND de.collection_end <= ?' : ''}
    ),
    waste_totals AS (
      SELECT
        me.user_id,
        wt.supertype_id,
        SUM(wc.waste_amount) AS total_collected_weight
      FROM matching_entries me
      JOIN data_waste_composition wc ON wc.data_entry_id = me.data_entry_id
      JOIN waste_type wt ON wc.type_id = wt.id
      GROUP BY me.user_id, wt.supertype_id
    ),
    total_gen AS (
      SELECT user_id, SUM(me.annual) AS grand_total
      FROM matching_entries me
      GROUP BY user_id
    )
    SELECT
      ws.name AS supertype_name,
      COALESCE(SUM(wt.total_collected_weight), 0) AS total_collected_weight,
      COALESCE(SUM(g.grand_total), 0) AS total_generated,
      ROUND((COALESCE(SUM(wt.total_collected_weight), 0) / NULLIF(SUM(g.grand_total),0)) * 100, 2) AS diversion_percentage,
      ROUND(AVG(cq.quota_weight), 2) AS target_percentage,
      CASE
        WHEN ROUND((COALESCE(SUM(wt.total_collected_weight), 0) / NULLIF(SUM(g.grand_total),0)) * 100, 2) >= ROUND(AVG(cq.quota_weight), 2)
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM waste_supertype ws
    LEFT JOIN compliance_quotas cq ON cq.waste_supertype_id = ws.id
    LEFT JOIN waste_totals wt ON wt.supertype_id = ws.id AND wt.user_id = cq.user_id
    LEFT JOIN total_gen g ON g.user_id = cq.user_id
    GROUP BY ws.id, ws.name
    ORDER BY ws.name;
  `, [
    ...(title ? [`%${title}%`] : []),
    ...(locationCode ? [locationCode, locationCode, locationCode] : []),
    ...(author ? [`%${author}%`] : []),
    ...(company ? [`%${company}%`] : []),
    ...(startDate ? [startDate] : []),
    ...(endDate ? [endDate] : [])
  ]);

  return rows;
}

export async function getSectorComplianceStatusFromSummary(title, region, province, locationCode, author, company, startDate, endDate) {
  const [rows] = await sql.query(`
    WITH matching_entries AS (
      SELECT DISTINCT de.data_entry_id, de.annual, de.user_id
      FROM data_entry de
      JOIN user u ON de.user_id = u.user_id
      WHERE de.status = 'Approved'
        ${title ? 'AND de.title LIKE ?' : ''}
        ${locationCode ? `
          AND (
            de.region_id = ? OR 
            de.province_id = ? OR 
            de.municipality_id = ?
          )` : ''}
        ${author ? 'AND CONCAT(u.firstname, " ", u.lastname) LIKE ?' : ''}
        ${company ? 'AND u.company_name LIKE ?' : ''}
        ${startDate ? 'AND de.collection_start >= ?' : ''}
        ${endDate ? 'AND de.collection_end <= ?' : ''}
    ),
    sector_totals AS (
      SELECT
        me.user_id,
        wc.sector_id,
        SUM(wc.waste_amount) AS total_collected_weight
      FROM matching_entries me
      JOIN data_waste_composition wc ON wc.data_entry_id = me.data_entry_id
      GROUP BY me.user_id, wc.sector_id
    ),
    total_gen AS (
      SELECT user_id, SUM(me.annual) AS grand_total
      FROM matching_entries me
      GROUP BY user_id
    )
    SELECT
      s.name AS sector_name,
      COALESCE(SUM(st.total_collected_weight), 0) AS total_collected_weight,
      COALESCE(SUM(g.grand_total), 0) AS total_generated,
      ROUND((COALESCE(SUM(st.total_collected_weight), 0) / NULLIF(SUM(g.grand_total),0)) * 100, 2) AS diversion_percentage,
      ROUND(AVG(scq.quota_weight), 2) AS target_percentage,
      CASE
        WHEN ROUND((COALESCE(SUM(st.total_collected_weight), 0) / NULLIF(SUM(g.grand_total),0)) * 100, 2) >= ROUND(AVG(scq.quota_weight), 2)
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM sector s
    LEFT JOIN sector_compliance_quotas scq ON scq.sector_id = s.id
    LEFT JOIN sector_totals st ON st.sector_id = s.id AND st.user_id = scq.user_id
    LEFT JOIN total_gen g ON g.user_id = scq.user_id
    GROUP BY s.id, s.name
    ORDER BY s.name;
  `, [
    ...(title ? [`%${title}%`] : []),
    ...(locationCode ? [locationCode, locationCode, locationCode] : []),
    ...(author ? [`%${author}%`] : []),
    ...(company ? [`%${company}%`] : []),
    ...(startDate ? [startDate] : []),
    ...(endDate ? [endDate] : [])
  ]);

  return rows;
}


export async function getSummaryParticipants(title, region, province, locationCode, author, company, startDate, endDate) {
  const [rows] = await sql.query(`
    SELECT DISTINCT 
      CONCAT(u.firstname, ' ', u.lastname) AS author_name,
      u.company_name,
      de.region_id,
      de.province_id,
      de.municipality_id,
      de.barangay_id
    FROM data_entry de
    JOIN user u ON de.user_id = u.user_id
    WHERE de.status = 'Approved'
      ${title ? 'AND de.title LIKE ?' : ''}
      ${locationCode ? `
        AND (
          de.region_id = ? OR 
          de.province_id = ? OR 
          de.municipality_id = ? OR 
          de.barangay_id = ?
        )` : ''}
      ${author ? 'AND CONCAT(u.firstname, " ", u.lastname) LIKE ?' : ''}
      ${company ? 'AND u.company_name LIKE ?' : ''}
      ${startDate ? 'AND de.collection_start >= ?' : ''}
      ${endDate ? 'AND de.collection_end <= ?' : ''}
  `, [
    ...(title ? [`%${title}%`] : []),
    ...(locationCode ? [locationCode, locationCode, locationCode, locationCode] : []),
    ...(author ? [`%${author}%`] : []),
    ...(company ? [`%${company}%`] : []),
    ...(startDate ? [startDate] : []),
    ...(endDate ? [endDate] : [])
  ]);

  return rows;
}

export async function groupComplianceData(wasteCompliance, sectorCompliance) {
  const grouped = {};

  wasteCompliance.forEach(item => {
    const category = item.supertype_name;
    if (!grouped[category]) grouped[category] = [];

    const diverted = (item.total_collected_weight / item.total_generated_weight) * 100;

    grouped[category].push({
      name: `${item.firstname} ${item.lastname}`,
      organization: item.company_name,
      diverted: diverted.toFixed(2),
      target: item.target_percent || 20, // fallback if null
      status: diverted >= (item.target_percent || 20) ? "Compliant" : "Non-Compliant"
    });
  });

  sectorCompliance.forEach(item => {
    const sector = item.sector_name;
    if (!grouped[sector]) grouped[sector] = [];

    const diverted = (item.total_collected_weight / item.total_generated_weight) * 100;

    grouped[sector].push({
      name: `${item.firstname} ${item.lastname}`,
      organization: item.company_name,
      diverted: diverted.toFixed(2),
      target: item.target_percent || 20,
      status: diverted >= (item.target_percent || 20) ? "Compliant" : "Non-Compliant"
    });
  });

  return grouped;
}

export async function getWasteComplianceByUser(category) {
  const [rows] = await sql.query(`
    WITH entry_diversions AS (
      SELECT 
        de.data_entry_id,
        de.user_id,
        wt.supertype_id,
        de.population,
        SUM(wc.waste_amount) AS collected,
        de.annual AS total_generated
      FROM data_waste_composition wc
      JOIN data_entry de ON wc.data_entry_id = de.data_entry_id
      JOIN waste_type wt ON wc.type_id = wt.id
      WHERE de.status = 'Approved'
      GROUP BY de.data_entry_id, de.user_id, wt.supertype_id, de.population, de.annual
    ),
    user_totals AS (
      SELECT
        ed.user_id,
        ed.supertype_id,
        SUM(ed.collected) AS total_collected,
        SUM(ed.total_generated) AS total_generated,
        ROUND(AVG(ed.total_generated / NULLIF(ed.population,0)),2) AS waste_per_capita
      FROM entry_diversions ed
      GROUP BY ed.user_id, ed.supertype_id
    )
    SELECT
      u.user_id,
      u.firstname,
      u.lastname,
      u.company_name,
      ws.name AS supertype_name,
      ROUND((ut.total_collected / NULLIF(ut.total_generated,0)) * 100, 2) AS diversion_percentage,
      cq.quota_weight AS target_percentage,
      ut.total_collected,
      ut.total_generated,
      ut.waste_per_capita,
      CASE
        WHEN ROUND((ut.total_collected / NULLIF(ut.total_generated,0)) * 100, 2) >= cq.quota_weight
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    JOIN user_totals ut ON ut.user_id = u.user_id
    JOIN waste_supertype ws ON ws.id = ut.supertype_id
    JOIN compliance_quotas cq ON cq.waste_supertype_id = ws.id AND cq.user_id = u.user_id
    WHERE ws.name = ?
    ORDER BY u.lastname, u.firstname
  `, [category]);

  return rows;
}

export async function getSectorComplianceByUser(category) {
  const [rows] = await sql.query(`
    WITH entry_diversions AS (
      SELECT 
        de.data_entry_id,
        de.user_id,
        wc.sector_id,
        de.population,
        SUM(wc.waste_amount) AS collected,
        de.annual AS total_generated
      FROM data_waste_composition wc
      JOIN data_entry de ON wc.data_entry_id = de.data_entry_id
      WHERE de.status = 'Approved'
      GROUP BY de.data_entry_id, de.user_id, wc.sector_id, de.population, de.annual
    ),
    user_totals AS (
      SELECT
        ed.user_id,
        ed.sector_id,
        SUM(ed.collected) AS total_collected,
        SUM(ed.total_generated) AS total_generated,
        ROUND(AVG(ed.total_generated / NULLIF(ed.population,0)),2) AS waste_per_capita
      FROM entry_diversions ed
      GROUP BY ed.user_id, ed.sector_id
    )
    SELECT
      u.user_id,
      u.firstname,
      u.lastname,
      u.company_name,
      s.name AS sector_name,
      ROUND((ut.total_collected / NULLIF(ut.total_generated,0)) * 100, 2) AS diversion_percentage,
      scq.quota_weight AS target_percentage,
      ut.total_collected,
      ut.total_generated,
      ut.waste_per_capita,
      CASE
        WHEN ROUND((ut.total_collected / NULLIF(ut.total_generated,0)) * 100, 2) >= scq.quota_weight
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    JOIN user_totals ut ON ut.user_id = u.user_id
    JOIN sector s ON s.id = ut.sector_id
    JOIN sector_compliance_quotas scq ON scq.sector_id = s.id AND scq.user_id = u.user_id
    WHERE s.name = ?
    ORDER BY u.lastname, u.firstname
  `, [category]);

  return rows;
}


export async function getUserWasteComplianceSummary() {
  const [rows] = await sql.query(`
    WITH approved_entries AS (
      SELECT de.data_entry_id, de.user_id
      FROM data_entry de
      WHERE de.status = 'Approved'
    ),
    entry_count AS (
      SELECT user_id, COUNT(*) AS entry_count
      FROM approved_entries
      GROUP BY user_id
    ),
    waste_collected AS (
      SELECT 
        ae.user_id,
        wt.supertype_id,
        SUM(wc.waste_amount) AS total_collected_weight
      FROM data_waste_composition wc
      JOIN approved_entries ae ON wc.data_entry_id = ae.data_entry_id
      JOIN waste_type wt ON wc.type_id = wt.id
      GROUP BY ae.user_id, wt.supertype_id
    )
    SELECT
      u.firstname,
      u.lastname,
      u.company_name,
      ws.name AS supertype_name,
      cq.quota_weight * ec.entry_count AS quota_weight,
      COALESCE(wc.total_collected_weight, 0) AS total_collected_weight,
      CASE
        WHEN COALESCE(wc.total_collected_weight, 0) >= cq.quota_weight * ec.entry_count THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    JOIN entry_count ec ON u.user_id = ec.user_id
    JOIN compliance_quotas cq ON 1=1
    JOIN waste_supertype ws ON cq.waste_supertype_id = ws.id
    LEFT JOIN waste_collected wc ON wc.user_id = u.user_id AND wc.supertype_id = ws.id
    ORDER BY u.lastname ASC, ws.id ASC
  `);

  return rows;
}

export async function getUserSectorComplianceSummary() {
  const [rows] = await sql.query(`
    WITH approved_entries AS (
      SELECT de.data_entry_id, de.user_id
      FROM data_entry de
      WHERE de.status = 'Approved'
    ),
    entry_count AS (
      SELECT user_id, COUNT(*) AS entry_count
      FROM approved_entries
      GROUP BY user_id
    ),
    waste_collected AS (
      SELECT 
        ae.user_id,
        wc.sector_id,
        SUM(wc.waste_amount) AS total_collected_weight
      FROM data_waste_composition wc
      JOIN approved_entries ae ON wc.data_entry_id = ae.data_entry_id
      GROUP BY ae.user_id, wc.sector_id
    )
    SELECT
      u.firstname,
      u.lastname,
      u.company_name,
      s.name AS sector_name,
      scq.quota_weight * ec.entry_count AS quota_weight,
      COALESCE(wc.total_collected_weight, 0) AS total_collected_weight,
      CASE
        WHEN COALESCE(wc.total_collected_weight, 0) >= scq.quota_weight * ec.entry_count THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    JOIN entry_count ec ON u.user_id = ec.user_id
    JOIN sector_compliance_quotas scq ON 1=1
    JOIN sector s ON s.id = scq.sector_id
    LEFT JOIN waste_collected wc ON wc.user_id = u.user_id AND wc.sector_id = s.id
    ORDER BY u.lastname ASC, s.id ASC
  `);

  return rows;
}

export async function getWasteNonCompliantClients(userId) {
  const [rows] = await sql.query(`
    WITH user_entries AS (
      SELECT de.data_entry_id, de.annual
      FROM data_entry de
      WHERE de.user_id = ? AND de.status = 'Approved'
    ),
    total_gen AS (
      SELECT SUM(annual) AS annual_generated
      FROM user_entries
    ),
    waste_totals AS (
      SELECT wt.supertype_id, SUM(wc.waste_amount) AS total_collected
      FROM data_waste_composition wc
      JOIN waste_type wt ON wc.type_id = wt.id
      WHERE wc.data_entry_id IN (SELECT data_entry_id FROM user_entries)
      GROUP BY wt.supertype_id
    )
    SELECT
      u.user_id,
      u.firstname,
      u.lastname,
      u.company_name,
      ws.name AS supertype_name,
      COUNT(DISTINCT ue.data_entry_id) AS entry_count,
      g.annual_generated,
      cq.quota_weight AS target_percent,
      COALESCE(wt.total_collected, 0) AS total_collected,
      ROUND((COALESCE(wt.total_collected, 0) / NULLIF(g.annual_generated,0)) * 100, 2) AS actual_percent,
      CASE
        WHEN ROUND((COALESCE(wt.total_collected, 0) / NULLIF(g.annual_generated,0)) * 100, 2) >= cq.quota_weight
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    CROSS JOIN total_gen g
    JOIN waste_supertype ws
    LEFT JOIN waste_totals wt ON wt.supertype_id = ws.id
    LEFT JOIN compliance_quotas cq ON cq.waste_supertype_id = ws.id AND cq.user_id = u.user_id
    LEFT JOIN user_entries ue ON 1=1
    WHERE u.user_id = ?
    GROUP BY u.user_id, ws.id, u.firstname, u.lastname, u.company_name, ws.name, g.annual_generated, cq.quota_weight, wt.total_collected
    HAVING compliance_status = 'Non-Compliant'
  `, [userId, userId]);

  return rows;
}

export async function getSectorNonCompliantClients(userId) {
  const [rows] = await sql.query(`
    WITH user_entries AS (
      SELECT de.data_entry_id, de.annual
      FROM data_entry de
      WHERE de.user_id = ? AND de.status = 'Approved'
    ),
    total_gen AS (
      SELECT SUM(annual) AS annual_generated
      FROM user_entries
    ),
    sector_totals AS (
      SELECT wc.sector_id, SUM(wc.waste_amount) AS total_collected
      FROM data_waste_composition wc
      WHERE wc.data_entry_id IN (SELECT data_entry_id FROM user_entries)
      GROUP BY wc.sector_id
    )
    SELECT
      u.user_id,
      u.firstname,
      u.lastname,
      u.company_name,
      s.name AS sector_name,
      COUNT(DISTINCT ue.data_entry_id) AS entry_count,
      g.annual_generated,
      scq.quota_weight AS target_percent,
      COALESCE(st.total_collected, 0) AS total_collected,
      ROUND((COALESCE(st.total_collected, 0) / NULLIF(g.annual_generated,0)) * 100, 2) AS actual_percent,
      CASE
        WHEN ROUND((COALESCE(st.total_collected, 0) / NULLIF(g.annual_generated,0)) * 100, 2) >= scq.quota_weight
        THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM user u
    CROSS JOIN total_gen g
    JOIN sector s
    LEFT JOIN sector_totals st ON st.sector_id = s.id
    LEFT JOIN sector_compliance_quotas scq ON scq.sector_id = s.id AND scq.user_id = u.user_id
    LEFT JOIN user_entries ue ON 1=1
    WHERE u.user_id = ?
    GROUP BY u.user_id, s.id, u.firstname, u.lastname, u.company_name, s.name, g.annual_generated, scq.quota_weight, st.total_collected
    HAVING compliance_status = 'Non-Compliant'
  `, [userId, userId]);

  return rows;
}



// Get all waste quotas by organization (grouped)
export async function getWasteQuotasByOrganization(orgName) {
  const [rows] = await sql.query(`
    SELECT 
      MIN(cq.quota_id) AS quota_id,
      ws.name AS waste_supertype_name,
      AVG(cq.quota_weight) AS quota_weight
    FROM compliance_quotas cq
    JOIN waste_supertype ws ON cq.waste_supertype_id = ws.id
    WHERE cq.organization = ?
    GROUP BY ws.name
    ORDER BY ws.name
  `, [orgName]);
  return rows;
}

// Get all sector quotas by organization (grouped)
export async function getSectorQuotasByOrganization(orgName) {
  const [rows] = await sql.query(`
    SELECT 
      MIN(scq.quota_id) AS quota_id,
      s.name AS sector_name,
      AVG(scq.quota_weight) AS quota_weight
    FROM sector_compliance_quotas scq
    JOIN sector s ON scq.sector_id = s.id
    WHERE scq.organization = ?
    GROUP BY s.name
    ORDER BY s.name
  `, [orgName]);
  return rows;
}

// Update ALL users under that organization
export async function updateWasteQuotaForOrg(orgName, wasteName, newWeight) {
  await sql.query(`
    UPDATE compliance_quotas cq
    JOIN waste_supertype ws ON cq.waste_supertype_id = ws.id
    SET cq.quota_weight = ?
    WHERE cq.organization = ? AND ws.name = ?
  `, [newWeight, orgName, wasteName]);
}

export async function updateSectorQuotaForOrg(orgName, sectorName, newWeight) {
  await sql.query(`
    UPDATE sector_compliance_quotas scq
    JOIN sector s ON scq.sector_id = s.id
    SET scq.quota_weight = ?
jdelacruz@greencycleconsultancy.com    WHERE scq.organization = ? AND s.name = ?
  `, [newWeight, orgName, sectorName]);
}


export async function createDefaultQuotasForUser(userId) {
  // Waste quotas
  await sql.query(`
    INSERT INTO compliance_quotas (waste_supertype_id, user_id, quota_weight)
    SELECT id, ?, 20.00
    FROM waste_supertype
    WHERE id NOT IN (
      SELECT waste_supertype_id 
      FROM compliance_quotas 
      WHERE user_id = ?
    )
  `, [userId, userId]);

  // Sector quotas
  await sql.query(`
    INSERT INTO sector_compliance_quotas (sector_id, user_id, quota_weight)
    SELECT id, ?, 20.00
    FROM sector
    WHERE id NOT IN (
      SELECT sector_id
      FROM sector_compliance_quotas
      WHERE user_id = ?
    )
  `, [userId, userId]);
}

export async function getTopDashboardData() {
  try {
    const [topSectors] = await sql.query(`
      SELECT s.name, SUM(dwc.waste_amount) AS total_waste
      FROM data_waste_composition dwc
      JOIN sector s ON dwc.sector_id = s.id
      GROUP BY s.name
      ORDER BY total_waste DESC
    `);

    const [topWasteTypes] = await sql.query(`
      SELECT ws.name AS supertype_name, SUM(dwc.waste_amount) AS total_waste
      FROM data_waste_composition dwc
      JOIN waste_type wt ON dwc.type_id = wt.id
      JOIN waste_supertype ws ON wt.supertype_id = ws.id
      GROUP BY ws.name
      ORDER BY total_waste DESC
    `);

    return {
      topSectors,
      topWasteTypes
    };
  } catch (err) {
    console.error('Error fetching top data:', err);
    throw err;
  }
}

// dashboard.js
export async function getDeadlineTimer(userId) {
  // First get the user role supertype
  const [userRows] = await sql.query(`
    SELECT ur.supertype
    FROM user u
    JOIN user_roles ur ON u.role_id = ur.role_id
    WHERE u.user_id = ?
  `, [userId]);

  if (userRows.length === 0) {
    return { error: "User not found" };
  }

  const supertype = userRows[0].supertype;

  // Only clients (supertype = 2) are affected by deadline
  if (supertype !== 2) {
    return { submitted: true, deadline: null, exempt: true };
  }

  // Check if already submitted this month
  const [rows] = await sql.query(`
    SELECT COUNT(*) AS count
    FROM data_entry
    WHERE user_id = ?
      AND status = 'approved'
      AND MONTH(date_submitted) = MONTH(CURRENT_DATE())
      AND YEAR(date_submitted) = YEAR(CURRENT_DATE())
  `, [userId]);

  const hasSubmitted = rows[0].count > 0;

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return {
    submitted: hasSubmitted,
    deadline: endOfMonth.toISOString(),
    exempt: false
  };
}

// Get time series data (for trend charts)
export async function getTimeSeriesData(title, locationCode, author, company, startDate, endDate, aggregation = 'daily') {
  let dateExpr = '';
  if (aggregation === 'weekly') {
    dateExpr = `YEARWEEK(dat.collection_start, 1)`; // week number
  } else if (aggregation === 'monthly') {
    dateExpr = `DATE_FORMAT(dat.collection_start, '%Y-%m')`; // month string
  } else {
    dateExpr = `DATE(dat.collection_start)`; // default daily
  }

  let query = `
    SELECT
      ${dateExpr} AS date,
      SUM(dwc.waste_amount) AS total_weight,
      AVG(dat.per_capita) AS avg_per_capita,
      ws.name AS waste_type,
      CASE
        WHEN SUM(dwc.waste_amount) > 0 THEN 'Compliant'
        ELSE 'Non-Compliant'
      END AS compliance_status
    FROM data_entry dat
    JOIN data_waste_composition dwc ON dat.data_entry_id = dwc.data_entry_id
    JOIN waste_type wt ON dwc.type_id = wt.id
    JOIN waste_supertype ws ON wt.supertype_id = ws.id
    JOIN user u ON dat.user_id = u.user_id
    WHERE dat.status = 'Approved'`;

  const conditions = [];
  const params = [];

  if (title) {
    conditions.push(`dat.title LIKE ?`);
    params.push(`%${title}%`);
  }

  if (locationCode) {
    conditions.push(`(dat.region_id = ? OR dat.province_id = ? OR dat.municipality_id = ? OR dat.barangay_id = ?)`);
    params.push(locationCode, locationCode, locationCode, locationCode);
  }

  if (author) {
    conditions.push(`(u.firstname LIKE ? OR u.lastname LIKE ?)`);
    params.push(`%${author}%`, `%${author}%`);
  }

  if (company) {
    conditions.push(`u.company_name LIKE ?`);
    params.push(`%${company}%`);
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

  if (conditions.length > 0) query += ` AND ` + conditions.join(' AND ');

  query += `
    GROUP BY date, ws.name
    ORDER BY date ASC;
  `;

  const [rows] = await sql.query(query, params);
  return rows;
}

// Hybrid System Dynamics + Monte Carlo
export function runHybridSimulation(timeSeriesData, iterations = 500, horizon = 12) {
  const results = [];

  // Initial baseline from latest actual record
  const last = timeSeriesData[timeSeriesData.length - 1];
  const baseWaste = Number(last.total_weight);
  const basePerCapita = Number(last.avg_per_capita);
  const baseCompliance = last.compliance_status === 'Compliant' ? 0.7 : 0.5;

  for (let i = 0; i < iterations; i++) {
    // Monte Carlo sampling
    const gP = randNormal(0.02, 0.005);        // population growth rate
    const etaR = randTriangular(0.3, 0.5, 0.7);
    const alphaEdu = Math.random() * 0.02;
    const alphaDecay = Math.random() * 0.01;

    let W = baseWaste;
    let wpc = basePerCapita;
    let C = baseCompliance;

    const trial = [];

    for (let t = 0; t < horizon; t++) {
      const population = 1 + gP * (t + 1); // relative index
      const R = C * etaR * W;
      const B = 0.25 * W; // assume 25% biodegradable

      // System Dynamics updates
      W = W + (gP * population * wpc) - R - B;
      wpc = wpc * (1 + (Math.random() * 0.01 - 0.005)); // behavioral noise
      C = Math.min(1, Math.max(0, C + alphaEdu - alphaDecay + (Math.random() - 0.5) * 0.02));

      trial.push({ step: t, totalWaste: W, compliance: C, perCapita: wpc });
    }

    results.push(trial);
  }

  return aggregateSimulation(results);
}

/* --- Helper functions --- */
function randNormal(mean, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function randTriangular(min, mode, max) {
  const F = (mode - min) / (max - min);
  const rand = Math.random();
  if (rand < F) return min + Math.sqrt(rand * (max - min) * (mode - min));
  return max - Math.sqrt((1 - rand) * (max - min) * (max - mode));
}

function aggregateSimulation(simResults) {
  const horizon = simResults[0].length;
  const meanWaste = [];
  for (let t = 0; t < horizon; t++) {
    const wastes = simResults.map(r => r[t].totalWaste);
    const mean = wastes.reduce((a, b) => a + b, 0) / wastes.length;
    const sd = Math.sqrt(wastes.map(w => Math.pow(w - mean, 2)).reduce((a, b) => a + b) / wastes.length);
    meanWaste.push({ step: t, mean, upper: mean + 1.96 * sd, lower: mean - 1.96 * sd });
  }
  return meanWaste;
}


/* ---------------------------------------
    CONTROL PANEL
--------------------------------------- */

// Get users with the most data submissions
export async function getTopContributors(limit) {
    // Includes users with a count of 0
    let query = `
        SELECT 
            u.user_id, u.lastname, u.firstname,
            COUNT(dat.data_entry_id) AS entry_count
        FROM user AS u
        LEFT JOIN data_entry AS dat 
            ON dat.user_id = u.user_id
        GROUP BY u.user_id, u.lastname, u.firstname
        ORDER BY entry_count DESC
    `;

    const values = [];

    if (limit && Number.isInteger(limit)) {
        query += ` LIMIT ?`;
        values.push(limit);
    }

    const [result] = await sql.query(query, values);
    console.log(result)
    return result;
}

// Get latest data entry submissions
export async function getLatestSubmissions(limit) {
    let query = `
        SELECT
            dat.data_entry_id, dat.title, dat.date_submitted, dat.status, dat.location_name,
            u.lastname, u.firstname, u.company_name
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
    // Get all PSGC regions
    const psgcRegions = await PSGCResource.getRegions();

    // Get region entry counts from the database
    const [dbCounts] = await sql.query(`
        SELECT region_id, COUNT(data_entry_id) AS entry_count
        FROM data_entry
        GROUP BY region_id
    `);

    // Create a lookup for quick access to entry counts
    const countMap = {};
    dbCounts.forEach(row => {
        countMap[row.region_id] = row.entry_count;
    });

    // Combine PSGC data with entry counts
    let fullList = psgcRegions.map(region => ({
        region_id: region.code,
        region_name: region.name,
        entry_count: countMap[region.code] || 0
    }));

    // Sort by entry count DESC, then by region name ASC
    fullList.sort((a, b) => {
        if (b.entry_count !== a.entry_count) {
        return b.entry_count - a.entry_count;
        }
        return a.region_name.localeCompare(b.region_name);
    });

    // Apply limit if given and valid
    if (limit && Number.isInteger(limit) && limit > 0) {
        fullList = fullList.slice(0, limit);
    }

    return fullList;
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
        LEFT JOIN data_entry d
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

/* ---------------------------------------
    NOTIFICATIONS
--------------------------------------- */

// Create notification for user
export async function createNotification(targetUserId, msgType, message, link) {
    const result = await sql.query(`
        INSERT INTO notifications (user_id, message_type, message, link)
        VALUES (?, ?, ?, ?)
    `, [targetUserId, msgType, message, link])
    
    // Return new object if successful
    const id = result[0].insertId
    return id
}

// Get notifications for user (paginated)
export async function getNotifications(userId, limit = 10, offset = 0) {
  const [result] = await sql.query(`
    SELECT *
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  return result;
}

// Total notif count (regardless of status)
export async function getNotificationCount(userId) {
  const [[{ total }]] = await sql.query(`
    SELECT COUNT(*) AS total
    FROM notifications
    WHERE user_id = ?`,
    [userId]
  );
  return total;
}

// Count notifs for user
export async function getUnreadNotifCount(userId) {
    const [result] = await sql.query(`
        SELECT COUNT(id)
        FROM notifications
        WHERE user_id = ? AND is_read = 0
    `, [userId])
    return result[0]['COUNT(id)']
}

// Set notif as read
export async function updateNotifRead(notifId, isRead) {
    await sql.query(`
        UPDATE notifications
        SET is_read = ?
        WHERE id = ?
    `, [isRead, notifId], function (err, result) {
        if (err) throw err;
        console.log(result.affectedRows + " record(s) updated");
    })
}

// Update notif (batch version)
export async function updateNotifReadBatch(notifIds, isRead) {
  if (!notifIds || notifIds.length === 0) return;

  const placeholders = notifIds.map(() => '?').join(',');
  const values = [isRead, ...notifIds];

  await sql.query(
    `UPDATE notifications
    SET is_read = ?
    WHERE id IN (${placeholders})
    `,
    values,
    function (err, result) {
      if (err) throw err;
      console.log(`${result.affectedRows} notification(s) updated`);
    }
  );
}

// Get notif status
export async function getNotifStatus(notifId) {
    const [result] = await sql.query(`
        SELECT is_read FROM notifications WHERE id = ?`, [notifId])
    return result
}

// Delete notif
export async function deleteNotification(notifId) {
    await sql.query(
        `DELETE FROM notifications WHERE id = ?`,
        [notifId]
    );
}

// Delete multiple notifications by selection
export async function deleteNotificationsBatch(ids) {
  if (!ids.length) return;

  const placeholders = ids.map(() => '?').join(',');
  const query = `
    DELETE FROM notifications
    WHERE id IN (${placeholders})
  `;

  try {
    await sql.query(query, ids);
    console.log(`${ids.length} notifications deleted`);
  } catch (err) {
    console.error('Error deleting notifications batch:', err);
    throw err;
  }
}