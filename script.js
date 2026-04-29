let modo = "";
let seleccionado = null;
let arrastrando = false;
let zoom = 1;
let inicialDistanciaPellizco = 0;
let inicialZoom = 1;
let pdfDocumento = null; 

// Variables para el borrado y el historial
let estaPintandoBorrador = false;
let trazosBorrados = []; 
let trazoActual = null;
let historialAcciones = []; 

// Variables para el arrastre de elementos
let offsetX = 0;
let offsetY = 0;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

function getPos(e) {
  if (e.touches && e.touches.length > 0) return e.touches[0];
  return e;
}

function calcularDistancia(e) {
  const t = e.touches;
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
}

document.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".elemento")) e.preventDefault();
}, false);

document.addEventListener("touchstart", (e) => {
  if (e.target.closest("#toolbar")) return;
  if (e.touches.length === 2) {
    arrastrando = false;
    inicialDistanciaPellizco = calcularDistancia(e);
    inicialZoom = zoom;
  } else if (!e.target.closest(".elemento") && modo !== "borrar") {
    deseleccionar();
  }
}, { passive: false });

document.addEventListener("mousedown", (e) => {
  if (e.target.closest("#toolbar")) return;
  if (!e.target.closest(".elemento") && modo !== "borrar") deseleccionar();
});

document.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    if (e.cancelable) e.preventDefault();
    const nuevaDistancia = calcularDistancia(e);
    zoom = Math.min(Math.max(inicialZoom * (nuevaDistancia / inicialDistanciaPellizco), 0.5), 4);
    document.getElementById("contenedor").style.transform = "scale(" + zoom + ")";
  }
}, { passive: false });

