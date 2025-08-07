

document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    let videosData = [];
    const videoCache = {}; // Caché en memoria para blobs de video

    // --- 1. REGISTRAR SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker v3 registrado', reg))
            .catch(err => console.error('Error al registrar Service Worker', err));
    }

    // --- 2. LÓGICA DE INICIO ---
    async function initApp() {
        startOverlay.style.opacity = '0';
        setTimeout(() => startOverlay.style.display = 'none', 500);

        try {
            const response = await fetch('videos.json');
            videosData = await response.json();
            createVideoElements(videosData);
            setupIntersectionObserver();
        } catch (error) {
            console.error('Error al cargar videos.json:', error);
        }
    }

    startOverlay.addEventListener('click', initApp, { once: true });

    // --- 3. CREACIÓN DE ELEMENTOS (SIN SRC) ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.videoId = videoInfo.id;
            wrapper.dataset.src = videoInfo.src; // Guardamos la URL original aquí

            const preloader = document.createElement('div');
            preloader.className = 'preloader';
            preloader.innerHTML = `<div class="spinner"></div><div class="progress-text">0%</div>`;

            const video = document.createElement('video');
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'none'; // No cargar nada al principio
            
            wrapper.appendChild(preloader);
            wrapper.appendChild(video);
            wrapper.appendChild(overlay(videoInfo));
            videoContainer.appendChild(wrapper);
            setupZoomAndPan(wrapper, video);
        });
    }
    
    function overlay(info) {
        const el = document.createElement('div');
        el.className = 'info-overlay';
        el.innerHTML = `<div class="info-box"><div class="number">${info.number}</div><div class="title">${info.title}</div></div>`;
        return el;
    }

    // --- 4. LÓGICA DE CARGA Y CACHÉ DE VIDEOS ---
    async function loadVideo(wrapper) {
        const video = wrapper.querySelector('video');
        const src = wrapper.dataset.src;
        if (!src || video.src) return; // Ya cargado o sin fuente

        const preloader = wrapper.querySelector('.preloader');
        const progressText = wrapper.querySelector('.progress-text');
        preloader.classList.remove('hidden');

        try {
            // 1. Buscar en la caché de la Cache API
            const cache = await caches.open('video-cache');
            let response = await cache.match(src);

            if (response) {
                progressText.textContent = '100%';
            } else {
                // 2. Si no está, descargar con progreso
                console.log(`Descargando video: ${src}`);
                const xhr = new XMLHttpRequest();
                xhr.open('GET', src, true);
                xhr.responseType = 'arraybuffer';

                xhr.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentage = Math.floor((event.loaded / event.total) * 100);
                        progressText.textContent = `${percentage}%`;
                    }
                };

                xhr.onload = async () => {
                    if (xhr.status === 200) {
                        const videoData = new Blob([xhr.response]);
                        response = new Response(videoData, { headers: { 'Content-Type': 'video/mp4' } });
                        await cache.put(src, response.clone());
                        setVideoSource(video, response);
                    } else {
                        console.error('Error al descargar video');
                    }
                };
                xhr.send();
                return; // Salir porque la carga es asíncrona
            }
            
            // 3. Asignar la fuente desde la respuesta (cacheada o nueva)
            setVideoSource(video, response);

        } catch (error) {
            console.error("Error al cargar o cachear el video:", error);
            preloader.classList.add('hidden');
        }
    }

    async function setVideoSource(video, response) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        video.parentElement.querySelector('.preloader').classList.add('hidden');
    }

    // --- 5. OBSERVADOR PARA LAZY LOADING ---
    function setupIntersectionObserver() {
        const options = { rootMargin: '200px 0px' };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const wrapper = entry.target;
                    loadVideo(wrapper);
                    
                    const next = wrapper.nextElementSibling;
                    if (next) loadVideo(next);
                    const prev = wrapper.previousElementSibling;
                    if (prev) loadVideo(prev);

                    const video = wrapper.querySelector('video');
                    if (video.paused && video.src) video.play().catch(e => {});
                    
                    const overlay = wrapper.querySelector('.info-overlay');
                    overlay.classList.add('visible');
                    setTimeout(() => overlay.classList.remove('visible'), 3000);
                } else {
                    const video = entry.target.querySelector('video');
                    video.pause();
                }
            });
        }, options);
        document.querySelectorAll('.video-wrapper').forEach(w => observer.observe(w));
    }

    // --- 6. ZOOM Y PANEO (sin cambios) ---
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

    // --- 7. PANTALLA COMPLETA (sin cambios) ---
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
});

