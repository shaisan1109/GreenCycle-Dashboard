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
        waste_per_capita: [{ coords: [14.5995, 120.9842], value: 0.1, name: "Manila" }],
        annual_waste_generation: [{ coords: [14.6760, 121.0437], value: 0.1, name: "Quezon City" }],
        residential: [{ coords:  [14.5387, 121.1595], value: 0.33333, name: "Rizal" }],
        commercial: [{ coords: [14.6781, 120.5113], value: 0.15, name: "Bataan" }],
        institutional: [{ coords: [10.3157, 123.8854], value: 0.6, name: "Cebu City" }],
        industrial: [{ coords: [14.5243, 121.0014], value: 0.8, name: "Makati" }],
        health: [{ coords: [8.4772, 124.6471], value: 0.4, name: "Cagayan de Oro" }],
        livestock: [{ coords: [6.9214, 122.0790], value: 0.3, name: "Zamboanga City" }],
        paper: [
        { coords: [14.5387, 121.1595], value: 0.3, name: "Rizal" },
        { coords: [14.6603, 120.9567], value: 0.4, name: "Malabon" },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" },
        { coords: [8.4542, 124.6319], value: 0.5, name: "Cagayan De Oro" },
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna" },
        { coords: [13.7565, 121.0583], value: 0.75, name: "Batangas" },
        { coords: [8.9490, 125.5283], value: 0.1, name: "Butuan" },
        { coords: [18.1667, 120.7500], value: 0.25, name: "Ilocos Norte" },
        { coords: [14.6781, 120.5113], value: 0.15, name: "Bataan" },
        { coords: [10.6765, 122.9509], value: 0.35, name: "Bacolod" },
        { coords: [14.6760, 121.0437], value: 0.4, name: "Quezon City" }
    ],

    plastic: [
        { coords: [14.5387, 121.1595], value: 0.7, name: "Rizal" },
        { coords: [14.6603, 120.9567], value: 0.5, name: "Malabon" },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" },
        { coords: [8.4542, 124.6319], value: 0.4, name: "Cagayan De Oro" },
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna" },
        { coords: [13.7565, 121.0583], value: 0.75, name: "Batangas" },
        { coords: [8.9490, 125.5283], value: 0.3, name: "Butuan" },
        { coords: [18.1667, 120.7500], value: 0.85, name: "Ilocos Norte" },
        { coords: [14.6781, 120.5113], value: 0.55, name: "Bataan" },
        { coords: [10.6765, 122.9509], value: 0.65, name: "Bacolod" },
        { coords: [14.6760, 121.0437], value: 0.9, name: "Quezon City" }
    ],
        glass: [{ coords: [7.1907, 125.4553], value: 0.5, name: "Davao City" }],
        metal: [{ coords: [16.4023, 120.5960], value: 0.3, name: "Baguio" }],
        kitchen_waste: [
        { coords: [14.5387, 121.1595], value: 0.3, name: "Rizal" },
        { coords: [14.6603, 120.9567], value: 0.8, name: "Malabon" },
        { coords: [11.9674, 121.9250], value: 0.8, name: "Boracay" },
        { coords: [8.4542, 124.6319], value: 0.4, name: "Cagayan De Oro" },
        { coords: [14.2785, 121.4165], value: 0.6, name: "Laguna" },
        { coords: [13.7565, 121.0583], value: 0.25, name: "Batangas" },
        { coords: [8.9490, 125.5283], value: 0.3, name: "Butuan" },
        { coords: [18.1667, 120.7500], value: 0.25, name: "Ilocos Norte" },
        { coords: [14.6781, 120.5113], value: 0.55, name: "Bataan" },
        { coords: [10.6765, 122.9509], value: 0.75, name: "Bacolod" },
        { coords: [14.6760, 121.0437], value: 0.1, name: "Quezon City" }
    ]
    };

    function getGradientColor(value) {
        let r, g;
        if (value <= 0.4) {
            r = 255;
            g = Math.round(255 * (value / 0.4));
        } else if (value <= 0.7) {
            r = Math.round(255 * ((0.7 - value) / 0.3));
            g = 255;
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

const selectedFilter = document.getElementById("color-filter").value;
const selectedCategory = document.getElementById("category-filter").value;


regionData[selectedCategory].forEach(region => {
    const { name, coords, value } = region;
    const color = getGradientColor(value);

    let category;
    if (value <= 0.4) category = "red";
    else if (value <= 0.7) category = "yellow";
    else category = "green";

    if (selectedFilter === "all" || selectedFilter === category) {
        let marker = L.circle(coords, {
            radius: 7500,
            color: color,
            fillColor: color,
            fillOpacity: 0.5
        }).addTo(map)
        .bindTooltip(
            `<strong>${name}</strong><br>Value: ${value.toFixed(2)}<br>Color: ${category.toUpperCase()}`, 
            { permanent: false, direction: "top", className: "tooltip-box" }
        )
        .on('mouseover', function() { this.setStyle({ fillOpacity: 0.8 }); })
        .on('mouseout', function() { this.setStyle({ fillOpacity: 0.5 }); });

        markers.push(marker);
    }
});
}


function updateMetricDropdown() {
const broadCategory = document.getElementById("broad-category-filter").value;
const metricDropdown = document.getElementById("metric-filter");
const categoryDropdown = document.getElementById("category-filter");

metricDropdown.innerHTML = "";
categoryDropdown.innerHTML = "";
categoryDropdown.disabled = true; // Disable category filter by default

if (broadCategory === "generation") {
    metricDropdown.disabled = true; // Lock metric filter
    categoryDropdown.disabled = false; // Unlock category filter

    // Populate category filter with "Waste per Capita" and "Annual Waste Generation"
    ["Waste per Capita", "Annual Waste Generation"].forEach(category => {
        const option = document.createElement("option");
        option.value = category.toLowerCase().replace(/\s+/g, "_");
        option.textContent = category;
        categoryDropdown.appendChild(option);
    });

} else if (broadCategory === "composition") {
    metricDropdown.disabled = false; // Unlock metric filter
    categoryDropdown.disabled = true; // Lock category until metric is selected

    // Populate metric filter
    Object.keys(wasteCategories[broadCategory]).forEach(metric => {
        const option = document.createElement("option");
        option.value = metric;
        option.textContent = metric;
        metricDropdown.appendChild(option);
    });

    updateCategoryDropdown(); // Ensure category dropdown updates
}
}

function updateCategoryDropdown() {
const broadCategory = document.getElementById("broad-category-filter").value;
const metric = document.getElementById("metric-filter").value;
const categoryDropdown = document.getElementById("category-filter");

categoryDropdown.innerHTML = "";
categoryDropdown.disabled = true; // Default to disabled

        if (broadCategory === "composition" && wasteCategories[broadCategory][metric]) {
            categoryDropdown.disabled = false; // Unlock category filter
            wasteCategories[broadCategory][metric].forEach(category => {
                const option = document.createElement("option");
                option.value = category.toLowerCase().replace(/\s+/g, "_");
                option.textContent = category;
                categoryDropdown.appendChild(option);
            });
        }
        createMarkers();
        }
    document.getElementById("broad-category-filter").addEventListener("change", updateMetricDropdown);
    document.getElementById("metric-filter").addEventListener("change", updateCategoryDropdown);      
    document.getElementById("category-filter").addEventListener("change", createMarkers); 
});
