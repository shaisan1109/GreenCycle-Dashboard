document.addEventListener("DOMContentLoaded", () => {

let form2 = document.getElementById("upload-entry-form");
let regionsDropdown2 = document.getElementById("region-upload")
let provincesDropdown2 = document.getElementById("province-upload")
let municipalitiesDropdown2 = document.getElementById("municipality-upload")
let barangayDropdown2 = document.getElementById("barangay-upload")

// Variables changing with selection
let jsonData2

// Get PH locations json
fetch('/locations')
    .then(response => response.json())
    .then((data) => {
        jsonData2 = data
        getRegions(jsonData2)

        // If prefill values exist, apply them
        const prefill = {
            region: form2.dataset.prefillRegion,
            province: form2.dataset.prefillProvince,
            municipality: form2.dataset.prefillMunicipality,
            barangay: form2.dataset.prefillBarangay
        };

        if (prefill.region) {
            // Select region
            regionsDropdown2.value = prefill.region;
            regionsDropdown2.dispatchEvent(new Event('change')); // Load provinces

            // Small timeout to wait for provinces to populate
            setTimeout(() => {
                if (prefill.province) {
                    provincesDropdown2.value = prefill.province;
                    provincesDropdown2.dispatchEvent(new Event('change')); // Load municipalities
                }

                setTimeout(() => {
                    if (prefill.municipality) {
                        municipalitiesDropdown2.value = prefill.municipality;
                        municipalitiesDropdown2.dispatchEvent(new Event('change')); // Load barangays

                        setTimeout(() => {
                            if (prefill.barangay) {
                                barangayDropdown2.value = prefill.barangay;
                            }
                        }, 100)
                    }
                }, 100); // wait for municipalities to load
            }, 100); // wait for provinces to load
        }
    })

// Get all regions upon loading
function getRegions(jsonData2) {
    let output = ""
    output += "<option value='' index=''>Select a region</option>"

    jsonData2.forEach((region, regionIndex) => {
        output += `<option value='${region.code}' index='${regionIndex}'>${region.name}</option>`
    })
    regionsDropdown2.innerHTML = output
}

// Listen for events on region dropdown
regionsDropdown2.addEventListener('change', getProvinces)

// Get provinces of a region (if not Metro Manila)
function getProvinces() {
    let regionIndex = regionsDropdown2.options[regionsDropdown2.selectedIndex].getAttribute('index')
    let provinces

    let output = ""
    output += "<option value='' index=''>Select a province</option>"
   
    // If no region is selected, disable this
    if(regionIndex.trim() === "" || regionsDropdown2.disabled || regionIndex == 0) {
        provincesDropdown2.disabled = true
        provincesDropdown2.selectedIndex = 0
        return false
    } else {
        provinces = jsonData2[regionIndex].provinces

        provinces.forEach((province, provinceIndex) => {
            output += `<option value='${province.code}' index='${provinceIndex}'>${province.name}</option>`
        })
        provincesDropdown2.disabled = false
    }

    provincesDropdown2.innerHTML = output
}

// Listen for events on province dropdown (unless NCR)
provincesDropdown2.addEventListener('change', getMunicipalities)
regionsDropdown2.addEventListener('change', getMunicipalities)

// Get cities and municipalities of a province (if not Metro Manila)
// Get cities (if Metro Manila)
function getMunicipalities() {
    let regionIndex = regionsDropdown2.options[regionsDropdown2.selectedIndex].getAttribute('index')
    let provinceIndex = provincesDropdown2.options[provincesDropdown2.selectedIndex].getAttribute('index')
    let cities
    let municipalities

    let output = ""
    output += "<option value='' index=''>Select a city/municipality</option>"

    // Region is NCR
    if(regionIndex == 0) {
        cities = jsonData2[0].cities
        municipalities = jsonData2[0].municipalities // Because Pateros.

        cities.forEach((city, cityIndex) => {
            output += `<option value='${city.code}' index='${cityIndex}' munic-type='city'>${city.name}</option>`
        })

        municipalities.forEach((municipality, municIndex) => {
            output += `<option value='${municipality.code}' index='${municIndex}' munic-type='municipality'>${municipality.name}</option>`
        })

        municipalitiesDropdown2.disabled = false
    } else if(provinceIndex.trim() === "" || regionIndex.trim() === "") {
        municipalitiesDropdown2.disabled = true
        municipalitiesDropdown2.selectedIndex = 0
        return false
    } else {
        cities = jsonData2[regionIndex].provinces[provinceIndex].cities
        municipalities = jsonData2[regionIndex].provinces[provinceIndex].municipalities

        cities.forEach((city, cityIndex) => {
            output += `<option value='${city.code}' index='${cityIndex}' munic-type='city'>${city.name}</option>`
        })

        municipalities.forEach((municipality, municIndex) => {
            output += `<option value='${municipality.code}' index='${municIndex}' munic-type='municipality'>${municipality.name}</option>`
        })

        municipalitiesDropdown2.disabled = false
    }

    municipalitiesDropdown2.innerHTML = output
}

// Listen for events on municipalities dropdown
municipalitiesDropdown2.addEventListener('change', getBarangays)

function getBarangays() {
    // Index for json searching
    let regionIndex = regionsDropdown2.options[regionsDropdown2.selectedIndex].getAttribute('index')
    let provinceIndex = provincesDropdown2.options[provincesDropdown2.selectedIndex].getAttribute('index')
    let municIndex = municipalitiesDropdown2.options[municipalitiesDropdown2.selectedIndex].getAttribute('index')
    let municType = municipalitiesDropdown2.options[municipalitiesDropdown2.selectedIndex].getAttribute('munic-type')

    // Initialize barangays
    let barangays

    // Initialize html
    let output = ""
    output += "<option value='' index=''>Select a barangay</option>"
   
    // If no city/municipality is selected, disable this
    if(municIndex.trim() === "" || regionIndex.trim() === "" || municipalitiesDropdown2.disabled) {
        barangayDropdown2.disabled = true
        barangayDropdown2.selectedIndex = 0
        return false
    } else {
        // If region is NCR
        if(regionIndex == 0) {
            if(municType == 'city') { // Cities
                if(municIndex == 5) // Manila (uses municipal districts instead)
                    barangays = jsonData2[0].cities[municIndex].municipalDistricts
                else
                    barangays = jsonData2[0].cities[municIndex].barangays
            }
            else { // Pateros
                barangays = jsonData2[0].municipalities[municIndex].barangays
            }

            console.log(barangays)
        } else {
            if(municType == 'municipality')
                barangays = jsonData2[regionIndex].provinces[provinceIndex].municipalities[municIndex].barangays
            else // city
                barangays = jsonData2[regionIndex].provinces[provinceIndex].cities[municIndex].barangays
        }

        barangays.forEach((barangay, barangayIndex) => {
            output += `<option value='${barangay.code}' index='${barangayIndex}'>${barangay.name}</option>`
        })
        barangayDropdown2.disabled = false
    }

    barangayDropdown2.innerHTML = output
}

});