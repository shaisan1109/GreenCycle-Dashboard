import Handlebars from 'handlebars'

/* ---------------------------------------
    HANDLEBARS HELPERS
--------------------------------------- */

// Render text to uppercase
Handlebars.registerHelper('uppercase', function(str) {
  return str.toUpperCase()
})

// Check if value is NOT null
/* Ex: 
    {{#check value null}}
      {{this}}
    {{/check}}
*/
Handlebars.registerHelper('check', function(value, comparator) {
  return (value === comparator) ? '-' : value
})

// Check if value is equal to something
Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this)
})

// Check if value is NOT equal to something
Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this)
})

// Show date in text form
// Ex: 25 Mar 2015
Handlebars.registerHelper('textDate', function(date) {
  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  
  return date.toLocaleDateString(undefined, options) 
})

// Show datetime in text form
Handlebars.registerHelper('textDateTime', function(date) {
  // Set date string
  const dateOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
  const dateString = date.toLocaleDateString(undefined, dateOptions)

  // Set time string
  const timeString = date.toLocaleTimeString("en-US")
  
  return `${dateString} ${timeString}` 
})

// Show number with commas and decimal point
Handlebars.registerHelper('commaNumber', function(num) {
  if (typeof num !== "number") {
    num = parseFloat(num);
  }

  if (isNaN(num)) return '';

  const [integerPart, decimalPart] = num.toFixed(3).split('.');

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
});

// Show integer with commas (for population)
Handlebars.registerHelper('commaInt', function(num) {
  if (typeof num !== "number") {
    num = parseFloat(num);
  }

  if (isNaN(num)) return '';

  const integerPart = Math.floor(num).toString();

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return formattedInteger;
});

// Return json object
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
})

// Default value fallback (e.g., 0)
Handlebars.registerHelper('default', (value, fallback) => value != null ? value : fallback);

// Add helper for data entry colspan
Handlebars.registerHelper('add', (a, b) => a + b);

Handlebars.registerHelper('subtract', (a, b) => a - b);

Handlebars.registerHelper('toFixed', function (value, digits) {
  return Number(value).toFixed(digits);
});

Handlebars.registerHelper('calcPercent', function (value, fullArray) {
  // Expect fullArray to be an array of objects: { value: number }
  let total = 0;

  if (Array.isArray(fullArray)) {
    total = fullArray.reduce((sum, item) => sum + parseFloat(item.value || 0), 0);
  }

  if (total === 0) return '0';
  
  const percent = (parseFloat(value) / total) * 100;
  return percent.toFixed(3).replace(/\.?0+$/, ''); // Trim trailing zeros
});

Handlebars.registerHelper('gt', function (a, b) {
  return Number(a) > Number(b);
});

Handlebars.registerHelper('lt', (a, b) => a < b);

Handlebars.registerHelper('paginationRange', (currentPage, totalPages) => {
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    let range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
});

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('queryString', function (query, overrides) {
  const merged = Object.assign({}, query, overrides.hash);

  const params = Object.entries(merged)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return params ? `?${params}` : '';
});

// Check if current route has query
Handlebars.registerHelper('hasQuery', function(query) {
  return Object.values(query).some(val => val);
});

// Concatenation
Handlebars.registerHelper('concat', function (a, b) {
  return `${a}-${b}`;
});