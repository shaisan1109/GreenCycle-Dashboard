document.addEventListener('DOMContentLoaded', function() {
    // Get modal elements
    const userManagementModal = document.getElementById('user-management-modal');
    const createRoleModal = document.getElementById('create-role-modal');
    
    // Get buttons that open the modals
    const manageUserButtons = document.querySelectorAll('.manage-users-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const createRoleButton = document.getElementById('create-role-btn');
    
    // Get elements that close the modals
    const closeButtons = document.querySelectorAll('.close-btn');
    const cancelButtons = document.querySelectorAll('.cancel-btn');
    const closeModalButtons = document.querySelectorAll('.close-modal-btn');
    
  const createCompanyRoleButton = document.getElementById('create-company-role-btn');
  const createCompanyRoleModal = document.getElementById('create-company-role-modal');
  const createCompanyRoleForm = document.getElementById('create-company-role-form');
    
  // Get users of role table
    const tblUsersOfRole = document.getElementById('users-table-body');

let selectedRoleId = null;

manageUserButtons.forEach(button => {
    button.addEventListener('click', async function () {
        const roleId = this.getAttribute('data-role-id');
        const roleName = this.getAttribute('data-role-name');
        selectedRoleId = roleId;

        document.getElementById('modal-role-name').textContent = roleName;

        try {
            const [roleUsersRes, allUsersRes] = await Promise.all([
                fetch(`/users/role/${roleId}`),
                fetch('/users/all') // 👈 You’ll need this endpoint
            ]);

            const usersOfRole = await roleUsersRes.json();
            const allUsers = await allUsersRes.json();

            showUsersOfRole(usersOfRole);
            populateUserDropdown(allUsers, usersOfRole);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('❌ Failed to load users.');
        }

        userManagementModal.style.display = 'flex';
    });
});

function populateUserDropdown(allUsers, usersOfRole) {
    const currentIds = new Set(usersOfRole.map(u => u.user_id));
    userDropdown.innerHTML = `<option value="">-- Select a user to add --</option>`;

    allUsers.forEach(user => {
        if (!currentIds.has(user.user_id)) {
            const option = document.createElement('option');
            option.value = user.user_id;
            option.textContent = `${user.firstname} ${user.lastname} (${user.email})`;
            userDropdown.appendChild(option);
        }
    });
}

const addUserButton = document.querySelector('.add-user-btn');
addUserButton.addEventListener('click', async function () {
    const userId = userDropdown.value;

    if (!userId) {
        alert("❌ Please select a user to add.");
        return;
    }

    if (!selectedRoleId) {
        alert("❌ No role selected. Cannot proceed.");
        return;
    }

    try {
        const userRes = await fetch(`/users/${userId}`);
        if (!userRes.ok) throw new Error(`❌ User with ID ${userId} not found.`);

        const userData = await userRes.json();
        const fullName = `${userData.firstname} ${userData.lastname}`;

        const confirmed = confirm(`Are you sure you want to assign ${fullName} to this role? This will replace their current role.`);
        if (!confirmed) return;

        const response = await fetch(`/users/update-role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: parseInt(userId),
                newRoleId: parseInt(selectedRoleId)
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`❌ Failed to update role: ${errorData.error || 'Unknown error'}`);
        }

        alert(`✅ ${fullName} has been added to this role.`);
        location.reload();
    } catch (error) {
        console.error('Add User Error:', error);
        alert(error.message);
    }
});    
    // Add click event to create role button
    if (createRoleButton) {
        createRoleButton.addEventListener('click', function() {
            createRoleModal.style.display = 'flex';
        });
    }
    
    // Close modals when clicking close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            modal.style.display = 'none';
        });
    });
    
    // Close modals when clicking cancel buttons
    cancelButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            modal.style.display = 'none';
        });
    });
    
    // Close modals when clicking close modal buttons
    closeModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            modal.style.display = 'none';
        });
    });
    
    // Close modals when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-overlay')) {
            event.target.style.display = 'none';
        }
    });
    
    // Handle role creation form submission
    const createRoleForm = document.getElementById('create-role-form');
    if (createRoleForm) {
        createRoleForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const roleName = document.getElementById('role-name').value.trim();
            if (!roleName) {
                // Show error message
                document.getElementById('role-name-error').style.display = 'block';
                return;
            }
            
            // Submit the form to the server
            fetch('/roles/client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ roleName })
            })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Network response was not ok');
            })
            .then(data => {
                alert('Client role created successfully!');

                // Reset form
                createRoleForm.reset();

                window.location.href = '/control-panel/roles';
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error creating user. Please try again.');
            });

            // Close modal
            createRoleModal.style.display = 'none';
            
            // Reset form
            createRoleForm.reset();
            document.getElementById('role-name-error').style.display = 'none';
        });
    }
    // Handle Edit Button
    document.querySelectorAll(".tb-button-action.edit").forEach(button => {
        button.addEventListener("click", async () => {
            const roleId = button.dataset.roleId;
            const oldName = button.dataset.roleName;

            const newName = prompt(`Edit Role Name for ${oldName}:`, oldName);
            if (newName && newName !== oldName) {
                try {
                    const res = await fetch(`/update-role-name/${roleId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ newName })
                    });

                    if (!res.ok) throw new Error("Failed to update role name.");

                    alert("Role name updated!");
                    location.reload();
                } catch (err) {
                    console.error(err);
                    alert("Error updating role name.");
                }
            }
        });
    });

    // Handle Delete Button
    document.querySelectorAll(".tb-button-action.delete").forEach(button => {
        button.addEventListener("click", async () => {
            const roleId = button.dataset.roleId;

            const confirmed = confirm(`Are you sure you want to delete Role ID ${roleId}?`);
            if (confirmed) {
                try {
                    const res = await fetch(`/delete-role/${roleId}`, {
                        method: "DELETE"
                    });

                    if (!res.ok) throw new Error("Failed to delete role.");

                    alert("Role deleted successfully.");
                    location.reload();
                } catch (err) {
                    console.error(err);
                    alert("Error deleting role.");
                }
            }
        });
    });
    // Handle search in user management modal
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const userRows = document.querySelectorAll('.user-row');
            
            userRows.forEach(row => {
                const userName = row.querySelector('.user-name').textContent.toLowerCase();
                const userEmail = row.querySelector('.user-email').textContent.toLowerCase();
                
                if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
                    row.style.display = 'table-row';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // Display users of a certain role
    function showUsersOfRole(usersOfRole) {
        console.log(usersOfRole)

        // Initialize HTML
        let output = ""

        // Check if usersOfRole has contents
        if(usersOfRole.length > 0) {
            // For each row of data, display HTML table row
            usersOfRole.forEach((user) => {
                output += `
                    <tr class="user-row">
                        <td>${user.user_id}</td>
                        <td class="user-name">${user.lastname.toUpperCase()}, ${user.firstname}</td>
                        <td class="user-email">${user.email}</td>
                        <td>
                            <button class="remove-btn">Remove</button>
                        </td>
                    </tr>
            `})
        } else {
            output += `<td colspan='4'><i>No users assigned to this role.</i></td>`
        }

        // Paste HTML output on users of role table
        tblUsersOfRole.innerHTML = output;

// Add event listeners to remove buttons
const removeButtons = document.querySelectorAll('.remove-btn');
removeButtons.forEach((btn, index) => {
    const user = usersOfRole[index];
    btn.addEventListener('click', () => {
        const confirmed = confirm(`Are you sure you want to remove ${user.firstname} ${user.lastname} from this role?`);
        if (!confirmed) return;

        fetch(`/users/remove-role/${user.user_id}`, {
            method: 'PUT'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to remove user');

            // Show success message
            alert(`${user.firstname} ${user.lastname} has been removed from this role.`);

            // Refresh the page
            location.reload();
        })
        .catch(err => {
            console.error(err);
            alert('Failed to remove user from role');
        });
    });
});

//     document.querySelectorAll('.manage-users-btn').forEach(btn => {
//     btn.addEventListener('click', async () => {
//         const roleId = btn.dataset.roleId;
//         const roleName = btn.dataset.roleName;

//         try {
//             const res = await fetch(`/get-users-by-role/${roleId}`);
//             const users = await res.json();

//             const modalBody = document.querySelector('#modal-body');
//             modalBody.innerHTML = `
//                 <h2>Users in role: ${roleName}</h2>
//                 <ul>
//                     ${users.map(user => `<li>${user.full_name} (${user.username})</li>`).join('')}
//                 </ul>
//             `;

//             openModal(); // Your function to open modal
//         } catch (err) {
//             console.error('Error loading users:', err);
//             alert('Failed to load users for this role.');
//         }
//     });
// });

    }

  if (createCompanyRoleButton) {
    createCompanyRoleButton.addEventListener('click', () => {
      createCompanyRoleModal.style.display = 'flex';
    });
  }

  // Close modal when clicking cancel or close
  document.querySelectorAll('#create-company-role-modal .close-btn, #create-company-role-modal .cancel-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        createCompanyRoleModal.style.display = 'none';
      });
    });

  // Handle form submit
  if (createCompanyRoleForm) {
    createCompanyRoleForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const roleName = document.getElementById('company-role-name').value.trim();
      const supertype = document.getElementById('company-role-type').value;

      if (!roleName) {
        document.getElementById('company-role-name-error').style.display = 'block';
        return;
      }

      try {
        const res = await fetch('/roles/company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleName, supertype })
        });

        if (!res.ok) throw new Error('Failed to create role');

        alert(`✅ ${supertype === "0" ? "Admin" : "Staff"} role created successfully!`);
        window.location.href = '/control-panel/roles';
      } catch (err) {
        console.error(err);
        alert('❌ Error creating company role.');
      }

      createCompanyRoleForm.reset();
      createCompanyRoleModal.style.display = 'none';
      document.getElementById('company-role-name-error').style.display = 'none';
    });
  }
});