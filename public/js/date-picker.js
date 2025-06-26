const dateStart = document.getElementById('date_start');
  const dateEnd = document.getElementById('date_end');

  // Helper: format today's date as YYYY-MM-DD
  function getToday() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Set today's date as max for both
  const todayStr = getToday();
  dateStart.max = todayStr;
  dateEnd.max = todayStr;

  // Update end date minimum when start date is chosen
  dateStart.addEventListener('change', () => {
    const startDate = dateStart.value;
    dateEnd.min = startDate;

    // If end date is before new start date, reset it
    if (dateEnd.value && dateEnd.value < startDate) {
      dateEnd.value = '';
    }
  });

  // Prevent manual entry of future dates
  [dateStart, dateEnd].forEach(input => {
    input.addEventListener('input', () => {
      if (input.value > todayStr) {
        input.value = todayStr;
      }
    });
  });