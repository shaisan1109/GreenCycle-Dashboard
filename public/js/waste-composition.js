const categories = ["paper", "plastic", "metal", "kitchen_waste", "organic", "inorganic", "hazardous_waste", "electrical_waste", "wood", "textiles", "rubber"];

document.addEventListener("DOMContentLoaded", function() {
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
});

function addEntry(category) {
    let container = document.querySelector(`[data-category="${category}"] .entries`);
    let entryDiv = document.createElement('div');
    entryDiv.innerHTML = `
        <input type="text" name="${category}[][name]" placeholder="Waste Name" required>
        <input type="number" name="${category}[][weight]" placeholder="Weight (kg)" required>
        <button class="btn-reject" type="button" onclick="removeEntry(this)">
            Remove <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    container.appendChild(entryDiv);
}

function removeEntry(button) {
    button.parentElement.remove();
}
