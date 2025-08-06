
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('video-container');
    let videosData = [];

    // --- Cargar datos y crear elementos de video ---
    fetch('videos.json')
        .then(response => response.json())
        .then(data => {
            videosData = data;
            createVideoElements(videosData);
            setupIntersectionObserver();
        })
        .catch(error => console.error('Error al cargar videos.json:', error));

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

    // --- Observador para autoplay y mostrar info ---
    function setupIntersectionObserver() {
        const options = { threshold: 0.5 };
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                const overlay = entry.target.querySelector('.info-overlay');

                if (entry.isIntersecting) {
                    video.play().catch(e => console.log("Autoplay bloqueado"));
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

    // --- Lógica de Zoom y Paneo ---
    function setupZoomAndPan(container, video) {
        let scale = 1;
        let isPanning = false;
        let start = { x: 0, y: 0 };
        let transform = { x: 0, y: 0 };

        const setTransform = () => {
            video.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${scale})`;
        };

        container.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(1, Math.min(scale + delta, 5));
            
            if (newScale === 1) {
                transform = { x: 0, y: 0 };
            } else {
                const rect = video.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                transform.x += (offsetX / scale) * (scale - newScale);
                transform.y += (offsetY / scale) * (scale - newScale);
            }
            scale = newScale;
            setTransform();
        });

        container.addEventListener('mousedown', e => {
            if (scale > 1) {
                isPanning = true;
                start = { x: e.clientX - transform.x, y: e.clientY - transform.y };
                container.style.cursor = 'grabbing';
            }
        });

        container.addEventListener('mousemove', e => {
            if (isPanning) {
                transform.x = e.clientX - start.x;
                transform.y = e.clientY - start.y;
                setTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            isPanning = false;
            container.style.cursor = 'grab';
        });
    }
});
