let modo = "";
let seleccionado = null;
let arrastrando = false;
let zoom = 1;
let inicialDistanciaPellizco = 0;
let inicialZoom = 1;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

function getPos(e) {
  if (e.touches && e.touches.length > 0) return e.touches[0];
  return e;
}

function calcularDistancia(e) {
  const t = e.touches;
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
}

// Bloquear menús contextuales en elementos
document.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".elemento")) e.preventDefault();
}, false);

// GESTIÓN GLOBAL DE SELECCIÓN Y ZOOM
document.addEventListener("touchstart", (e) => {
  // Ignoramos clics si vienen de la barra de herramientas
  if (e.target.closest("#toolbar")) return;

  if (e.touches.length === 2) {
    arrastrando = false;
    inicialDistanciaPellizco = calcularDistancia(e);
    inicialZoom = zoom;
  } else if (!e.target.closest(".elemento")) {
    deseleccionar();
  }
}, { passive: false });

document.addEventListener("mousedown", (e) => {
  // Si clicamos en la barra, no deseleccionamos lo que hay abajo
  if (e.target.closest("#toolbar")) return;
  if (!e.target.closest(".elemento")) deseleccionar();
});

document.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const nuevaDistancia = calcularDistancia(e);
    zoom = Math.min(Math.max(inicialZoom * (nuevaDistancia / inicialDistanciaPellizco), 0.5), 4);
    document.getElementById("contenedor").style.transform = `scale(${zoom})`;
  }
}, { passive: false });

function seleccionar(el) {
  deseleccionar();
  seleccionado = el;
  el.classList.add("selected");
}

function deseleccionar() {
  if (seleccionado) {
    seleccionado.classList.remove("selected");
    const editArea = seleccionado.querySelector(".texto-edit");
    if (editArea) editArea.contentEditable = false;
  }
  seleccionado = null;
}

// FUNCIONES DE ESTILO (CORREGIDAS)
function toggleBold() {
  if (!seleccionado) return;
  const editArea = seleccionado.querySelector(".texto-edit");
  if (!editArea) return;
  
  // Usamos getComputedStyle para leer el estado real aunque no esté definido en el style inline
  const currentWeight = window.getComputedStyle(editArea).fontWeight;
  if (currentWeight === "bold" || parseInt(currentWeight) >= 700) {
      editArea.style.fontWeight = "normal";
  } else {
      editArea.style.fontWeight = "bold";
  }
}

function toggleItalic() {
  if (!seleccionado) return;
  const editArea = seleccionado.querySelector(".texto-edit");
  if (!editArea) return;

  const currentStyle = window.getComputedStyle(editArea).fontStyle;
  if (currentStyle === "italic") {
      editArea.style.fontStyle = "normal";
  } else {
      editArea.style.fontStyle = "italic";
  }
}

function modoTexto() { modo = "texto"; }
function modoBorrar() { modo = "borrar"; }
function modoImagen() { modo = "imagen"; }

// CARGA DEL PDF
document.getElementById("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const contenedor = document.getElementById("contenedor");
  contenedor.innerHTML = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const div = document.createElement("div");
    div.className = "pagina";
    div.style.width = viewport.width + "px";
    div.style.height = viewport.height + "px";
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    div.appendChild(canvas);
    contenedor.appendChild(div);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    canvas.addEventListener("click", (ev) => {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / zoom;
      const y = (ev.clientY - rect.top) / zoom;
      if (modo === "borrar") {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(x - 40, y - 10, 150, 40);
      }
      if (modo === "texto") crearTexto(div, x, y);
      if (modo === "imagen") insertarImagen(div, x, y);
    });
  }
});

function activarArrastre(el) {
  const areaTexto = el.querySelector(".texto-edit");

  const inicio = (e) => {
    if (e.touches && e.touches.length > 1) return;
    if (e.target.classList.contains("resize-handle") || e.target.classList.contains("delete-btn")) return;
    
    // Si ya estamos editando el texto interior, permitimos el cursor y no arrastramos el cuadro
    if (areaTexto && areaTexto.contentEditable === "true") return;

    seleccionar(el);
    arrastrando = true;
    const pos = getPos(e);
    const rect = el.getBoundingClientRect();
    offsetX = (pos.clientX - rect.left) / zoom;
    offsetY = (pos.clientY - rect.top) / zoom;

    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
    document.addEventListener("touchmove", mover, { passive: false });
    document.addEventListener("touchend", soltar);
  };

  el.addEventListener("mousedown", inicio);
  el.addEventListener("touchstart", inicio, { passive: false });

  // Doble clic para activar la escritura
  el.addEventListener("dblclick", () => {
    if (areaTexto) {
      areaTexto.contentEditable = true;
      areaTexto.focus();
    }
  });
}

function mover(e) {
  if (!arrastrando || !seleccionado) return;
  if (e.type === "touchmove") e.preventDefault(); 
  const pos = getPos(e);
  const rectPagina = seleccionado.parentElement.getBoundingClientRect();
  seleccionado.style.left = ((pos.clientX - rectPagina.left) / zoom - offsetX) + "px";
  seleccionado.style.top = ((pos.clientY - rectPagina.top) / zoom - offsetY) + "px";
}

