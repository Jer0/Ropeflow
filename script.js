
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    let videosData = [];
    let hasInteracted = false; // Flag para controlar la interacción inicial del usuario

    // --- 1. REGISTRAR SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.error('Error al registrar Service Worker', err));
    }

    // --- 2. LÓGICA DE INICIO ---
    function initApp() {
        if (hasInteracted) return; // Evitar múltiples inicializaciones
        hasInteracted = true;

        // Ocultar el overlay
        startOverlay.style.opacity = '0';
        setTimeout(() => startOverlay.style.display = 'none', 500);

        // Cargar y crear los videos
        fetch('videos.json')
            .then(response => response.json())
            .then(data => {
                videosData = data;
                createVideoElements(videosData);
                setupIntersectionObserver();
                // Forzar la reproducción del primer video visible
                const firstVideo = videoContainer.querySelector('video');
                if(firstVideo) firstVideo.play().catch(e => console.log("Autoplay bloqueado"));
            })
            .catch(error => console.error('Error al cargar videos.json:', error));
    }

    startOverlay.addEventListener('click', initApp);

    // --- 3. CREACIÓN DE ELEMENTOS DE VIDEO ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.videoId = videoInfo.id;

            const video = document.createElement('video');
            video.src = videoInfo.src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;

            const overlay = document.createElement('div');
            overlay.className = 'info-overlay';
            overlay.innerHTML = `
                <div class="info-box">
                    <div class="number">${videoInfo.number}</div>
                    <div class="title">${videoInfo.title}</div>
                </div>
            `;

            wrapper.appendChild(video);
            wrapper.appendChild(overlay);
            videoContainer.appendChild(wrapper);

            setupZoomAndPan(wrapper, video);
        });
    }

    // --- 4. OBSERVADOR PARA AUTOPLAY Y MOSTRAR INFO ---
    function setupIntersectionObserver() {
        const options = { threshold: 0.5 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!hasInteracted) return; // No hacer nada si el usuario no ha interactuado

                const video = entry.target.querySelector('video');
                const overlay = entry.target.querySelector('.info-overlay');

                if (entry.isIntersecting) {
                    video.play().catch(e => console.log("Autoplay falló tras interacción"));
                    overlay.classList.add('visible');
                    setTimeout(() => overlay.classList.remove('visible'), 3000);
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        }, options);

        document.querySelectorAll('.video-wrapper').forEach(wrapper => {
            observer.observe(wrapper);
        });
    }

    // --- 5. LÓGICA DE ZOOM Y PANEO (sin cambios) ---
    function setupZoomAndPan(container, video) {
        let scale = 1, isPanning = false, start = { x: 0, y: 0 }, transform = { x: 0, y: 0 };
        const setTransform = () => { video.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${scale})`; };
        container.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(1, Math.min(scale + delta, 5));
            if (newScale === 1) { transform = { x: 0, y: 0 }; }
            else {
                const rect = video.getBoundingClientRect();
                transform.x += (e.clientX - rect.left) / scale * (scale - newScale);
                transform.y += (e.clientY - rect.top) / scale * (scale - newScale);
            }
            scale = newScale;
            setTransform();
        });
        container.addEventListener('mousedown', e => {
            if (scale > 1) { isPanning = true; start = { x: e.clientX - transform.x, y: e.clientY - transform.y }; container.style.cursor = 'grabbing'; }
        });
        container.addEventListener('mousemove', e => { if (isPanning) { transform.x = e.clientX - start.x; transform.y = e.clientY - start.y; setTransform(); } });
        window.addEventListener('mouseup', () => { isPanning = false; container.style.cursor = 'grab'; });
    }

    // --- 6. LÓGICA DE PANTALLA COMPLETA ---
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
});