function seleccionar(el) {
  deseleccionar();
  seleccionado = el;
  el.classList.add("selected");
  
  // Sincronizar el selector de fuente con la fuente del elemento seleccionado
  const editArea = el.querySelector(".texto-edit");
  if (editArea) {
      const fuenteActual = editArea.style.fontFamily.replace(/['"]+/g, "");
      document.getElementById("fuenteTexto").value = fuenteActual || "Arial";
  }
}

function deseleccionar() {
  if (seleccionado) {
    seleccionado.classList.remove("selected");
    const editArea = seleccionado.querySelector(".texto-edit");
    if (editArea) editArea.contentEditable = false;
  }
  seleccionado = null;
}

function toggleBold() {
  if (!seleccionado) return;
  const editArea = seleccionado.querySelector(".texto-edit");
  if (!editArea) return;
  const currentWeight = window.getComputedStyle(editArea).fontWeight;
  editArea.style.fontWeight = (currentWeight === "bold" || parseInt(currentWeight) >= 700) ? "normal" : "bold";
}

function toggleItalic() {
  if (!seleccionado) return;
  const editArea = seleccionado.querySelector(".texto-edit");
  if (!editArea) return;
  const currentStyle = window.getComputedStyle(editArea).fontStyle;
  editArea.style.fontStyle = (currentStyle === "italic") ? "normal" : "italic";
}

function cambiarFuente() {
    if (!seleccionado) return;
    const editArea = seleccionado.querySelector(".texto-edit");
    if (!editArea) return;
    editArea.style.fontFamily = document.getElementById("fuenteTexto").value;
}

function modoMover() {
    modo = "";
    document.getElementById("contenedor").classList.remove("modo-borrar");
}

function modoTexto() { 
    modo = "texto"; 
    document.getElementById("contenedor").classList.remove("modo-borrar"); 
}

function modoBorrar() { 
    if (modo === "borrar") {
        modo = "";
        document.getElementById("contenedor").classList.remove("modo-borrar");
    } else {
        modo = "borrar"; 
        document.getElementById("contenedor").classList.add("modo-borrar");
    }
}

function modoImagen() { 
    modo = "imagen"; 
    document.getElementById("contenedor").classList.remove("modo-borrar"); 
}

// --- CARGA DE ARCHIVO ---
document.getElementById("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  pdfDocumento = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const contenedor = document.getElementById("contenedor");
  contenedor.innerHTML = "";
  trazosBorrados = []; 
  historialAcciones = []; 

  for (let i = 1; i <= pdfDocumento.numPages; i++) {
    const page = await pdfDocumento.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const divPagina = document.createElement("div");
    divPagina.className = "pagina";
    divPagina.dataset.num = i;
    divPagina.style.width = viewport.width + "px";
    divPagina.style.height = viewport.height + "px";
    
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    divPagina.appendChild(canvas);
    contenedor.appendChild(divPagina);
    
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    // --- EVENTOS DE BORRADO ---
    const iniciarBorrado = (ev) => {
        if (modo !== "borrar") return;
        estaPintandoBorrador = true;
        const p = getPos(ev);
        const rect = canvas.getBoundingClientRect();
        const mouseX = (p.clientX - rect.left) / zoom;
        const mouseY = (p.clientY - rect.top) / zoom;
        trazoActual = { pagina: i, puntos: [{x: mouseX, y: mouseY}] };
        trazosBorrados.push(trazoActual);
    };

    const moverBorrado = (ev) => {
        if (!estaPintandoBorrador || modo !== "borrar" || !trazoActual || trazoActual.pagina !== i) return;
        if (ev.cancelable) ev.preventDefault();
        const p = getPos(ev);
        const rect = canvas.getBoundingClientRect();
        const mouseX = (p.clientX - rect.left) / zoom;
        const mouseY = (p.clientY - rect.top) / zoom;

        const ctx = canvas.getContext("2d");
        ctx.beginPath();
        const ultimo = trazoActual.puntos[trazoActual.puntos.length - 1];
        ctx.moveTo(ultimo.x, ultimo.y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 10; 
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        trazoActual.puntos.push({x: mouseX, y: mouseY});
    };

    const finalizarBorrado = () => {
        if (estaPintandoBorrador && trazoActual) {
            historialAcciones.push({ tipo: 'borrado', trazo: trazoActual });
        }
        estaPintandoBorrador = false;
        trazoActual = null;
    };

    canvas.addEventListener("mousedown", iniciarBorrado);
    window.addEventListener("mousemove", moverBorrado);
    window.addEventListener("mouseup", finalizarBorrado);
    canvas.addEventListener("touchstart", iniciarBorrado, { passive: false });
    window.addEventListener("touchmove", moverBorrado, { passive: false });
    window.addEventListener("touchend", finalizarBorrado);

    canvas.addEventListener("click", (ev) => {
      if (modo === "borrar") return;
      const rect = canvas.getBoundingClientRect();
      const clickX = (ev.clientX - rect.left) / zoom;
      const clickY = (ev.clientY - rect.top) / zoom;
      if (modo === "texto") crearTexto(divPagina, clickX, clickY);
      if (modo === "imagen") insertarImagen(divPagina, clickX, clickY);
    });
  }
});

// --- FUNCIONES DE DESHACER ---
async function deshacer() {
    if (historialAcciones.length === 0) return;
    const ultimaAccion = historialAcciones.pop();
    if (ultimaAccion.tipo === 'elemento') {
        ultimaAccion.el.remove();
    } else if (ultimaAccion.tipo === 'borrado') {
        trazosBorrados = trazosBorrados.filter(t => t !== ultimaAccion.trazo);
        await redibujarPagina(ultimaAccion.trazo.pagina);
    }
}

async function redibujarPagina(numPagina) {
    const divPagina = document.querySelector(".pagina[data-num='" + numPagina + "']");
    const canvas = divPagina.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const page = await pdfDocumento.getPage(numPagina);
    const viewport = page.getViewport({ scale: 1.5 });
    await page.render({ canvasContext: ctx, viewport }).promise;
    trazosBorrados.filter(t => t.pagina === numPagina).forEach(trazo => {
        if (trazo.puntos.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
        for (let p = 1; p < trazo.puntos.length; p++) {
            ctx.lineTo(trazo.puntos[p].x, trazo.puntos[p].y);
        }
        ctx.strokeStyle = "white";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    });
}

// --- GESTIÓN DE ARRASTRE ---
function activarArrastre(el) {
  const areaTexto = el.querySelector(".texto-edit");
  const inicio = (e) => {
    if (modo === "borrar") return; 
    if (e.touches && e.touches.length > 1) return;
    if (e.target.classList.contains("resize-handle") || e.target.classList.contains("delete-btn")) return;
    if (areaTexto && areaTexto.contentEditable === "true") return;
    
    seleccionar(el);
    arrastrando = true;
    const pos = getPos(e);
    const rectPagina = el.parentElement.getBoundingClientRect();
    
    const actualLeft = parseFloat(el.style.left) || 0;
    const actualTop = parseFloat(el.style.top) || 0;
    
    offsetX = ( (pos.clientX - rectPagina.left) / zoom ) - actualLeft;
    offsetY = ( (pos.clientY - rectPagina.top) / zoom ) - actualTop;

    const mover = (ev) => {
        if (!arrastrando || !seleccionado) return;
        const p = getPos(ev);
        const rP = seleccionado.parentElement.getBoundingClientRect();
        
        const nuevoX = ( (p.clientX - rP.left) / zoom ) - offsetX;
        const nuevoY = ( (p.clientY - rP.top) / zoom ) - offsetY;
        
        seleccionado.style.left = nuevoX + "px";
        seleccionado.style.top = nuevoY + "px";
    };

    const soltar = () => {
        arrastrando = false;
        window.removeEventListener("mousemove", mover);
        window.removeEventListener("mouseup", soltar);
        window.removeEventListener("touchmove", mover);
        window.removeEventListener("touchend", soltar);
    };

    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    window.addEventListener("touchmove", mover, { passive: false });
    window.addEventListener("touchend", soltar);
  };
  el.addEventListener("mousedown", inicio);
  el.addEventListener("touchstart", inicio, { passive: false });
  el.addEventListener("dblclick", () => {
    if (areaTexto) { areaTexto.contentEditable = true; areaTexto.focus(); }
  });
}

function crearTexto(pagina, x, y) {
  modo = "";
  document.getElementById("contenedor").classList.remove("modo-borrar");
  const wrapper = document.createElement("div");
  wrapper.className = "elemento";
  wrapper.style.left = x + "px";
  wrapper.style.top = y + "px";
  const editArea = document.createElement("div");
  editArea.className = "texto-edit";
  editArea.style.fontSize = "20px";
  editArea.style.color = document.getElementById("colorTexto").value;
  editArea.style.fontFamily = document.getElementById("fuenteTexto").value; 
  editArea.innerText = "Texto"; 
  wrapper.appendChild(editArea);
  activarArrastre(wrapper);
  const del = document.createElement("div");
  del.className = "delete-btn"; del.innerText = "×";
  del.onclick = (e) => { e.stopPropagation(); wrapper.remove(); };
  wrapper.appendChild(del);
  const h = document.createElement("div");
  h.className = "resize-handle handle-br";
  h.addEventListener("mousedown", (e) => startResize(e, wrapper, editArea));
  h.addEventListener("touchstart", (e) => startResize(e, wrapper, editArea), {passive:false});
  wrapper.appendChild(h);
  pagina.appendChild(wrapper);
  historialAcciones.push({ tipo: 'elemento', el: wrapper });
  seleccionar(wrapper); 
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
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onEnd);
}

function insertarImagen(pagina, x, y) {
  modo = "";
  document.getElementById("contenedor").classList.remove("modo-borrar");
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const wrapper = document.createElement("div");
    wrapper.className = "elemento imagen";
    wrapper.style.left = x + "px"; wrapper.style.top = y + "px";
    wrapper.style.width = "200px"; 
    const img = document.createElement("img");
    img.src = url; wrapper.appendChild(img);
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
    historialAcciones.push({ tipo: 'elemento', el: wrapper });
    seleccionar(wrapper);
  };
  input.click();
}

function startResizeImg(e, wrapper) {
    e.stopPropagation(); e.preventDefault();
    const pos = getPos(e);
    let startX = pos.clientX;
    let startW = wrapper.offsetWidth;
    const onMove = (ev) => {
        const p = getPos(ev);
        let delta = (p.clientX - startX) / zoom;
        wrapper.style.width = Math.max(20, startW + delta) + "px";
    };
    const onEnd = () => {
        window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onEnd);
}

// --- DESCARGA FINAL ---
async function descargarPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'pt', 'a4');
  const paginasDOM = document.querySelectorAll(".pagina");
  for (let i = 0; i < paginasDOM.length; i++) {
    const pageNum = i + 1;
    const page = await pdfDocumento.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    if (i > 0) pdf.addPage([viewport.width, viewport.height], 'p');
    else pdf.setPage(1); 
    pdf.internal.pageSize.width = viewport.width;
    pdf.internal.pageSize.height = viewport.height;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
    const tctx = tempCanvas.getContext("2d");
    await page.render({ canvasContext: tctx, viewport }).promise;
    trazosBorrados.filter(t => t.pagina === pageNum).forEach(trazo => {
      if (trazo.puntos.length < 2) return;
      tctx.beginPath();
      tctx.moveTo(trazo.puntos[0].x, trazo.puntos[0].y);
      for (let p = 1; p < trazo.puntos.length; p++) { tctx.lineTo(trazo.puntos[p].x, trazo.puntos[p].y); }
      tctx.strokeStyle = "white";
      tctx.lineWidth = 8;
      tctx.lineCap = "round";
      tctx.lineJoin = "round";
      tctx.stroke();
    });
    const elementos = paginasDOM[i].querySelectorAll(".elemento");
    elementos.forEach(el => {
      const posX = parseFloat(el.style.left);
      const posY = parseFloat(el.style.top);
      const editArea = el.querySelector(".texto-edit");
      if (editArea && editArea.innerText.trim() !== "") {
        const style = window.getComputedStyle(editArea);
        const fontSize = style.fontSize;
        const fontWeight = style.fontWeight;
        const fontStyle = style.fontStyle;
        const fontFamily = style.fontFamily; 
        let finalFontStyle = "";
        if (fontWeight === "bold" || parseInt(fontWeight) >= 700) finalFontStyle += "bold ";
        if (fontStyle === "italic") finalFontStyle += "italic ";
        
        tctx.font = finalFontStyle + fontSize + " " + fontFamily;
        tctx.fillStyle = editArea.style.color;
        tctx.textBaseline = "top"; 
        tctx.fillText(editArea.innerText, posX + 5, posY + 5);
      }
      const img = el.querySelector("img");
      if (img) { tctx.drawImage(img, posX, posY, el.offsetWidth, el.offsetHeight); }
    });
    const imgData = tempCanvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, viewport.width, viewport.height);
  }
  pdf.save("pdf_editado.pdf");
}