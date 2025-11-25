document.addEventListener('DOMContentLoaded', () => {
  // Mark as read
  document.querySelectorAll('.mark-read-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const notifId = button.dataset.notifId;
      const isCurrentlyRead = button.dataset.isRead === 'true';
      const newIsRead = !isCurrentlyRead;

      try {
        const res = await fetch(`/notifications/toggle/${notifId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: newIsRead })
        });

        if (!res.ok) throw new Error('Failed to toggle');

        button.dataset.isRead = String(newIsRead);
        button.innerHTML = newIsRead ? '<i class="fa-solid fa-envelope"></i> Mark as Unread' : '<i class="fa-solid fa-envelope-open"></i> Mark as Read';

        const item = button.closest('.notif-item');
        if (item) item.classList.toggle('unread', !newIsRead);

        // Toggle unread circle icon
        const typeHeading = item.querySelector('.notif-type');
        if (typeHeading) {
          const circle = typeHeading.querySelector('.unread-circle');

          if (!newIsRead) {
            // If unread, ensure icon exists
            if (!circle) {
              const icon = document.createElement('i');
              icon.className = 'fa-solid fa-circle unread-circle';
              typeHeading.prepend(icon);
              typeHeading.insertAdjacentText('afterbegin', '\u00A0'); // add a small space
            }
          } else {
            // If read, remove icon
            if (circle) circle.remove();
          }
        }

        // Update unread badge count
        updateNotifCount();

      } catch (err) {
        console.error('Toggle error:', err);
        alert('Something went wrong.');
      }
    });
  });

  // Link button 'read' setting
  const linkButtons = document.querySelectorAll('.link-btn');

  linkButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const notifId = button.dataset.notifId;
      const isRead = button.dataset.isRead === 'true';
      const target = button.dataset.targetLink;

      if (!isRead) {
        // Mark as read first
        try {
          await fetch(`/notifications/read/${notifId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isRead: true })
          });

          // Optional: update badge count locally
          const item = button.closest('.notif-item');
          if (item) item.classList.remove('unread');

          const badge = document.getElementById('notif-badge');
          if (badge) {
            let newCount = document.querySelectorAll('.notif-item.unread').length;
            if (newCount > 0) {
              badge.textContent = newCount;
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }

        } catch (err) {
          console.error('Failed to mark notification as read:', err);
        }
      }

      // Navigate regardless
      window.location.href = target;
    });
  });

  // Delete notif button
  const deleteButtons = document.querySelectorAll('.delete-notif-btn');
  console.log('Found delete buttons:', deleteButtons.length); // Debug line

  deleteButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const notifItem = btn.closest('.notif-item');
      const mainContent = notifItem.querySelector('.notif-main-content');
      const confirmBox = notifItem.querySelector('.notif-delete-confirm');

      mainContent.classList.add('hidden');
      confirmBox.classList.remove('hidden');
    });
  });

  // Cancel delete
  document.querySelectorAll('.cancel-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const notifItem = btn.closest('.notif-item');
      notifItem.querySelector('.notif-main-content').classList.remove('hidden');
      notifItem.querySelector('.notif-delete-confirm').classList.add('hidden');
    });
  });

  // AJAX delete submit
  document.querySelectorAll('.delete-notif-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const notifItem = form.closest('.notif-item');
      const notifId = notifItem.dataset.notifId;

      try {
        const res = await fetch(`/notifications/delete/${notifId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          notifItem.remove();

          // Update badge
          updateNotifCount();

          // Show empty message if all gone
          const list = document.querySelector('.notif-list');
          if (list && list.children.length === 0) {
            list.outerHTML = `<p class="notif-empty">You have no status updates.</p>`;
          }
        }
      } catch (err) {
        console.error('Error deleting notification:', err);
      }
    });
  });

  // Notification bulk actions
  const toggleSelectBtn = document.getElementById('toggle-select-btn');
  const bulkActions = document.getElementById('bulk-actions');
  const toggleReadBtn = document.getElementById('toggle-read-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');

  let allSelected = false;
  let allRead = false;

  function getSelectedItems() {
    return document.querySelectorAll('.notif-item.selected');
  }

  function getSelectedIds() {
    return Array.from(getSelectedItems()).map(item => item.dataset.notifId);
  }

  function getAllNotifItems() {
    return document.querySelectorAll('.notif-item'); // always fresh
  }

  // Event delegation: handle click-to-select for any current or future .notif-item
  const notifList = document.querySelector('.notif-list');
  if (notifList) {
    notifList.addEventListener('click', (e) => {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      // ignore clicks on buttons inside the item
      if (e.target.closest('button')) return;

      item.classList.toggle('selected');
      updateUI();
    });
  }

  function updateUI() {
    const selectedItems = getSelectedItems();
    const selectedCount = selectedItems.length;
    const totalCount = getAllNotifItems().length;

    // Toggle Select/Deselect button
    if (selectedCount > 0) {
      toggleSelectBtn.innerHTML = '<i class="fa-solid fa-square-xmark"></i> Deselect';
      allSelected = selectedCount === totalCount; // true if actually all
    } else {
      toggleSelectBtn.innerHTML = '<i class="fa-solid fa-square-check"></i> Select All';
      allSelected = false;
    }

    // Show bulk actions when ANY are selected
    if (selectedCount > 0) {
      bulkActions.classList.remove('hidden');

      // Determine if all selected are read
      const allRead = Array.from(selectedItems).every(item => !item.classList.contains('unread'));

      // Update toggleReadBtn label accordingly
      toggleReadBtn.innerHTML = allRead
        ? '<i class="fa-solid fa-envelope"></i> Mark as Unread'
        : '<i class="fa-solid fa-envelope-open"></i> Mark as Read';
    } else {
      bulkActions.classList.add('hidden');
    }
  }

  // Update notification count badge dynamically
  async function updateNotifCount() {
    try {
      const res = await fetch('/notifications/update-count');
      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Failed to fetch count');

      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (data.total > 0) {
          badge.textContent = data.total;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error updating notification count:', err);
    }
  }

  // Toggle select all / deselect all
  toggleSelectBtn.addEventListener('click', () => {
    const notifItems = notifList.querySelectorAll('.notif-item');
    const selectedItems = getSelectedItems();
    const totalCount = notifItems.length;

    // If none are selected → select all
    // If some or all are selected → deselect all
    const shouldSelectAll = selectedItems.length === 0;

    notifItems.forEach(item => {
      if (shouldSelectAll) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    allSelected = shouldSelectAll;

    toggleSelectBtn.innerHTML = allSelected
      ? '<i class="fa-solid fa-square-xmark"></i> Deselect All'
      : '<i class="fa-solid fa-square-check"></i> Select All';

    updateUI();
  });

  // Toggle Mark Read / Unread (bulk)
  toggleReadBtn.addEventListener('click', async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return alert('No notifications selected.');

    // Check if ALL selected are currently read
    const allCurrentlyRead = ids.every(id => {
      const notif = document.querySelector(`.notif-item[data-notif-id="${id}"]`);
      return notif && !notif.classList.contains('unread');
    });

    // Decide the new state: if all are read, mark unread; otherwise mark read
    const newIsRead = !allCurrentlyRead;

    // Update button text before sending request
    toggleReadBtn.innerHTML = newIsRead
      ? '<i class="fa-solid fa-envelope"></i> Mark as Unread'
      : '<i class="fa-solid fa-envelope-open"></i> Mark as Read';

    try {
      // Send batch request
      const res = await fetch('/notifications/mark-read-batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, is_read: newIsRead })
      });

      if (!res.ok) throw new Error('Batch update failed');

      // Update each notif in the DOM
      ids.forEach(id => {
        const notif = document.querySelector(`.notif-item[data-notif-id="${id}"]`);
        if (!notif) return;

        // Toggle unread class
        notif.classList.toggle('unread', !newIsRead);

        // Toggle unread circle icon for bulk
        const typeHeading = notif.querySelector('.notif-type');
        if (typeHeading) {
          const circle = typeHeading.querySelector('.unread-circle');

          if (!newIsRead) {
            if (!circle) {
              const icon = document.createElement('i');
              icon.className = 'fa-solid fa-circle unread-circle';
              typeHeading.prepend(icon);
              typeHeading.insertAdjacentText('afterbegin', '\u00A0');
            }
          } else {
            if (circle) circle.remove();
          }
        }

        // Update individual button
        const btn = notif.querySelector('.mark-read-btn');
        if (btn) {
          btn.dataset.isRead = String(newIsRead);
          btn.innerHTML = newIsRead
            ? '<i class="fa-solid fa-envelope"></i> Mark as Unread'
            : '<i class="fa-solid fa-envelope-open"></i> Mark as Read';
        }
      });

      // Update unread badge
      updateNotifCount();

    } catch (err) {
      console.error(err);
      alert('Something went wrong while updating notifications.');
    }
  });

  // Delete selected (bulk)
  deleteSelectedBtn.addEventListener('click', () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return alert('No notifications selected.');

    const deleteModal = document.getElementById('delete-confirm-modal');
    const confirmYesBtn = document.getElementById('confirm-delete-yes');
    const confirmNoBtn = document.getElementById('confirm-delete-no');

    deleteModal.classList.remove('hidden');

    // Clone to remove old listeners
    const newYes = confirmYesBtn.cloneNode(true);
    const newNo = confirmNoBtn.cloneNode(true);
    confirmYesBtn.replaceWith(newYes);
    confirmNoBtn.replaceWith(newNo);

    newYes.addEventListener('click', async () => {
      try {
        const res = await fetch('/notifications/delete-batch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });

        if (!res.ok) throw new Error('Failed to delete notifications');

        // Remove from DOM
        ids.forEach(id => {
          const notif = document.querySelector(`.notif-item[data-notif-id="${id}"]`);
          if (notif) notif.remove();
        });

        // Reset UI
        allSelected = false;
        toggleSelectBtn.innerHTML = '<i class="fa-solid fa-square-check"></i> Select All';
        updateUI();

        // Update badge
        updateNotifCount();

        // Hide modal
        deleteModal.classList.add('hidden');

        // Show empty message if list is now empty
        const list = document.querySelector('.notif-list');
        if (list && list.children.length === 0) {
          list.outerHTML = `<p class="notif-empty">You have no status updates.</p>`;
        }

      } catch (err) {
        console.error(err);
        alert('Something went wrong while deleting notifications.');
      }
    });

    newNo.addEventListener('click', () => {
      deleteModal.classList.add('hidden');
    });
  });

});