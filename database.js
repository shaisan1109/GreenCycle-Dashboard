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

/* ---------------------------------------
    FORM SUBMISSION
--------------------------------------- */
export async function submitForm(name, company_name, region, province, municipality,
     barangay, population, per_capita, annual, date_submitted, year_collected, date_start, date_end, wasteComposition) {
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
            `INSERT INTO waste_generation (client_id, location_id, population, per_capita, annual, date_submitted, year_collected)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [client_id, location_id, population, per_capita, annual, date_submitted, year_collected]
        );

        const collection_id = wasteGenResult.insertId;

        // Ensure collection_id is valid
        if (!collection_id) {
            throw new Error("Failed to insert into waste_generation, collection_id is NULL.");
        }

        // Insert into data_collection_periods table
        await sql.query(
            `INSERT INTO data_collection_periods (location_code, date_start, date_end)
            VALUES (?, ?, ?)`, 
            [location_code, date_start, date_end]
        );

       // Insert into waste_composition table (only if wasteComposition is provided)
// Define mappings for materials and origins based on your tables
const materialMap = {
    "paper": 1,
    "glass": 2,
    "metal": 3,
    "plastics": 4,
    "kitchen_waste": 5,
    "hazardous_waste": 6,
    "electronic_waste": 7,
    "other_organic": 8,
    "other_non_organic": 9
};

const originMap = {
    "Residential": 1,
    "Commercial": 2,
    "Institutional": 3,
    "Industrial": 4,
    "Health": 5,
    "Agricultural and Livestock": 6
};

// Insert into waste_composition table (only if wasteComposition is provided)
if (wasteComposition && wasteComposition.length > 0) {
    try {
        await sql.beginTransaction(); // Start transaction

        for (const entry of wasteComposition) {
            let { material_id, origin_id, waste_amount, subtype_remarks } = entry;

            // Convert material and origin names to their respective IDs
            const materialInt = materialMap[material_id.toLowerCase()];
            const originInt = originMap[origin_id];

            // Ensure IDs are valid before inserting
            if (!materialInt || !originInt) {
                throw new Error(`Invalid material (${material_id}) or origin (${origin_id}) provided.`);
            }

            // Insert into database
            await sql.query(
                `INSERT INTO waste_composition (collection_id, material_id, origin_id, waste_amount, subtype_remarks)
                 VALUES (?, ?, ?, ?, ?)`, 
                [collection_id, materialInt, originInt, waste_amount, subtype_remarks || null]
            );
        }

        await sql.commit(); // Commit transaction if successful
    } catch (error) {
        await sql.rollback(); // Rollback transaction on error
        console.error("Error inserting waste composition:", error);
        throw new Error("Failed to insert waste composition data.");
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
export async function getApplications() {
    const [result] = await sql.query(`SELECT * FROM user_applications`)
    return result
}

export async function getApplicationById(id) {
    const [result] = await sql.query(`SELECT * FROM user_applications WHERE application_id=?`, [id])
    return result
}

// NOTE: Also serves as the function that *creates* a user
export async function approveApplication(appId) {
    // UPDATE user_applications SET status='Approved' WHERE application_id='${appId}'
}

export async function rejectApplication(appId) {
    // UPDATE user_applications SET status='Rejected' WHERE application_id='${appId}'
}