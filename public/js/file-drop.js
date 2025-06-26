  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('fileElem');
  const fileNameDisplay = document.getElementById('file-name-display');

  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
  });

  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
  });

  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      fileNameDisplay.textContent = `Selected file: ${files[0].name}`;
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileNameDisplay.textContent = `Selected file: ${fileInput.files[0].name}`;
    }
  });