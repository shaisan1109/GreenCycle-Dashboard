let form = document.forms[0]
let regionsDropdown = form.regions
let provincesDropdown = form.provinces
let municipalitiesDropdown = form.municipalities
let barangayDropdown = form.barangay

// Variables changing with selection
let jsonData

// Get PH locations json
fetch('/locations')
    .then(response => response.json())
    .then((data) => {
        jsonData = data
        getRegions(jsonData)

        console.log(data)

        // If prefill values exist, apply them
        const prefill = {
            region: form.dataset.prefillRegion,
            province: form.dataset.prefillProvince,
            municipality: form.dataset.prefillMunicipality
        };

        if (prefill.region) {
            // Select region
            regionsDropdown.value = prefill.region;
            regionsDropdown.dispatchEvent(new Event('change')); // Load provinces

            // Small timeout to wait for provinces to populate
            setTimeout(() => {
                if (prefill.province) {
                    provincesDropdown.value = prefill.province;
                    provincesDropdown.dispatchEvent(new Event('change')); // Load municipalities
                }

                setTimeout(() => {
                    if (prefill.municipality) {
                        municipalitiesDropdown.value = prefill.municipality;
                    }
                }, 100); // wait for municipalities to load
            }, 100); // wait for provinces to load
        }
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
    if(regionIndex.trim() === "" || regionsDropdown.disabled || regionIndex == 0) {
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
        cities = jsonData[0].cities
        municipalities = jsonData[0].municipalities // Because Pateros.

        cities.forEach((city, cityIndex) => {
            output += `<option value='${city.code}' index='${cityIndex}' munic-type='city'>${city.name}</option>`
        })

        municipalities.forEach((municipality, municIndex) => {
            output += `<option value='${municipality.code}' index='${municIndex}' munic-type='municipality'>${municipality.name}</option>`
        })

        municipalitiesDropdown.disabled = false
    } else if(provinceIndex.trim() === "" || regionIndex.trim() === "") {
        municipalitiesDropdown.disabled = true
        municipalitiesDropdown.selectedIndex = 0
        return false
    } else {
        cities = jsonData[regionIndex].provinces[provinceIndex].cities
        municipalities = jsonData[regionIndex].provinces[provinceIndex].municipalities

        cities.forEach((city, cityIndex) => {
            output += `<option value='${city.code}' index='${cityIndex}' munic-type='city'>${city.name}</option>`
        })

        municipalities.forEach((municipality, municIndex) => {
            output += `<option value='${municipality.code}' index='${municIndex}' munic-type='municipality'>${municipality.name}</option>`
        })

        municipalitiesDropdown.disabled = false
    }

    municipalitiesDropdown.innerHTML = output
}

// Listen for events on municipalities dropdown
municipalitiesDropdown.addEventListener('change', getBarangays)

function getBarangays() {
    // Index for json searching
    let regionIndex = regionsDropdown.options[regionsDropdown.selectedIndex].getAttribute('index')
    let provinceIndex = provincesDropdown.options[provincesDropdown.selectedIndex].getAttribute('index')
    let municIndex = municipalitiesDropdown.options[municipalitiesDropdown.selectedIndex].getAttribute('index')
    let municType = municipalitiesDropdown.options[municipalitiesDropdown.selectedIndex].getAttribute('munic-type')

    // Initialize barangays
    let barangays

    // Initialize html
    let output = ""
    output += "<option value='' index=''>Select a barangay</option>"
   
    // If no city/municipality is selected, disable this
    if(municIndex.trim() === "" || regionIndex.trim() === "" || municipalitiesDropdown.disabled) {
        barangayDropdown.disabled = true
        barangayDropdown.selectedIndex = 0
        return false
    } else {
        // If region is NCR
        if(regionIndex == 0) {
            if(municType == 'city') { // Cities
                if(municIndex == 5) // Manila (uses municipal districts instead)
                    barangays = jsonData[0].cities[municIndex].municipalDistricts
                else
                    barangays = jsonData[0].cities[municIndex].barangays
            }
            else { // Pateros
                barangays = jsonData[0].municipalities[municIndex].barangays
            }

            console.log(barangays)
        } else {
            if(municType == 'municipality')
                barangays = jsonData[regionIndex].provinces[provinceIndex].municipalities[municIndex].barangays
            else // city
                barangays = jsonData[regionIndex].provinces[provinceIndex].cities[municIndex].barangays
        }

        barangays.forEach((barangay, barangayIndex) => {
            output += `<option value='${barangay.code}' index='${barangayIndex}'>${barangay.name}</option>`
        })
        barangayDropdown.disabled = false
    }

    barangayDropdown.innerHTML = output
}
