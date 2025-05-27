const categories = [
    "paper", "glass", "metal", "plastic",  "kitchen_waste",  
    "hazardous_waste", "electrical_waste", "organic", "inorganic",
];

const materialMap = {
    "paper": '1',
    "glass": '2',
    "metal": '3',
    "plastic": '4',
    "kitchen_waste": '5',
    "hazardous_waste": '6',
    "electrical_waste": '7',
    "organic": '8',
    "inorganic": '9',

};

document.addEventListener("DOMContentLoaded", function () {
    // Set date submitted to current date
    let today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    document.getElementById("date_submitted").value = today;

    // Waste form submission process begins with clicking submit
    document.getElementById("waste-form").addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!validateTotalPercentage()) {
            alert("Error: Total waste composition must equal 100%.");
            return;
        }

        const formData = new FormData(this);
        const jsonObject = Object.fromEntries(formData.entries());

        let wasteComposition = [];

        document.querySelectorAll(".waste-category").forEach(categoryDiv => {
            categoryDiv.querySelectorAll(".waste-entry").forEach(entry => {
                const material_name = categoryDiv.dataset.category;
                const material_id = materialMap[material_name] || null; // Convert category name to ID
                const subtype_remarks = entry.querySelector('input[name$="[name]"]').value.trim();
                const origin_id = entry.querySelector('select[name$="[origin]"]').value;
                const waste_amount = parseFloat(entry.querySelector('input[name$="[weight]"]').value) || 0;

                if (material_id && subtype_remarks && origin_id && waste_amount > 0) {
                    wasteComposition.push({ material_name, material_id, subtype_remarks, origin: origin_id, waste_amount });
                }
            });
        });

        jsonObject.wasteComposition = wasteComposition;

        try {
            const response = await fetch("/submit-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jsonObject)
            });

            const result = await response.json();
            if (response.ok) {
                alert("Report submitted successfully!");
            } else {
                alert(result.error || "Submission failed.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong.");
        }
    });

    
});


    
const container = document.getElementById("wasteComposition");
categories.forEach(category => {
    let categoryDiv = document.createElement("div");
    categoryDiv.className = "waste-category";
    categoryDiv.dataset.category = category;
    categoryDiv.innerHTML = `
        <label>${category.replace("_", " ").toUpperCase()}:</label>
        <div class="entries"></div>
        <button class="btn-approve" type="button" onclick="addEntry('${category}')">
            <i class="fa-solid fa-plus"></i> Add Entry
        </button>
    `;
    container.appendChild(categoryDiv);
});

// Validate before form submission
document.querySelector("form").addEventListener("submit", function (event) {
    if (!validateTotalPercentage()) {
        event.preventDefault(); // Prevent form submission
        alert("Error: Total waste composition must equal 100%.");
        return false;
    }
});


// Validate on input change
document.addEventListener("input", function (event) {
    if (event.target.classList.contains("weight-input")) {
        validateTotalPercentage();
    }
});


function addEntry(category) {
    let container = document.querySelector(`[data-category="${category}"] .entries`);
    let entryDiv = document.createElement("div");
    entryDiv.classList.add("waste-entry");

    entryDiv.innerHTML = `
        <input type="text" name="${category}[][name]" placeholder="Waste Type" required>
        <select name="${category}[][origin]" required>
        <option value="">Select Origin</option>
        <option value="1">Residential</option>
        <option value="2">Commercial</option>
        <option value="3">Institutional</option>
        <option value="4">Industrial</option>
        <option value="5">Health</option>
        <option value="6">Agricultural and Livestock</option>
        </select>
        <input type="number" name="${category}[][weight]" class="weight-input" min="0" step="0.001" placeholder="Weight % (wt)" required oninput="validateTotalPercentage()">
        <button class="btn-reject" type="button" onclick="removeEntry(this)">
            Remove <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    container.appendChild(entryDiv);
}

function removeEntry(button) {
    button.parentElement.remove();
    validateTotalPercentage();
}

function validateTotalPercentage() {
    let total = 0;
    document.querySelectorAll(".weight-input").forEach(input => {
        total += parseFloat(input.value) || 0;
    });

    let warning = document.getElementById("waste-warning");
    if (!warning) {
        warning = document.createElement("p");
        warning.id = "waste-warning";
        warning.style.color = "red";
        document.getElementById("wasteComposition").appendChild(warning);
    }

    if (Math.abs(total - 100) < 0.01) {
        warning.textContent = "";
        return true;
    } else {
        warning.textContent = `Total waste composition must be 100%. Current: ${total.toFixed(2)}%`;
        return false;
    }
}