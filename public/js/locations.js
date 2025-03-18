let form = document.forms[0]
let regionsDropdown = form.regions
let provincesDropdown = form.provinces
let municipalitiesDropdown = form.municipalities

// Variables changing with selection
let jsonData

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
    output += "<option value=''>Select a region</option>"

    jsonData.forEach((region, regionIndex) => {
        output += `<option value='${regionIndex}'>${region.name}</option>`
    })
    regionsDropdown.innerHTML = output
}

// Listen for events on region dropdown
regionsDropdown.addEventListener('change', getProvinces)

// Get provinces of a region (if not Metro Manila)
function getProvinces() {
    let regionIndex = regionsDropdown.value
    let provinces

    let output = ""
    output += "<option value=''>Select a province</option>"
    
    // If no region is selected, disable this
    if(regionIndex.trim() === "" || regionIndex == 0) {
        provincesDropdown.disabled = true
        provincesDropdown.selectedIndex = 0
        return false
    } else {
        provinces = jsonData[regionIndex].provinces

        provinces.forEach((province, provinceIndex) => {
            output += `<option value='${provinceIndex}'>${province.name}</option>`
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
    let regionIndex = regionsDropdown.value
    let provinceIndex = provincesDropdown.value
    let cities
    let municipalities

    let output = ""
    output += "<option value=''>Select a city/municipality</option>"

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