document.addEventListener('DOMContentLoaded', () => {
  // Mark as read
  document.querySelectorAll('.mark-read-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const notifId = button.dataset.notifId;
      const isCurrentlyRead = button.dataset.isRead === 'true';
      const newIsRead = !isCurrentlyRead;

      console.log('Toggling notif:', notifId, 'New status:', newIsRead);

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

        // Update unread badge count
        const unreadCount = document.querySelectorAll('.notif-item.unread').length;
        const badge = document.getElementById('notif-badge');

        if (badge) {
          if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }

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
          const unreadCount = document.querySelectorAll('.notif-item.unread').length;
          const badge = document.querySelector('.notif-badge');
          if (badge) {
            if (unreadCount > 0) {
              badge.textContent = unreadCount;
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }

          // Show empty message if all gone
          const list = document.querySelector('.notif-list');
          if (list && list.children.length === 0) {
            list.outerHTML = `<p class="notif-empty">You have no notifications.</p>`;
          }
        }
      } catch (err) {
        console.error('Error deleting notification:', err);
      }
    });
  });
});