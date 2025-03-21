/* LOCATIONS SEARCH
    The version of locations.js used in the search query for data display. */

let form = document.forms[0]
let regionsDropdown = form.regions
let provincesDropdown = form.provinces
let municipalitiesDropdown = form.municipalities
let locationCodeDisplay = form.locationcode

// Variables changing with selection
let jsonData

// Waste data display div
let divWasteData = document.getElementById('waste-data')

// Get PH locations json
fetch('/locations')
    .then(response => response.json())
    .then((data) => {
        jsonData = data
        getRegions(jsonData)
    })

// Get all regions upon loading
function getRegions(jsonData) {
    let output = ""
    output += "<option value='' index=''>Select a region</option>"

    jsonData.forEach((region, regionIndex) => {
        output += `<option value='${region.code}' index='${regionIndex}'>${region.name}</option>`
    })
    regionsDropdown.innerHTML = output
}

// Listen for events on region dropdown
regionsDropdown.addEventListener('change', getProvinces)

// Get provinces of a region (if not Metro Manila)
function getProvinces() {
    let regionIndex = regionsDropdown.options[regionsDropdown.selectedIndex].getAttribute('index')
    let provinces

    let output = ""
    output += "<option value='' index=''>Select a province</option>"
   
    // If no region is selected, disable this
    if(regionIndex.trim() === "" || regionIndex == "") {
        provincesDropdown.disabled = true
        provincesDropdown.selectedIndex = 0
        return false
    } else {
        provinces = jsonData[regionIndex].provinces

        provinces.forEach((province, provinceIndex) => {
            output += `<option value='${province.code}' index='${provinceIndex}'>${province.name}</option>`
        })
        provincesDropdown.disabled = false
    }

    provincesDropdown.innerHTML = output
}

// Listen for events on province dropdown (unless NCR)
provincesDropdown.addEventListener('change', getMunicipalities)
regionsDropdown.addEventListener('change', getMunicipalities)

// Get cities and municipalities of a province (if not Metro Manila)
// Get cities (if Metro Manila)
function getMunicipalities() {
    let regionIndex = regionsDropdown.options[regionsDropdown.selectedIndex].getAttribute('index')
    let provinceIndex = provincesDropdown.options[provincesDropdown.selectedIndex].getAttribute('index')
    let cities
    let municipalities

    let output = ""
    output += "<option value='' index=''>Select a city/municipality</option>"

    // Region is NCR
    if(regionIndex == 0) {
        cities = jsonData[regionIndex].cities
        municipalities = jsonData[regionIndex].municipalities

        cities.forEach((city) => {
            output += `<option value='${city.code}'>${city.name}</option>`
        })

        municipalities.forEach((municipality) => {
            output += `<option value='${municipality.code}'>${municipality.name}</option>`
        })

        municipalitiesDropdown.disabled = false
    } else if(provinceIndex.trim() === "" || regionIndex.trim() === "") {
        municipalitiesDropdown.disabled = true
        municipalitiesDropdown.selectedIndex = 0
        return false
    } else {
        cities = jsonData[regionIndex].provinces[provinceIndex].cities
        municipalities = jsonData[regionIndex].provinces[provinceIndex].municipalities

        cities.forEach((city) => {
            output += `<option value='${city.code}'>${city.name}</option>`
        })

        municipalities.forEach((municipality) => {
            output += `<option value='${municipality.code}'>${municipality.name}</option>`
        })

        municipalitiesDropdown.disabled = false
    }

    municipalitiesDropdown.innerHTML = output
}

// Update user's current location code
function updateLocation() {
    const region = regionsDropdown.value;
    const province = provincesDropdown.value;
    const city = municipalitiesDropdown.value;
 
    let setLocation = city || province || region || null;
 
    // Output the result for debugging
    locationCodeDisplay.value = setLocation
}
 
// Add event listeners to update `setLocation` when any dropdown changes
regionsDropdown.addEventListener("change", updateLocation);
provincesDropdown.addEventListener("change", updateLocation);
municipalitiesDropdown.addEventListener("change", updateLocation);

// Store waste data to display here
let wasteData

// When user submits location code, a query will be made to search for the matching waste data
form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Get location code submitted by user
    const locationCode = locationCodeDisplay.value
    
    // Fetch users with role ID from server
    fetch(`/api/waste-data/${locationCode}`)
        .then(response => response.json())
        .then((data) => {
            wasteData = data
            showWasteData(wasteData)
        })
})

// Display users of a certain role
function showWasteData(wasteData) {
    console.log(wasteData)

    // Initialize HTML
    let output = ""

    // Check if usersOfRole has contents
    if(wasteData.length > 0) {
        // Show number of results
        output += `<h1>Results: ${wasteData.length} entries</h1>`

        // For each row of data, display HTML table row
        wasteData.forEach((entry) => {
            // Format submission date
            var options = { year: 'numeric', month: 'long', day: 'numeric' };
            var date = new Date(entry.date_submitted)
            var formattedDate = date.toLocaleDateString("en-US", options); //  September 17, 2016

            output += `
                <a href='/dashboard/data/${entry.waste_gen_id}'>
                    <button class='waste-data-btn'>
                        <h1>Entry #${entry.waste_gen_id}</h1>
                        <i>Submitted on ${formattedDate}</i>
                        
                        <p><b>Submitted by:</b> ${entry.name}</p>
                    </button>
                </a>
        `})
    } else {
        output += `No data currently exists for this location.`
    }

    // Paste HTML output on waste data div
    divWasteData.innerHTML = output
}