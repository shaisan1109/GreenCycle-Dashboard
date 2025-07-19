let currentStep = 0;

const steps = document.querySelectorAll('.step');
const labels = document.querySelectorAll('.step-labels .label');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');

function showStep(index) {
  steps.forEach((step, i) => step.classList.toggle('active', i === index));
  labels.forEach((label, i) => label.classList.toggle('current', i === index));
  prevBtn.style.display = index === 0 ? 'none' : 'inline-block';
  nextBtn.style.display = index === steps.length - 1 ? 'none' : 'inline-block';
  submitBtn.style.display = index === steps.length - 1 ? 'inline-block' : 'none';
}

prevBtn.addEventListener('click', () => {
  if (currentStep > 0) currentStep--;
  showStep(currentStep);
});

nextBtn.addEventListener('click', () => {
  if (currentStep < steps.length - 1) currentStep++;
  showStep(currentStep);
});

showStep(currentStep);