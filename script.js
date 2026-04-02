fetch('loadcontent.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('shared-link').innerHTML = data;
    });

fetch('loadsidebar.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('sidebar').innerHTML = data;
    });