document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas.getContext("2d");
    const loader = document.getElementById("loader");

    const frameCount = 200;
    const currentFrame = index => `ezgif-frame-${String(index).padStart(3, '0')}.png`;

    const images = [];
    let loadedImages = 0;

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        render(); // render current frame immediately upon resize
    };

    window.addEventListener('resize', resizeCanvas);

    // Preload all frames before starting animation
    const preloadImages = () => {
        // Fallback in case loading gets stuck
        const loadTimeout = setTimeout(() => {
            if (loadedImages > 0 && !animationRunning) {
                initAnimation();
            }
        }, 10000);

        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            img.src = currentFrame(i);
            images.push(img);

            img.onload = () => {
                loadedImages++;
                if (loadedImages === frameCount) {
                    clearTimeout(loadTimeout);
                    initAnimation();
                }
            };
            img.onerror = () => {
                loadedImages++; // Skip broken images so it doesn't hang
                if (loadedImages === frameCount) {
                    clearTimeout(loadTimeout);
                    initAnimation();
                }
            };
        }
    };

    let animationRunning = false;
    let sequenceIndex = 0;
    let lastTime = 0;
    const fps = 30; // Target FPS for playback
    const interval = 1000 / fps;

    const render = () => {
        const img = images[sequenceIndex];
        // Don't render if image isn't fully loaded
        if (!img || !img.complete || img.naturalWidth === 0) return;

        // Fill canvas background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Aspect ratio handling (object-fit: cover equivalent)
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (canvasRatio > imgRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * imgRatio;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Hide Veo watermark (bottom right corner of the actual image)
        const watermarkWidth = drawWidth * 0.15; // 15% of width
        const watermarkHeight = drawHeight * 0.15; // 15% of height
        const watermarkX = offsetX + drawWidth - watermarkWidth;
        const watermarkY = offsetY + drawHeight - watermarkHeight;

        ctx.fillStyle = '#000000';
        ctx.fillRect(watermarkX, watermarkY, watermarkWidth + 2, watermarkHeight + 2);
    };

    const runAnimation = (timestamp) => {
        requestAnimationFrame(runAnimation);

        const deltaTime = timestamp - lastTime;

        if (deltaTime >= interval) {
            lastTime = timestamp - (deltaTime % interval);
            render();
            sequenceIndex = (sequenceIndex + 1) % frameCount;
        }
    };

    const initAnimation = () => {
        if (animationRunning) return;
        animationRunning = true;

        // Fade out loader
        loader.style.opacity = '0';

        setTimeout(() => {
            loader.style.display = 'none';
            resizeCanvas();

            // Start the loop
            requestAnimationFrame((timestamp) => {
                lastTime = timestamp;
                runAnimation(timestamp);
            });

            // Trigger beautiful CSS text animations
            const heroTop = document.querySelector('.hero-top');
            const heroDashboard = document.querySelector('.hero-dashboard-wrapper');
            if (heroTop) heroTop.classList.add('loaded');
            if (heroDashboard) heroDashboard.classList.add('loaded');
        }, 500); // Wait for CSS transition
    };

    preloadImages();

    // --- Landing Page Interactions ---

    // Navbar Scroll Effect
    const navbar = document.querySelector('.reflect-nav');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Countdown Timer Logic
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        // Target date for the techfest based on exact user requested offset
        // March 16 10:27 AM + 38 days, 22 hours, 18 minutes = ~ April 24, 2026, 08:45:00 
        const targetDate = new Date("April 24, 2026 08:45:00").getTime();

        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                countdownDisplay.innerHTML = "AAYAM IS LIVE";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            countdownDisplay.innerHTML = `T-Minus ${days}d ${hours}h ${minutes}m <span style="color:var(--text-muted); font-size: 0.8em">${String(seconds).padStart(2, '0')}s</span>`;
        };

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
});
