

document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    let videosData = [];

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

    // --- 3. CREACIÓN DE ELEMENTOS (CON BOTÓN DE PLAY FALLBACK) ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.src = videoInfo.src;

            const preloader = document.createElement('div');
            preloader.className = 'preloader';
            preloader.innerHTML = `<div class="spinner"></div><div class="progress-text">0%</div>`;

            const video = document.createElement('video');
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'none';

            const playFallback = document.createElement('div');
            playFallback.className = 'play-fallback';
            playFallback.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            playFallback.addEventListener('click', () => {
                video.play();
                playFallback.classList.remove('visible');
            });

            wrapper.appendChild(preloader);
            wrapper.appendChild(video);
            wrapper.appendChild(overlay(videoInfo));
            wrapper.appendChild(playFallback);
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

    // --- 4. LÓGICA DE CARGA Y CACHÉ ---
    async function loadVideo(wrapper) {
        const video = wrapper.querySelector('video');
        const src = wrapper.dataset.src;
        if (!src || video.src) return;

        const preloader = wrapper.querySelector('.preloader');
        const progressText = wrapper.querySelector('.progress-text');
        preloader.classList.remove('hidden');

        try {
            const cache = await caches.open('video-cache');
            let response = await cache.match(src);

            if (!response) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', src, true);
                xhr.responseType = 'arraybuffer';
                xhr.onprogress = e => progressText.textContent = e.lengthComputable ? `${Math.floor((e.loaded / e.total) * 100)}%` : 'Cargando';
                
                const xhrLoadPromise = new Promise((resolve, reject) => {
                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            const res = new Response(xhr.response, { headers: { 'Content-Type': 'video/mp4' } });
                            cache.put(src, res.clone());
                            resolve(res);
                        } else {
                            reject('Error descargando video');
                        }
                    };
                    xhr.onerror = () => reject('Error de red');
                });
                xhr.send();
                response = await xhrLoadPromise;
            }
            
            const blob = await response.blob();
            video.src = URL.createObjectURL(blob);
            preloader.classList.add('hidden');

        } catch (error) {
            console.error("Error al cargar video:", error);
            preloader.classList.add('hidden');
        }
    }

    // --- 5. OBSERVADOR CON LÓGICA DE FALLBACK ---
    function setupIntersectionObserver() {
        const options = { rootMargin: '100px 0px', threshold: 0.5 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(async entry => {
                const wrapper = entry.target;
                const video = wrapper.querySelector('video');
                const playFallback = wrapper.querySelector('.play-fallback');

                if (entry.isIntersecting) {
                    await loadVideo(wrapper);
                    
                    const next = wrapper.nextElementSibling; if (next) loadVideo(next);
                    const prev = wrapper.previousElementSibling; if (prev) loadVideo(prev);

                    try {
                        await video.play();
                        playFallback.classList.remove('visible');
                    } catch (err) {
                        console.warn("Autoplay bloqueado. Mostrando botón de fallback.");
                        playFallback.classList.add('visible');
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

    // --- 6. ZOOM Y PANEO ---
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

    // --- 7. PANTALLA COMPLETA ---
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
});

