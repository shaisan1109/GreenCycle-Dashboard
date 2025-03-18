document.addEventListener('DOMContentLoaded', function() {
    // Get modal elements
    const userManagementModal = document.getElementById('user-management-modal');
    const createRoleModal = document.getElementById('create-role-modal');
    
    // Get buttons that open the modals
    const manageUserButtons = document.querySelectorAll('.manage-users-btn');
    const createRoleButton = document.getElementById('create-role-btn');
    
    // Get elements that close the modals
    const closeButtons = document.querySelectorAll('.close-btn');
    const cancelButtons = document.querySelectorAll('.cancel-btn');
    const closeModalButtons = document.querySelectorAll('.close-modal-btn');
    
    // Stores users of a certain role (Manage Users)
    let usersOfRole

    // Get users of role table
    const tblUsersOfRole = document.getElementById('users-table-body');

    // Add click event to all manage user buttons
    manageUserButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Get role info from data attributes
            const roleId = this.getAttribute('data-role-id');
            const roleName = this.getAttribute('data-role-name');
            
            // Set role name in modal title
            document.getElementById('modal-role-name').textContent = roleName;
            
            // Fetch users with role ID from server
            fetch(`/users/role/${roleId}`)
                .then(response => response.json())
                .then((data) => {
                    usersOfRole = data
                    //console.log(usersOfRole)
                    showUsersOfRole(usersOfRole)
                })

            // Show modal
            userManagementModal.style.display = 'flex';
        });
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

                window.location.href = '/dashboard/roles';
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
                            <button class="remove-btn">Remove from Role</button>
                        </td>
                    </tr>
            `})
        } else {
            output += `<td colspan='4'><i>No users assigned to this role.</i></td>`
        }

        // Paste HTML output on users of role table
        tblUsersOfRole.innerHTML = output
    }
});