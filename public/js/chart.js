const pieDiv = document.getElementById('summary-pie')
const paperDiv = document.getElementById('bar-paper')
const metalDiv = document.getElementById('bar-metal')

const testData = [
    { type: "Paper", composition: 17.33 },
    { type: "Glass", composition: 2.76 },
    { type: "Metal", composition: 1.86 },
    { type: "Plastic", composition: 18.79 },
    { type: "Inorganic", composition: 0.16 },
    { type: "Organic", composition: 4.38 },
    { type: "Food & Kitchen Waste", composition: 36.83 },
    { type: "Hazardous", composition: 0.57 },
    { type: "Other Waste", composition: 6.33 }
];

const testPaper = [
    { type: 'Newspaper', composition: 0.622 },
    { type: 'Cardboard/Paper Bags', composition: 2.042 },
    { type: 'Magazine', composition: 0.000 },
    { type: 'Office Papers/High Grade', composition: 1.387 },
    { type: 'Mixed', composition: 13.279 },
]

const testMetal = [
    { type: 'Tin Cans', composition: 1.343 },
    { type: 'Aluminum Cans', composition: 0.098 },
    { type: 'Steel/Metal Scrap', composition: 0.157 },
    { type: 'Other Ferrous', composition: 0.016 },
    { type: 'Other Non-Ferrous', composition: 0.251 }
]

// Do not delete - actual code to be used for final site
/* fetch('/test-chart.json')
    .then(function (response) {
        if(response.ok == true) {
            return response.json()
        }
    })
    .then(function (data) {
        console.log(data)
        createChart(data, 'pie')
    }) */

// Chart creation
new Chart(pieDiv, {
    type: 'pie',
    data: {
        labels: testData.map(row => row.type),
        datasets: [{
            label: 'Value',
            data: testData.map(row => row.composition),
            borderWidth: 0
        }]
    },
    options: {
        plugins: {
            legend: {
                display: true,
                position: 'left',
                align: 'start'
            },
            tooltip: {
                enabled: true
            }
        }
    }
})

new Chart(paperDiv, {
    type: 'bar',
    data: {
        labels: testPaper.map(row => row.type),
        datasets: [{
            label: 'Value',
            data: testPaper.map(row => row.composition),
            borderWidth: 0
        }]
    },
    options: {
        indexAxis: 'y',
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            }
        }
    }
})

new Chart(metalDiv, {
    type: 'bar',
    data: {
        labels: testMetal.map(row => row.type),
        datasets: [{
            label: 'Value',
            data: testMetal.map(row => row.composition),
            borderWidth: 0
        }]
    },
    options: {
        indexAxis: 'y',
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            }
        }
    }
})
