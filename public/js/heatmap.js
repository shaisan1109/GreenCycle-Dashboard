document.addEventListener("DOMContentLoaded", function () {
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
        recycled: [
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

        biodegradable: [
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
        nonbiodegradable: [
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
        const regions = regionData[selectedCategory];

        regions.forEach(region => {
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
                }).addTo(map).bindTooltip(`${name}: ${value.toFixed(2)}`, { permanent: false });

                markers.push(marker);
            }
        });
    }

    document.getElementById("color-filter").addEventListener("change", createMarkers);
    document.getElementById("category-filter").addEventListener("change", createMarkers);

    createMarkers();
});