function soltar() {
  arrastrando = false;
  document.removeEventListener("mousemove", mover);
  document.removeEventListener("mouseup", soltar);
  document.removeEventListener("touchmove", mover);
  document.removeEventListener("touchend", soltar);
}

function crearTexto(pagina, x, y) {
  modo = "";
  const wrapper = document.createElement("div");
  wrapper.className = "elemento";
  wrapper.style.left = x + "px";
  wrapper.style.top = y + "px";

  const editArea = document.createElement("div");
  editArea.className = "texto-edit";
  editArea.style.fontSize = "20px";
  editArea.style.color = document.getElementById("colorTexto").value;
  editArea.innerText = ""; 
  wrapper.appendChild(editArea);
  
  activarArrastre(wrapper);

  const del = document.createElement("div");
  del.className = "delete-btn";
  del.innerText = "×";
  del.onclick = (e) => { e.stopPropagation(); wrapper.remove(); };
  wrapper.appendChild(del);

  const h = document.createElement("div");
  h.className = "resize-handle handle-br";
  h.addEventListener("touchstart", (e) => startResize(e, wrapper, editArea), { passive: false });
  h.addEventListener("mousedown", (e) => startResize(e, wrapper, editArea));
  wrapper.appendChild(h);

  pagina.appendChild(wrapper);

  // Seleccionamos y damos foco para empezar a escribir
  setTimeout(() => {
    seleccionar(wrapper);
    editArea.contentEditable = true;
    editArea.focus();
  }, 100);
}

function startResize(e, wrapper, editArea) {
    e.stopPropagation(); e.preventDefault();
    const pos = getPos(e);
    let startX = pos.clientX;
    let startSize = parseInt(window.getComputedStyle(editArea).fontSize);

    const onMove = (ev) => {
      const p = getPos(ev);
      let delta = (p.clientX - startX) / (2 * zoom);
      editArea.style.fontSize = Math.max(8, startSize + delta) + "px";
    };
    const onEnd = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove); document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false }); document.addEventListener("touchend", onEnd);
}

function insertarImagen(pagina, x, y) {
  modo = "";
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const wrapper = document.createElement("div");
    wrapper.className = "elemento imagen";
    wrapper.style.left = x + "px"; wrapper.style.top = y + "px";
    const img = document.createElement("img");
    img.src = url; wrapper.appendChild(img);
    wrapper.dataset.scale = 1;
    activarArrastre(wrapper);
    const h = document.createElement("div");
    h.className = "resize-handle handle-br";
    h.addEventListener("mousedown", (ev) => startResizeImg(ev, wrapper));
    h.addEventListener("touchstart", (ev) => startResizeImg(ev, wrapper), {passive:false});
    wrapper.appendChild(h);
    const del = document.createElement("div");
    del.className = "delete-btn"; del.innerText = "×";
    del.onclick = (e) => { e.stopPropagation(); wrapper.remove(); };
    wrapper.appendChild(del);
    pagina.appendChild(wrapper);
  };
  input.click();
}

function startResizeImg(e, wrapper) {
    e.stopPropagation(); e.preventDefault();
    const pos = getPos(e);
    let startX = pos.clientX;
    let startScale = parseFloat(wrapper.dataset.scale) || 1;
    const onMove = (ev) => {
        const p = getPos(ev);
        let delta = (p.clientX - startX) / (150 * zoom);
        wrapper.dataset.scale = Math.max(0.1, startScale + delta);
        wrapper.style.transform = `scale(${wrapper.dataset.scale})`;
    };
    const onEnd = () => {
        document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove); document.removeEventListener("touchend", onEnd);
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false }); document.addEventListener("touchend", onEnd);
}

async function descargarPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  const paginas = document.querySelectorAll(".pagina");
  for (let i = 0; i < paginas.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = paginas[i].querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const elementos = paginas[i].querySelectorAll(".elemento");
    elementos.forEach(el => {
      const editArea = el.querySelector(".texto-edit");
      if (editArea) {
        const fs = window.getComputedStyle(editArea).fontSize;
        const fw = window.getComputedStyle(editArea).fontWeight;
        const fst = window.getComputedStyle(editArea).fontStyle;
        let style = "";
        if (fw === "bold" || parseInt(fw) >= 700) style += "bold ";
        if (fst === "italic") style += "italic ";
        ctx.font = `${style}${fs} Arial`;
        ctx.fillStyle = editArea.style.color;
        ctx.fillText(editArea.innerText, parseInt(el.style.left), parseInt(el.style.top) + parseInt(fs));
      }
      const img = el.querySelector("img");
      if (img) {
        const scale = parseFloat(el.dataset.scale) || 1;
        const tempCanvas = document.createElement("canvas");
        const tctx = tempCanvas.getContext("2d");
        tempCanvas.width = img.naturalWidth * scale; tempCanvas.height = img.naturalHeight * scale;
        tctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(tempCanvas, parseInt(el.style.left), parseInt(el.style.top));
      }
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.8);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
  }
  pdf.save("editado.pdf");
}