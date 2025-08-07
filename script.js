
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    const startOverlay = document.getElementById('start-overlay');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    let videosData = [];
    let hasInteracted = false;

    // --- 1. REGISTRAR SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado', reg))
            .catch(err => console.error('Error al registrar Service Worker', err));
    }

    // --- 2. LÓGICA DE INICIO ---
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
        } catch (error) {
            console.error('Error al cargar videos.json:', error);
        }
    }

    startOverlay.addEventListener('click', initApp);

    // --- 3. CREACIÓN DE ELEMENTOS (PREPARADO PARA LAZY LOADING) ---
    function createVideoElements(videos) {
        videos.forEach(videoInfo => {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.videoId = videoInfo.id;

            const preloader = document.createElement('div');
            preloader.className = 'preloader';
            preloader.innerHTML = `<div class="spinner"></div><div class="progress-text">0%</div>`;

            const video = document.createElement('video');
            // NO establecemos el src aquí. Lo guardamos en un data-attribute.
            video.dataset.src = videoInfo.src;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata'; // Solo cargar metadatos al principio

            const progressText = preloader.querySelector('.progress-text');

            video.addEventListener('waiting', () => preloader.classList.remove('hidden'));
            video.addEventListener('canplay', () => preloader.classList.add('hidden'));
            video.addEventListener('progress', () => {
                if (video.buffered.length > 0 && video.duration) {
                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    const percentage = Math.floor((bufferedEnd / video.duration) * 100);
                    progressText.textContent = `${percentage}%`;
                }
            });

            const overlay = document.createElement('div');
            overlay.className = 'info-overlay';
            overlay.innerHTML = `<div class="info-box"><div class="number">${videoInfo.number}</div><div class="title">${videoInfo.title}</div></div>`;
            
            wrapper.appendChild(preloader);
            wrapper.appendChild(video);
            wrapper.appendChild(overlay);
            videoContainer.appendChild(wrapper);

            setupZoomAndPan(wrapper, video);
        });
    }

    // --- 4. OBSERVADOR CON LÓGICA DE LAZY LOADING ---
    function setupIntersectionObserver() {
        const options = { rootMargin: '200px 0px' }; // Empezar a cargar antes de que sea visible

        const loadVideo = (el) => {
            const video = el.querySelector('video');
            if (video && video.dataset.src && !video.src) {
                console.log(`Cargando video: ${video.dataset.src}`)
                video.src = video.dataset.src;
                video.load(); // Iniciar la carga del video
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const videoWrapper = entry.target;
                const video = videoWrapper.querySelector('video');

                if (entry.isIntersecting) {
                    // Cargar video actual
                    loadVideo(videoWrapper);

                    // Precargar siguiente y anterior
                    const nextSibling = videoWrapper.nextElementSibling;
                    if (nextSibling) loadVideo(nextSibling);
                    const prevSibling = videoWrapper.previousElementSibling;
                    if (prevSibling) loadVideo(prevSibling);

                    // Reproducir video actual
                    if (video.paused) {
                        video.play().catch(e => {});
                    }
                    videoWrapper.querySelector('.info-overlay').classList.add('visible');
                    setTimeout(() => videoWrapper.querySelector('.info-overlay').classList.remove('visible'), 3000);
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        }, options);

        document.querySelectorAll('.video-wrapper').forEach(wrapper => observer.observe(wrapper));
    }

    // --- 5. ZOOM Y PANEO (sin cambios) ---
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

    // --- 6. PANTALLA COMPLETA (sin cambios) ---
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    });
});
