document.getElementById("buscarBtn").addEventListener("click", async () => {
    const numero = document.getElementById("numero").value.trim();
    const elemento = document.getElementById("elemento").value.trim();
    const resultadoDiv = document.getElementById("resultado");

    if (!numero || !elemento) {
        resultadoDiv.innerHTML = "<p style='color:red;'>Debe ingresar número y elemento.</p>";
        return;
    }

    try {
        const res = await fetch(`/buscar_alarma?numero=${encodeURIComponent(numero)}&elemento=${encodeURIComponent(elemento)}`);
        const data = await res.json();

        if (!res.ok) {
            resultadoDiv.innerHTML = `<p style='color:red;'>${data.mensaje || data.error}</p>`;
            return;
        }

        let html = "<ul>";
        data.forEach(alarma => {
            html += `<li><b>${alarma.numero}</b> - ${alarma.elemento} - ${alarma.descripcion} 
                     <br><a href="/pdf/${encodeURIComponent(alarma.km)}.pdf" target="_blank">Abrir instructivo</a></li>`;
        });
        html += "</ul>";

        resultadoDiv.innerHTML = html;

    } catch (err) {
        resultadoDiv.innerHTML = `<p style='color:red;'>Error: ${err.message}</p>`;
    }
});
