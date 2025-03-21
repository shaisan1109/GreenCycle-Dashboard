// .env setup
import 'dotenv/config'

import mysql from 'mysql2'

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
