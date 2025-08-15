document.getElementById("btnBuscar").addEventListener("click", async () => {
  const numero = document.getElementById("numero").value.trim();
  const elemento = document.getElementById("elemento").value.trim();
  const estado = document.getElementById("estado");
  const tabla = document.getElementById("tabla");
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");

  estado.textContent = "Buscando...";
  tabla.style.display = "none";
  thead.innerHTML = "";
  tbody.innerHTML = "";

  try {
    const url = new URL(window.location.origin + "/buscar");
    if (numero) url.searchParams.set("numero", numero);
    if (elemento) url.searchParams.set("elemento", elemento);

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      estado.textContent = data.error || data.mensaje || "Error en la búsqueda";
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      estado.textContent = "Sin resultados.";
      return;
    }

    // Construir tabla
    const cols = Object.keys(data[0]);
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr>`;
    tbody.innerHTML = data.map(row =>
      `<tr>${cols.map(c => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`
    ).join("");

    estado.textContent = `Resultados: ${data.length}`;
    tabla.style.display = "table";
  } catch (e) {
    estado.textContent = "Error de red o servidor.";
  }
});
