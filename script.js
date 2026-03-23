document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const loader = document.getElementById("loader");

    const frameCount = 200;
    const currentFrame = index => `compressed_img/ezgif-frame-${String(index).padStart(3, '0')}.png`;

    const images = [];
    let loadedImages = 0;

    const resizeCanvas = () => {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
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
    const fps = 60; // Target FPS for smoother playback
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

        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // object-fit: contain logic for mobile
            if (canvasRatio < imgRatio) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgRatio;
            } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgRatio;
            }
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            // object-fit: cover logic for desktop
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
            const heroTop = document.querySelector('.hero-technex-wrapper');
            if (heroTop) heroTop.classList.add('loaded');
        }, 500); // Wait for CSS transition
    };

    if (canvas) {
        preloadImages();
    } else {
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }

    // --- Landing Page Interactions ---

    // Navbar Scroll Effect
    const navbar = document.querySelector('#main-nav');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 80) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Mobile Menu Toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mobileOverlay = document.querySelector('.mobile-menu-overlay');
    const mobileClose = document.querySelector('.mobile-menu-close');
    if (mobileBtn && mobileOverlay) {
        mobileBtn.addEventListener('click', () => {
            mobileBtn.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
        });
        if (mobileClose) {
            mobileClose.addEventListener('click', () => {
                mobileBtn.classList.remove('active');
                mobileOverlay.classList.remove('active');
            });
        }
        mobileOverlay.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileBtn.classList.remove('active');
                mobileOverlay.classList.remove('active');
            });
        });
    }



    // Section Fade-in Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');

                // Stagger children if needed
                const staggeredKids = entry.target.querySelectorAll('.staggered-item');
                staggeredKids.forEach((kid, i) => {
                    setTimeout(() => {
                        kid.classList.add('is-visible');
                    }, i * 100);
                });

                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-section').forEach(section => {
        sectionObserver.observe(section);
    });

    // Countdown Timer Logic
    const countdownContainer = document.querySelector('.singularity-timer-container');
    if (countdownContainer) {
        // Target date: exactly 35 days 14 hours from Mar 19 2026
        const targetDate = new Date("April 24, 2026 08:53:39").getTime();

        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) return;

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const dEl = document.getElementById('t-days');
            const hEl = document.getElementById('t-hours');
            const mEl = document.getElementById('t-mins');
            const sEl = document.getElementById('t-secs');

            if (dEl) dEl.innerText = String(days).padStart(2, '0');
            if (hEl) hEl.innerText = String(hours).padStart(2, '0');
            if (mEl) mEl.innerText = String(minutes).padStart(2, '0');
            if (sEl) sEl.innerText = String(seconds).padStart(2, '0');
        };

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // Stats Counter Animation
    const statsStrip = document.querySelector('.stats-strip');
    let hasCounted = false;
    if (statsStrip) {
        const statObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasCounted) {
                hasCounted = true;
                const counters = document.querySelectorAll('.stat-number');
                const speed = 200; // The lower the slower

                counters.forEach(counter => {
                    const updateCount = () => {
                        const target = +counter.getAttribute('data-target');
                        const count = +counter.innerText;
                        const inc = target / speed;

                        if (count < target) {
                            counter.innerText = Math.ceil(count + inc);
                            setTimeout(updateCount, 15);
                        } else {
                            counter.innerText = target;
                        }
                    };
                    updateCount();
                });
            }
        });
        statObserver.observe(statsStrip);
    }

    // Schedule Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.schedule-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const btn = item.querySelector('.faq-question');
        btn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(i => i.classList.remove('active'));
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

});

// ==========================================
// SPACE BACKGROUND (Stars & Shooting Stars)
// ==========================================
function initSpaceBackground() {
    const bgContainer = document.getElementById('global-space-bg');
    if (!bgContainer) return;

    const numStars = 150;

    // Create static/twinkling stars
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.classList.add('bg-star');

        // Random position
        const x = Math.random() * 100; // vw
        const y = Math.random() * 100; // vh

        // Random size
        const size = Math.random() * 2.5 + 0.5; // 0.5px to 3px

        // Random twinkle animation duration and delay
        const duration = Math.random() * 3 + 2; // 2s to 5s
        const delay = Math.random() * 5;

        star.style.left = `${x}vw`;
        star.style.top = `${y}vh`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${delay}s`;

        bgContainer.appendChild(star);
    }

    // Function to create a shooting star periodically
    function createShootingStar() {
        const shootingStar = document.createElement('div');
        shootingStar.classList.add('shooting-star');

        // Random starting position (mostly top right half to shoot down-left)
        const startX = Math.random() * 100 + 20; // 20vw to 120vw
        const startY = Math.random() * 60 - 20;  // -20vh to 40vh

        shootingStar.style.left = `${startX}vw`;
        shootingStar.style.top = `${startY}vh`;

        bgContainer.appendChild(shootingStar);

        // Remove after animation completes
        setTimeout(() => {
            if (shootingStar.parentNode) {
                shootingStar.parentNode.removeChild(shootingStar);
            }
        }, 4000); // matches the 4s CSS animation
    }

    // Generate shooting stars at random intervals
    setInterval(() => {
        if (Math.random() > 0.4) { // 60% chance every interval
            createShootingStar();
        }
    }, 3000);
}

// Initialize space background when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initSpaceBackground();
});

// Fade to Black Animation Function
function animateToEventsPage() {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'fade-to-black-overlay';
    document.body.appendChild(overlay);

    // Navigate to events page after animation completes
    setTimeout(() => {
        window.location.href = 'events.html';
    }, 1200); // 1.2 seconds to match animation duration
}
