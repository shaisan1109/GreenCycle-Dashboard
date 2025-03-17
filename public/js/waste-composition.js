const categories = ["paper", "plastic", "metal", "kitchen_waste", "organic", "inorganic", "hazardous_waste", "electrical_waste", "wood", "textiles", "rubber"];

document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("waste-composition");
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
        }
    });
});

function addEntry(category) {
    let container = document.querySelector(`[data-category="${category}"] .entries`);
    let entryDiv = document.createElement("div");
    entryDiv.classList.add("waste-entry");

    entryDiv.innerHTML = `
        <input type="text" name="${category}[][name]" placeholder="Waste Type" required>
        
        <select name="${category}[][origin]" required>
            <option value="">Select Origin</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Institution">Institution</option>
            <option value="Industrial">Industrial</option>
            <option value="Health">Health</option>
            <option value="Livestock">Livestock</option>
        </select>

        <input type="number" name="${category}[][weight]" class="weight-input" min="0" step="0.001" placeholder="Weight % (wt)" required oninput="validateTotalPercentage()">

        <button class="btn-reject" type="button" onclick="removeEntry(this)">
            Remove <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    
    container.appendChild(entryDiv);
}

// Remove entry
function removeEntry(button) {
    button.parentElement.remove();
    validateTotalPercentage(); // Revalidate after removal
}

// Validate that total weight percentage equals 100%
function validateTotalPercentage() {
    let total = 0;
    document.querySelectorAll(".weight-input").forEach(input => {
        total += parseFloat(input.value) || 0;
    });

    return total === 100;
}
