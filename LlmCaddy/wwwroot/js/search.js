document.getElementById('searchBtn').addEventListener('click', performSearch);
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const queryText = document.getElementById('searchInput').value;
    const resultsList = document.getElementById('resultsList');
        
    if (!queryText.trim()) return;
    resultsList.innerHTML = '<li class="list-group-item text-muted">Searching matches locally...</li>';
    try {
        const response = await fetch(`/Query/Search?text=${encodeURIComponent(queryText)}`);
        const matchedIds = await response.json();
        resultsList.innerHTML = '';
        if (matchedIds.length === 0) {
            resultsList.innerHTML = '<li class="list-group-item">No semantically similar queries found.</li>';
            return;
        }
        matchedIds.forEach(id => {
            const li = document.createElement('li');
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            li.innerHTML = `<span><strong>Query ID Match:</strong> # ${id}</span> 
                            <span class="badge bg-success rounded-pill">Similar</span>`;
            resultsList.appendChild(li);
        });

    } catch (error) {
        console.error("Semantic search failed:", error);
        resultsList.innerHTML = '<li class="list-group-item list-group-item-danger">Error processing search.</li>';
    }
}