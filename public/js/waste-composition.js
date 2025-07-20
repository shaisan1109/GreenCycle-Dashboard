
document.addEventListener("DOMContentLoaded", function () {

    // Initialize variables
    const submissionForm = document.getElementById("waste-form")

    // Waste form submission process begins with clicking submit
    submissionForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData(this);
        const jsonObject = Object.fromEntries(formData.entries());

        // Push to waste composition array
        let wasteComposition = [];

        document.querySelectorAll(".waste-supertype").forEach(entryDiv => {
            entryDiv.querySelectorAll(".waste-entry").forEach(entry => {
                const sectorId = entry.getAttribute('sectorId');
                const typeId = entry.getAttribute('typeId');
                const amt = entry.value;

                wasteComposition.push({ sector_id: sectorId, type_id: typeId, waste_amount: amt });
            });
        });

        jsonObject.wasteComposition = wasteComposition;

        // Create a hidden input to hold the full JSON string
        let hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "jsonData";
        hiddenInput.value = JSON.stringify(jsonObject);

        // Append and submit
        submissionForm.appendChild(hiddenInput);
        submissionForm.submit(); // standard form POST to render confirmation page
    });

    
});