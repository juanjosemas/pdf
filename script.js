let modo = "";
let seleccionado = null;
let arrastrando = false;
let offsetX = 0;
let offsetY = 0;

document.addEventListener("click", (e) => {
  if (!e.target.closest(".elemento")) deseleccionar();
});

function seleccionar(el) {
  deseleccionar();
  seleccionado = el;
  el.classList.add("selected");
}

function deseleccionar() {
  if (seleccionado) seleccionado.classList.remove("selected");
  seleccionado = null;
}

function modoTexto() { modo = "texto"; }
function modoBorrar() { modo = "borrar"; }
function modoImagen() { modo = "imagen"; }

document.getElementById("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
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
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    div.appendChild(canvas);
    contenedor.appendChild(div);

    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    canvas.addEventListener("click", (ev) => {
      if (modo === "borrar") {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(ev.offsetX - 40, ev.offsetY - 10, 150, 40);
      }

      if (modo === "texto") {
        crearTexto(div, ev.offsetX, ev.offsetY);
      }

      if (modo === "imagen") {
        insertarImagen(div, ev.offsetX, ev.offsetY);
      }
    });
  }
});

function activarArrastre(el) {
  el.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("resize-handle")) return;

    seleccionar(el);
    arrastrando = true;

    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;

    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
  });
}

function mover(e) {
  if (!arrastrando || !seleccionado) return;

  seleccionado.style.left = (e.clientX - offsetX) + "px";
  seleccionado.style.top = (e.clientY - offsetY) + "px";
}

function soltar() {
  arrastrando = false;
  document.removeEventListener("mousemove", mover);
  document.removeEventListener("mouseup", soltar);
}

function crearTexto(pagina, x, y) {
  modo = "";

  const wrapper = document.createElement("div");
  wrapper.className = "elemento texto";
  wrapper.contentEditable = true;
  wrapper.innerText = "Nuevo texto";

  wrapper.style.left = x + "px";
  wrapper.style.top = y + "px";
  wrapper.style.fontSize = "16px";
  wrapper.style.color = document.getElementById("colorTexto").value;

  activarArrastre(wrapper);

  const del = document.createElement("div");
  del.className = "delete-btn";
  del.innerText = "×";
  del.onclick = () => wrapper.remove();
  wrapper.appendChild(del);

  pagina.appendChild(wrapper);
}

function insertarImagen(pagina, x, y) {
  modo = "";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = (e) => {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    const wrapper = document.createElement("div");
    wrapper.className = "elemento imagen";
    wrapper.style.left = x + "px";
    wrapper.style.top = y + "px";

    const img = document.createElement("img");
    img.src = url;

    wrapper.appendChild(img);

    wrapper.dataset.scale = 1;

    activarArrastre(wrapper);

    const h = document.createElement("div");
    h.className = "resize-handle handle-br";
    h.onmousedown = redimensionarImagen;
    wrapper.appendChild(h);

    const del = document.createElement("div");
    del.className = "delete-btn";
    del.innerText = "×";
    del.onclick = () => wrapper.remove();
    wrapper.appendChild(del);

    pagina.appendChild(wrapper);
  };

  input.click();
}

function redimensionarImagen(e) {
  e.stopPropagation();
  const wrapper = e.target.parentElement;
  seleccionar(wrapper);

  const img = wrapper.querySelector("img");

  let startX = e.clientX;
  let startScale = parseFloat(wrapper.dataset.scale);

  function mover(ev) {
    let delta = (ev.clientX - startX) / 150;
    let newScale = Math.max(0.1, startScale + delta);

    wrapper.dataset.scale = newScale;
    wrapper.style.transform = `scale(${newScale})`;
  }

  function soltar() {
    document.removeEventListener("mousemove", mover);
    document.removeEventListener("mouseup", soltar);
  }

  document.addEventListener("mousemove", mover);
  document.addEventListener("mouseup", soltar);
}

async function descargarPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const paginas = document.querySelectorAll(".pagina");

  for (let i = 0; i < paginas.length; i++) {
    if (i > 0) pdf.addPage();

    const canvas = paginas[i].querySelector("canvas");
    const ctx = canvas.getContext("2d");

    const textos = paginas[i].querySelectorAll(".texto");
    textos.forEach(t => {
      ctx.font = t.style.fontSize + " Arial";
      ctx.fillStyle = t.style.color;
      ctx.fillText(t.innerText, parseInt(t.style.left), parseInt(t.style.top) + 16);
    });

    const imagenes = paginas[i].querySelectorAll(".imagen");
    for (let wrap of imagenes) {
      const img = wrap.querySelector("img");
      const scale = parseFloat(wrap.dataset.scale);

      const tempCanvas = document.createElement("canvas");
      const tctx = tempCanvas.getContext("2d");
      tempCanvas.width = img.naturalWidth * scale;
      tempCanvas.height = img.naturalHeight * scale;
      tctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

      ctx.drawImage(tempCanvas, parseInt(wrap.style.left), parseInt(wrap.style.top));
    }

    const img = canvas.toDataURL("image/jpeg", 1.0);
    pdf.addImage(img, "JPEG", 0, 0, 210, 297);
  }

  pdf.save("editado.pdf");
}