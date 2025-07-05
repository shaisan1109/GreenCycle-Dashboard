/* LOCATIONS SEARCH
    The version of locations.js used in the search query for data display. */

let form = document.forms[0]
let regionsDropdown = form.regions
let provincesDropdown = form.provinces
let municipalitiesDropdown = form.municipalities

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

 /*
 
// Update user's current location code
function updateLocation() {
    const region = regionsDropdown.value;
    const province = provincesDropdown.value;
    const city = municipalitiesDropdown.value;
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

    // Get initial codes
    const region = regionsDropdown.value
    const province = provincesDropdown.value
    const municipality = municipalitiesDropdown.value
    
    // Params to add on address
    const params = new URLSearchParams()

    // Add location codes to params
    if (region) params.append('region', region);
    if (province) params.append('province', province);
    if (municipality) params.append('municipality', municipality)
})

*/