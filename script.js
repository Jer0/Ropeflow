




document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    
    let videosData = [];

    // --- 1. SERVICE WORKER (sin cambios) ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW reg failed', err));
    }

    // --- 2. LÓGICA DE INICIO (CON SINCRONIZACIÓN A PRUEBA DE BALAS) ---
    async function initApp() {
        startOverlay.style.opacity = '0';
        setTimeout(() => startOverlay.style.display = 'none', 500);
        try {
            const response = await fetch('videos.json');
            videosData = await response.json();
            createVideoElements(videosData);

            requestAnimationFrame(() => {
                console.log("Frame de animación listo. Configurando observador y cargando primer video.");
                const firstWrapper = document.querySelector('.video-wrapper');
                if (firstWrapper) {
                    loadVideo(firstWrapper);
                }
                setupIntersectionObserver();
            });

        } catch (error) {
            console.error('Error al cargar videos.json:', error);
        }
    }
    startOverlay.addEventListener('click', initApp, { once: true });

    // --- 3. CREACIÓN DE ELEMENTOS (sin cambios) ---
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
            playFallback.addEventListener('click', () => {
                video.play();
                playFallback.classList.remove('visible');
            });
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

    // --- 4. LÓGICA DE CARGA Y CACHÉ (CON CACHÉ VERSIONADA) ---
    async function loadVideo(wrapper) {
        const video = wrapper.querySelector('video');
        const src = wrapper.dataset.src;
        if (!src || wrapper.classList.contains('loaded') || wrapper.classList.contains('loading')) return;
        wrapper.classList.add('loading');
        console.log(`Iniciando carga para: ${src}`);

        // Adjuntar el listener de canplay ANTES de asignar el src
        const handleCanPlay = () => {
            console.log(`Video ${src} canplay event fired.`);
            wrapper.classList.add('loaded');
            wrapper.classList.remove('loading');
            video.removeEventListener('canplay', handleCanPlay); // Limpiar el listener
        };
        video.addEventListener('canplay', handleCanPlay, { once: true });

        try {
            const cache = await caches.open('video-cache-v2');
            let response = await cache.match(src);
            if (!response) {
                console.log(`Cache miss para ${src}. Descargando de la red...`);
                const res = await fetch(src);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                await cache.put(src, res.clone());
                response = res;
            }
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
            video.load(); // Forzar la carga del video

        } catch (error) {
            console.error("Error al cargar video:", error);
            wrapper.classList.remove('loading');
        }
    }

    // --- 5. OBSERVADOR (sin cambios) ---
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
                            console.warn(`Autoplay bloqueado para ${video.src}. Mostrando botón de fallback.`, err);
                            playFallback.classList.add('visible');
                        }
                    };
                    // Asegurarse de que el video esté cargado antes de intentar reproducir
                    if (wrapper.classList.contains('loaded')) {
                        playVideo();
                    } else {
                        // Si no está cargado, esperar al evento canplay
                        video.addEventListener('canplay', playVideo, { once: true });
                    }
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

    // --- 6. LÓGICA DE CONTROLES DE VELOCIDAD AL CLICKEAR VIDEO ---
    function setupVideoSpeedCycling(video) {
        const speeds = [1.0, 0.75, 0.5]; // Normal, 0.75x, 0.5x
        let currentSpeedIndex = 0;

        video.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el clic se propague a otros elementos si los hubiera
            currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
            video.playbackRate = speeds[currentSpeedIndex];

            // Mostrar un overlay temporal con la velocidad actual
            const overlay = video.closest('.video-wrapper').querySelector('.info-overlay');
            const infoBox = overlay.querySelector('.info-box');
            infoBox.innerHTML = `<div class="title">Velocidad: ${speeds[currentSpeedIndex]}x</div>`;
            overlay.classList.add('visible');
            setTimeout(() => {
                overlay.classList.remove('visible');
                // Restaurar el contenido original del overlay después de que desaparezca
                const videoInfo = videosData.find(v => video.closest('.video-wrapper').dataset.src.includes(v.src));
                if (videoInfo) {
                    infoBox.innerHTML = `<div class="number">${videoInfo.number}</div><div class="title">${videoInfo.title}</div>`;
                }
            }, 1000); // Mostrar por 1 segundo
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

    
});




