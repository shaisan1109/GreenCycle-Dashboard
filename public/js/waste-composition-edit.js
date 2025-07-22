
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
                // Get type attributes
                const sectorId = entry.getAttribute('sectorId')
                const typeId = entry.getAttribute('typeId')
                const amt = entry.value

                wasteComposition.push({ sector_id: sectorId, type_id: typeId, waste_amount: amt })
            });
        });

        jsonObject.wasteComposition = wasteComposition;

        try {
            const response = await fetch("/api/data/edit-report", {
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