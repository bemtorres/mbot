(() => {
  const viewer = document.getElementById('presentation-viewer');
  if (!viewer) return;
  const image = viewer.querySelector('img');
  const select = viewer.querySelector('select');
  const previous = viewer.querySelector('[data-previous]');
  const next = viewer.querySelector('[data-next]');
  const status = viewer.querySelector('[role="status"]');
  const retry = viewer.querySelector('[data-retry]');
  const fullscreen = viewer.querySelector('[data-fullscreen]');
  const titles = ['Tu chat con conocimientos','Objetivos de aprendizaje','Identidad, memoria y conocimiento','Modelos del proyecto','Arquitectura de una conversación','Roles de los mensajes','System prompt','Construcción de messages','Historial en SQLite','Indexación documental','Recuperación RAG','Similitud de vectores','Código de recuperación','SDK de OpenAI','API del cliente web','Evaluación del sistema','Ejercicio: roles','Ejercicio: prueba RAG','Preparación para producción','Cierre y fuentes'];
  let current = 0;
  titles.forEach((title, index) => select.add(new Option(`${index + 1}. ${title}`, String(index))));
  function show(index) {
    current = Math.max(0, Math.min(titles.length - 1, index));
    select.value = String(current);
    previous.disabled = current === 0;
    next.disabled = current === titles.length - 1;
    viewer.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    image.style.visibility = 'hidden';
    status.textContent = `Cargando diapositiva ${current + 1}…`;
    image.alt = `Diapositiva ${current + 1} de ${titles.length}: ${titles[current]}`;
    image.src = `${viewer.dataset.slides}/slide-${String(current + 1).padStart(2, '0')}.png`;
  }
  image.addEventListener('load', () => {
    viewer.setAttribute('aria-busy', 'false');
    image.style.visibility = 'visible';
    status.textContent = `${current + 1} de ${titles.length} · ${titles[current]}`;
  });
  image.addEventListener('error', () => {
    viewer.setAttribute('aria-busy', 'false');
    status.textContent = 'No se pudo cargar la diapositiva. Reintenta o descarga el PPTX.';
    retry.hidden = false;
  });
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  select.addEventListener('change', () => show(Number(select.value)));
  retry.addEventListener('click', () => show(current));
  viewer.addEventListener('keydown', event => {
    if (event.target.closest('select, a, button')) return;
    const keys = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: titles.length - 1};
    if (event.key in keys) { event.preventDefault(); show(keys[event.key]); }
  });
  fullscreen.hidden = !viewer.requestFullscreen;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === viewer) await document.exitFullscreen();
      else await viewer.requestFullscreen();
    } catch { status.textContent = 'Pantalla completa no disponible en este navegador.'; }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement === viewer ? 'Salir de pantalla completa' : 'Pantalla completa';
  });
  show(0);
})();
