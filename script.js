
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    let videosData = [];
    let hasInteracted = false;

    // --- 1. REGISTRAR SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js') // Ruta correcta para GitHub Pages
            .then(reg => console.log('Service Worker registrado', reg))
            .catch(err => console.error('Error al registrar Service Worker', err));
    }

    // --- 2. LÓGICA DE INICIO MEJORADA PARA IOS ---
    async function initApp() {
        if (hasInteracted) return;
        hasInteracted = true;

        startOverlay.style.opacity = '0';
        setTimeout(() => startOverlay.style.display = 'none', 500);

        try {
            const response = await fetch('videos.json');
            videosData = await response.json();
            createVideoElements(videosData);
            setupIntersectionObserver();

            // **Solución para iOS**: "Desbloquear" todos los videos
            const videoElements = document.querySelectorAll('video');
            videoElements.forEach(video => {
                const promise = video.play();
                if (promise !== undefined) {
                    promise.then(() => video.pause())
                           .catch(e => console.warn("No se pudo pre-desbloquear un video. Esto es normal en algunas condiciones."));
                }
            });
            
            // Forzar la reproducción del primer video visible después del desbloqueo
            const firstVideoWrapper = videoContainer.querySelector('.video-wrapper');
            if (firstVideoWrapper) {
                const firstVideo = firstVideoWrapper.querySelector('video');
                firstVideo.play().catch(e => console.log("Autoplay del primer video bloqueado, el usuario debe hacer scroll."));
            }

        } catch (error) {
            console.error('Error al cargar videos.json:', error);
        }
    }

    startOverlay.addEventListener('click', initApp);

    // --- 3. CREACIÓN DE ELEMENTOS (CON PRELOADER) ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.videoId = videoInfo.id;

            const preloader = document.createElement('div');
            preloader.className = 'preloader';

            const video = document.createElement('video');
            video.src = videoInfo.src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';

            video.addEventListener('waiting', () => preloader.classList.remove('hidden'));
            video.addEventListener('canplaythrough', () => preloader.classList.add('hidden'));

            const overlay = document.createElement('div');
            overlay.className = 'info-overlay';
            overlay.innerHTML = `
                <div class="info-box">
                    <div class="number">${videoInfo.number}</div>
                    <div class="title">${videoInfo.title}</div>
                </div>
            `;
            
            wrapper.appendChild(preloader);
            wrapper.appendChild(video);
            wrapper.appendChild(overlay);
            videoContainer.appendChild(wrapper);

            setupZoomAndPan(wrapper, video);
        });
    }

    // --- 4. OBSERVADOR ---
    function setupIntersectionObserver() {
        const options = { threshold: 0.5 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!hasInteracted) return;
                const video = entry.target.querySelector('video');
                const overlay = entry.target.querySelector('.info-overlay');
                if (entry.isIntersecting) {
                    video.play().catch(e => {});
                    overlay.classList.add('visible');
                    setTimeout(() => overlay.classList.remove('visible'), 3000);
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        }, options);
        document.querySelectorAll('.video-wrapper').forEach(wrapper => observer.observe(wrapper));
    }

    // --- 5. ZOOM Y PANEO ---
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

    // --- 6. PANTALLA COMPLETA ---
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
});
