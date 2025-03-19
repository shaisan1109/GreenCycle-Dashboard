document.addEventListener("DOMContentLoaded", function () {
    const wasteCategories = {
        generation: {
            "Waste per Capita": ["Waste per Capita"],
            "Annual Waste Generation": ["Annual Waste Generation"]
        },
        composition: {
            "Origin of Waste": ["Residential", "Commercial", "Institutional", "Industrial", "Health", "Livestock"],
            "Waste Category": ["Paper", "Plastic", "Glass", "Metal", "Kitchen Waste", "Organic", "Non-Organic", "Hazardous Waste", "Electrical Waste", "Wood", "Textiles", "Rubber", "Others"]
        }
    };

    const mapBounds = [[4.5, 116.0], [21.0, 127.0]];
    const map = L.map('map', {
        maxBounds: mapBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 5,
        maxZoom: 20
    }).setView([12.8797, 121.7740], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    
        const regionData = {
        waste_per_capita: [{ coords: [14.5995, 120.9842], value: 0.1, name: "Manila" , year: 2019 }],
        annual_waste_generation: [{ coords: [14.6760, 121.0437], value: 0.1, name: "Quezon City", year: 2020 }],
        residential: [{ coords: [14.5387, 121.1595], value: 0.3, name: "Rizal" , year: 2020},
        { coords: [14.6603, 120.9567], value: 0.4, name: "Malabon", year: 2020 },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" , year: 2020},
        { coords: [8.4542, 124.6319], value: 0.5, name: "Cagayan De Oro" , year: 2020},
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna", year: 2020 },
        { coords: [13.7565, 121.0583], value: 0.75, name: "Batangas", year: 2020 },
        { coords: [8.9490, 125.5283], value: 0.1, name: "Butuan" , year: 2020},
        { coords: [18.1667, 120.7500], value: 0.25, name: "Ilocos Norte", year: 2020 },
        { coords: [14.6781, 120.5113], value: 0.15, name: "Bataan" , year: 2020},
        { coords: [10.6765, 122.9509], value: 0.35, name: "Bacolod", year: 2020 },
        { coords: [14.6760, 121.0437], value: 0.4, name: "Quezon City" , year: 2020},
        { coords: [14.6760, 121.0437], value: 0.4, name: "Quezon City" , year: 2019}
    ],
        commercial: [{ coords: [14.6781, 120.5113], value: 0.15, name: "Bataan" , year: 2020}],
        institutional: [{ coords: [10.3157, 123.8854], value: 0.6, name: "Cebu City", year: 2020 }],
        industrial: [{ coords: [14.5243, 121.0014], value: 0.8, name: "Makati" , year: 2020}],
        health: [{ coords: [8.4772, 124.6471], value: 0.4, name: "Cagayan de Oro" , year: 2020}],
        livestock: [{ coords: [6.9214, 122.0790], value: 0.3, name: "Zamboanga City" , year: 2020}],
        paper: [
        { coords: [14.5387, 121.1595], value: 0.3, name: "Rizal" , year: 2020},
        { coords: [14.6603, 120.9567], value: 0.4, name: "Malabon", year: 2020 },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" , year: 2020},
        { coords: [8.4542, 124.6319], value: 0.5, name: "Cagayan De Oro" , year: 2020},
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna", year: 2020 },
        { coords: [13.7565, 121.0583], value: 0.75, name: "Batangas", year: 2020 },
        { coords: [8.9490, 125.5283], value: 0.1, name: "Butuan" , year: 2020},
        { coords: [18.1667, 120.7500], value: 0.25, name: "Ilocos Norte", year: 2020 },
        { coords: [14.6781, 120.5113], value: 0.15, name: "Bataan" , year: 2020},
        { coords: [10.6765, 122.9509], value: 0.35, name: "Bacolod", year: 2020 },
        { coords: [14.6760, 121.0437], value: 0.4, name: "Quezon City" , year: 2020},
        { coords: [14.6760, 121.0437], value: 0.4, name: "Quezon City" , year: 2019}
    ],

    plastic: [
        { coords: [14.5387, 121.1595], value: 0.7, name: "Rizal" , year: 2019},
        { coords: [14.6603, 120.9567], value: 0.5, name: "Malabon" , year: 2019},
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" , year: 2019},
        { coords: [8.4542, 124.6319], value: 0.4, name: "Cagayan De Oro", year: 2019 },
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna" , year: 2019},
        { coords: [13.7565, 121.0583], value: 0.75, name: "Batangas" , year: 2019},
        { coords: [8.9490, 125.5283], value: 0.3, name: "Butuan", year: 2019 },
        { coords: [18.1667, 120.7500], value: 0.85, name: "Ilocos Norte" , year: 2019},
        { coords: [14.6781, 120.5113], value: 0.55, name: "Bataan" , year: 2019},
        { coords: [10.6765, 122.9509], value: 0.65, name: "Bacolod" , year: 2019},
        { coords: [14.6760, 121.0437], value: 0.9, name: "Quezon City" , year: 2019}
    ],
        glass: [{ coords: [7.1907, 125.4553], value: 0.5, name: "Davao City", year: 2020 }],
        metal: [{ coords: [16.4023, 120.5960], value: 0.3, name: "Baguio", year: 2020  }],
        kitchen_waste: [
        { coords: [14.5387, 121.1595], value: 0.3, name: "Rizal", year: 2020 },
        { coords: [14.6603, 120.9567], value: 0.8, name: "Malabon", year: 2020 },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay", year: 2020 },
        { coords: [8.4542, 124.6319], value: 0.4, name: "Cagayan De Oro", year: 2020 },
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna" , year: 2020},
        { coords: [13.7565, 121.0583], value: 0.25, name: "Batangas", year: 2020 },
        { coords: [8.9490, 125.5283], value: 0.3, name: "Butuan", year: 2020 },
        { coords: [18.1667, 120.7500], value: 0.25, name: "Ilocos Norte", year: 2020 },
        { coords: [14.6781, 120.5113], value: 0.55, name: "Bataan", year: 2020 },
        { coords: [10.6765, 122.9509], value: 0.75, name: "Bacolod", year: 2020 },
        { coords: [14.6760, 121.0437], value: 0.1, name: "Quezon City", year: 2020 }
    ]
    };

    function getGradientColor(value) {
        let r, g;
        if (value <= 0.39) {
            r = 255;
            g = Math.round(255 * (value / 0.39));
        } else if (value <= 0.69) {
            r = Math.round(255 * ((0.69 - value) / 0.31));
            g = 250;
        } else {
            r = 0;
            g = 255;
        }
        return `rgb(${r}, ${g}, 0)`;
    }

    let markers = [];

    function createMarkers() {
markers.forEach(marker => map.removeLayer(marker));
markers = [];

const selectedFilter = document.getElementById("color-filter").value.trim().toLowerCase();
const selectedCategory = document.getElementById("category-filter").value;
const selectedYear = document.getElementById("year-filter").value;

if (!selectedCategory || !regionData[selectedCategory]) {
    return;
}

regionData[selectedCategory].forEach(region => {
    const { name, coords, value, year } = region;
    const color = getGradientColor(value);

    let category = "";
    if (value <= 0.39) category = "red";
    else if (value <= 0.69) category = "yellow";
    else category = "green";

    const filterMatches = selectedFilter === "all" || selectedFilter === category;
    const yearMatches = selectedYear === "none" || selectedYear === year.toString();

    if (filterMatches && yearMatches) {
        let marker = L.circle(coords, {
            radius: 7500,
            color: color,
            fillColor: color,
            fillOpacity: 0.5
        }).addTo(map)
        .bindTooltip(
            `<strong>${name}</strong><br>Value: ${value.toFixed(2)}<br>Year: ${year}<br>Category: ${category.toUpperCase()}`,
            { permanent: false, direction: "top", className: "tooltip-box" }
        )
        .on('mouseover', function() { this.setStyle({ fillOpacity: 0.8 }); })
        .on('mouseout', function() { this.setStyle({ fillOpacity: 0.5 }); });

        markers.push(marker);
    }
});
}


function populateYearFilter() {
const yearDropdown = document.getElementById("year-filter");
yearDropdown.innerHTML = ""; // Clear existing options

const uniqueYears = new Set();

// Collect unique years
Object.values(regionData).flat().forEach(region => {
    if (region.year) uniqueYears.add(region.year);
});

// Convert to array, sort in descending order
const sortedYears = Array.from(uniqueYears).sort((a, b) => b - a);

// Append sorted years to dropdown
sortedYears.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearDropdown.appendChild(option);
});

yearDropdown.addEventListener("change", updateMarkersOnSelection);
}

populateYearFilter();

function updateMetricDropdown() {
const broadCategory = document.getElementById("broad-category-filter").value;
const metricDropdown = document.getElementById("metric-filter");
const categoryDropdown = document.getElementById("category-filter");

metricDropdown.innerHTML = "";
categoryDropdown.innerHTML = "";
categoryDropdown.disabled = true;

if (broadCategory === "generation") {
    metricDropdown.disabled = true;
    categoryDropdown.disabled = false;

    ["Waste per Capita", "Annual Waste Generation"].forEach(category => {
        const option = document.createElement("option");
        option.value = category.toLowerCase().replace(/\s+/g, "_");
        option.textContent = category;
        categoryDropdown.appendChild(option);
    });

} else if (broadCategory === "composition") {
    metricDropdown.disabled = false;

    Object.keys(wasteCategories[broadCategory]).forEach(metric => {
        const option = document.createElement("option");
        option.value = metric;
        option.textContent = metric;
        metricDropdown.appendChild(option);
    });

    updateCategoryDropdown();
}

// Automatically update markers when a broad category is selected
updateMarkersOnSelection();
}


function updateCategoryDropdown() {
const broadCategory = document.getElementById("broad-category-filter").value;
const metric = document.getElementById("metric-filter").value;
const categoryDropdown = document.getElementById("category-filter");

categoryDropdown.innerHTML = "";
categoryDropdown.disabled = true;

if (broadCategory === "composition" && wasteCategories[broadCategory][metric]) {
    categoryDropdown.disabled = false;
    wasteCategories[broadCategory][metric].forEach(subCategory => {
        const option = document.createElement("option");
        option.value = subCategory.toLowerCase().replace(/\s+/g, "_");
        option.textContent = subCategory;
        categoryDropdown.appendChild(option);
    });
    
}

// Automatically update markers when a category is selected
updateMarkersOnSelection();
}

function updateMarkersOnSelection() {
const broadCategory = document.getElementById("broad-category-filter").value;
const selectedCategory = document.getElementById("category-filter").value;

if (broadCategory === "none" || !selectedCategory) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    return;
}

createMarkers();
}

async function getCoordinates(location) {
const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ", Philippines")}`);
const data = await response.json();

if (data.length > 0) {
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
} else {
    console.warn(`Coordinates not found for: ${location}`);
    return null;
}
}

async function updateRegionData(regionData) {
for (let category in regionData) {
    for (let entry of regionData[category]) {
        if (!entry.coords || entry.coords.length === 0) {
            let coords = await getCoordinates(entry.name);
            if (coords) {
                entry.coords = coords;
            }
        }
    }
}
console.log(JSON.stringify(regionData, null, 2)); // Output updated data
}

// Run the update function
updateRegionData(regionData);


// Attach event listeners
document.getElementById("color-filter").addEventListener("change", createMarkers);
document.getElementById("broad-category-filter").addEventListener("change", updateMetricDropdown);
document.getElementById("metric-filter").addEventListener("change", updateCategoryDropdown);
document.getElementById("category-filter").addEventListener("change", updateMarkersOnSelection); 
});
