




document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const cacheStatus = document.getElementById('cache-status');
    
    let videosData = [];

    // --- 1. SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW reg failed', err));
    }

    // --- 2. LÓGICA DE INICIO ---
    async function initApp() {
        startOverlay.style.opacity = '0';
        setTimeout(() => startOverlay.style.display = 'none', 500);
        try {
            const response = await fetch('videos.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            videosData = await response.json();
            createVideoElements(videosData);

            requestAnimationFrame(() => {
                const firstWrapper = document.querySelector('.video-wrapper');
                if (firstWrapper) loadVideo(firstWrapper);
                setupIntersectionObserver();
            });

            // Iniciar la caché de todos los videos en segundo plano
            cacheAllVideosInBackground(videosData, cacheStatus);

        } catch (error) {
            console.error('Error al cargar videos.json:', error);
            alert('No se pudieron cargar los datos de los videos. La aplicación no puede iniciar sin conexión si no se ha cargado al menos una vez. Por favor, conéctate a internet e inténtalo de nuevo.');
            startOverlay.style.display = 'flex';
            setTimeout(() => startOverlay.style.opacity = '1', 100);
        }
    }
    startOverlay.addEventListener('click', initApp, { once: true });

    // --- 3. CREACIÓN DE ELEMENTOS ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.src = videoInfo.src;
            const preloader = document.createElement('div');
            preloader.className = 'preloader';
            const video = document.createElement('video');
            video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'none';
            const playFallback = document.createElement('div');
            playFallback.className = 'play-fallback';
            playFallback.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            playFallback.addEventListener('click', () => { video.play(); playFallback.classList.remove('visible'); });
            wrapper.appendChild(preloader); wrapper.appendChild(video); wrapper.appendChild(overlay(videoInfo)); wrapper.appendChild(playFallback);
            videoContainer.appendChild(wrapper);
            setupZoomAndPan(wrapper, video);
            setupVideoSpeedCycling(video);
        });
    }
    function overlay(info) {
        const el = document.createElement('div');
        el.className = 'info-overlay';
        el.innerHTML = `<div class="info-box"><div class="number">${info.number}</div><div class="title">${info.title}</div></div>`;
        return el;
    }

    // --- 4. LÓGICA DE CARGA Y CACHÉ ---
    async function loadVideo(wrapper) {
        const video = wrapper.querySelector('video');
        const src = wrapper.dataset.src;
        if (!src || wrapper.classList.contains('loaded') || wrapper.classList.contains('loading')) return;
        wrapper.classList.add('loading');

        const handleCanPlay = () => {
            wrapper.classList.add('loaded');
            wrapper.classList.remove('loading');
            video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay, { once: true });

        try {
            // La lógica de caché ahora es manejada principalmente por el Service Worker.
            // Este fetch activará al SW para que cachee el video si es necesario.
            const response = await fetch(src);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
            video.load();
        } catch (error) {
            console.error("Error al cargar video:", error);
            wrapper.classList.remove('loading');
        }
    }

    // --- 5. OBSERVADOR ---
    function setupIntersectionObserver() {
        const options = { threshold: 0.5 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(async entry => {
                const wrapper = entry.target;
                const video = wrapper.querySelector('video');
                const playFallback = wrapper.querySelector('.play-fallback');
                if (entry.isIntersecting) {
                    await loadVideo(wrapper);
                    const playVideo = async () => {
                        try {
                            await video.play();
                            playFallback.classList.remove('visible');
                        } catch (err) {
                            playFallback.classList.add('visible');
                        }
                    };
                    if (wrapper.classList.contains('loaded')) playVideo();
                    else video.addEventListener('canplay', playVideo, { once: true });
                    wrapper.querySelector('.info-overlay').classList.add('visible');
                    setTimeout(() => wrapper.querySelector('.info-overlay').classList.remove('visible'), 3000);
                } else {
                    video.pause();
                    playFallback.classList.remove('visible');
                }
            });
        }, options);
        document.querySelectorAll('.video-wrapper').forEach(w => observer.observe(w));
    }

    // --- 6. LÓGICA DE CONTROLES DE VELOCIDAD ---
    function setupVideoSpeedCycling(video) {
        const speeds = [1.0, 0.75, 0.5, 0.25];
        let currentSpeedIndex = 0;
        video.addEventListener('click', (e) => {
            e.stopPropagation();
            currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
            video.playbackRate = speeds[currentSpeedIndex];
            const overlay = video.closest('.video-wrapper').querySelector('.info-overlay');
            const infoBox = overlay.querySelector('.info-box');
            infoBox.innerHTML = `<div class="title">Velocidad: ${speeds[currentSpeedIndex]}x</div>`;
            overlay.classList.add('visible');
            setTimeout(() => {
                overlay.classList.remove('visible');
                const videoInfo = videosData.find(v => video.closest('.video-wrapper').dataset.src.includes(v.src));
                if (videoInfo) infoBox.innerHTML = `<div class="number">${videoInfo.number}</div><div class="title">${videoInfo.title}</div>`;
            }, 1000);
        });
    }

    // --- 7. ZOOM Y PANEO ---
    function setupZoomAndPan(container, video) {
        let scale = 1, isPanning = false, start = { x: 0, y: 0 }, transform = { x: 0, y: 0 };
        const setTransform = () => { video.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${scale})`; };
        container.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(1, Math.min(scale + delta, 5));
            if (newScale === 1) transform = { x: 0, y: 0 };
            else {
                const rect = video.getBoundingClientRect();
                transform.x += (e.clientX - rect.left) / scale * (scale - newScale);
                transform.y += (e.clientY - rect.top) / scale * (scale - newScale);
            }
            scale = newScale;
            setTransform();
        });
        container.addEventListener('mousedown', e => { if (scale > 1) { isPanning = true; start = { x: e.clientX - transform.x, y: e.clientY - transform.y }; container.style.cursor = 'grabbing'; } });
        container.addEventListener('mousemove', e => { if (isPanning) { transform.x = e.clientX - start.x; transform.y = e.clientY - start.y; setTransform(); } });
        window.addEventListener('mouseup', () => { isPanning = false; container.style.cursor = 'grab'; });
    }

    // --- 8. CACHÉ EN SEGUNDO PLANO ---
    async function cacheAllVideosInBackground(videos, statusElement) {
        statusElement.style.display = 'block';
        statusElement.textContent = 'Preparando descarga para modo offline...';
        const totalVideos = videos.length;
        let cachedCount = 0;

        for (let i = 0; i < totalVideos; i++) {
            const video = videos[i];
            try {
                const cache = await caches.open('ropeflow-viewer-v5');
                const cachedResponse = await cache.match(video.src);
                if (cachedResponse) {
                    cachedCount++;
                } else {
                    await fetch(video.src); // Esto activa el SW para que cachee
                    cachedCount++;
                }
                statusElement.textContent = `Descargando para modo offline: ${cachedCount} de ${totalVideos}`;
            } catch (error) {
                console.error(`Fallo al cachear ${video.src}:`, error);
                statusElement.textContent = `Error descargando video ${i + 1}. Revisa la conexión.`;
                // No continuar si hay un error de red
                return;
            }
        }

        statusElement.textContent = '¡Descarga completa! Listo para usar sin conexión.';
        setTimeout(() => { statusElement.style.display = 'none'; }, 5000);
    }
});




