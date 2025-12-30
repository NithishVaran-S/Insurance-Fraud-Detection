document.addEventListener('DOMContentLoaded', function() {
    // Theme Toggle with Custom PNG Icons
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('theme-icon');

    // Function to update icon based on theme
    function updateThemeIcon(theme) {
        if (theme === 'light') {
            themeIcon.src = "/static/assets/images/sun.png";
            themeIcon.alt = 'Switch to Dark Mode';
        } else {
            themeIcon.src = "/static/assets/images/brightness.png";
            themeIcon.alt = 'Switch to Light Mode';
        }
    }

    // Set Light Theme as Default
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Theme toggle handler
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);

        // Add animation effect
        this.style.transform = 'rotate(180deg)';
        setTimeout(() => {
            this.style.transform = 'rotate(0deg)';
        }, 300);
    });

    // Enhanced Background Effects
    function createBackgroundParticles() {
        const particleContainer = document.querySelector('.enhanced-particles');
        if (!particleContainer) return;

        // Add more particles dynamically
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'bg-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (20 + Math.random() * 15) + 's';
            particleContainer.appendChild(particle);
        }
    }

    createBackgroundParticles();

    // Theme-aware background updates
    function updateParticleColors() {
        const theme = document.documentElement.getAttribute('data-theme');
        const particles = document.querySelectorAll('.bg-particle, .particle');
        
        particles.forEach(particle => {
            if (theme === 'light') {
                particle.style.background = '#0369a1';
            } else {
                particle.style.background = '#00D2FF';
            }
        });
    }

    // Monitor theme changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                updateParticleColors();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    updateParticleColors();

    // Get Started Button - Redirect to Login Page (ONLY button that redirects)
    const getStartedBtn = document.getElementById('getStartedBtn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', function() {
            window.location.href = "/login";
        });
    }

    // Smooth Scrolling for Navigation Links
    const navLinks = document.querySelectorAll('.nav-item[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Image loading and error handling
    function handleImageLoading() {
        const images = document.querySelectorAll('.feature-card img, .medical-image');
        
        images.forEach(img => {
            // Add loading animation
            img.addEventListener('load', function() {
                this.style.opacity = '0';
                setTimeout(() => {
                    this.style.transition = 'opacity 0.5s ease';
                    this.style.opacity = '1';
                }, 100);
            });
            
            // Handle image load errors
            img.addEventListener('error', function() {
                this.style.background = 'linear-gradient(135deg, var(--card-bg) 0%, var(--border-color) 100%)';
                this.style.display = 'flex';
                this.style.alignItems = 'center';
                this.style.justifyContent = 'center';
                this.style.color = 'var(--text-secondary)';
                this.style.fontSize = '0.9rem';
                this.alt = 'Healthcare Analytics';
            });
        });
    }

    // Enhanced feature card interactions
    function enhanceFeatureCards() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            const img = card.querySelector('img');
            
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-10px) scale(1.02)';
                if (img) {
                    img.style.transform = 'scale(1.1)';
                }
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                if (img) {
                    img.style.transform = 'scale(1)';
                }
            });
        });
    }

    // Professional text animations for new content
    function animateTextElements() {
        const textElements = document.querySelectorAll('.challenge-box, .solution-box, .requirements-list');
        
        const textObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    
                    // Animate list items
                    const listItems = entry.target.querySelectorAll('li');
                    listItems.forEach((item, index) => {
                        setTimeout(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'translateX(0)';
                        }, index * 100);
                    });
                }
            });
        }, { threshold: 0.3 });

        textElements.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'all 0.6s ease';
            
            // Prepare list items for animation
            const listItems = element.querySelectorAll('li');
            listItems.forEach(item => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
                item.style.transition = 'all 0.4s ease';
            });
            
            textObserver.observe(element);
        });
    }

    // Enhanced stats counter with professional formatting
    function animateStatsCounters() {
        const counters = document.querySelectorAll('.stat-item h4');
        counters.forEach(counter => {
            const text = counter.textContent;
            const hasPercent = text.includes('%');
            const hasDollar = text.includes('$');
            const hasPlus = text.includes('+');
            const hasBillion = text.includes('B');
            
            let target = parseFloat(text.replace(/[^0-9.]/g, ''));
            let current = 0;
            const increment = target / 80; // Slower animation for professional feel
            
            const updateCounter = () => {
                if (current < target) {
                    current += increment;
                    let displayValue = Math.floor(current);
                    
                    if (hasDollar && hasBillion) {
                        counter.textContent = '$' + displayValue.toFixed(1) + 'B';
                    } else if (hasDollar) {
                        counter.textContent = '$' + displayValue;
                    } else if (hasPercent) {
                        counter.textContent = displayValue + '%';
                    } else if (hasPlus) {
                        counter.textContent = displayValue + '+';
                    } else if (text.includes('/')) {
                        counter.textContent = displayValue + '/7';
                    } else {
                        counter.textContent = displayValue;
                    }
                    
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = text;
                }
            };
            
            updateCounter();
        });
    }

    // Professional button hover effects
    function enhanceButtonInteractions() {
        const professionalButtons = document.querySelectorAll('.get-started-btn, .stat-highlight');
        
        professionalButtons.forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                if (this.classList.contains('get-started-btn')) {
                    this.style.transform = 'translateY(-3px) scale(1.05)';
                    this.style.boxShadow = '0 20px 40px var(--glow-color)';
                } else {
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 5px 15px var(--glow-color)';
                }
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.transform = this.classList.contains('get-started-btn') ? 
                    'translateY(0) scale(1)' : 'scale(1)';
                this.style.boxShadow = this.classList.contains('get-started-btn') ? 
                    '0 10px 30px var(--glow-color)' : '0 0 5px var(--glow-color)';
            });
        });
    }

    // Enhanced Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const animationObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all animated elements
    const animatedElements = document.querySelectorAll('.feature-card, .stat-item, .feature-item, .challenge-box, .solution-box, .requirements-list');
    animatedElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = `all 0.6s ease ${index * 0.1}s`;
        animationObserver.observe(element);
    });

    // Trigger counter animation when about section is visible
    const aboutSection = document.querySelector('.about-section');
    if (aboutSection) {
        const aboutObserver = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStatsCounters();
                    aboutObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        
        aboutObserver.observe(aboutSection);
    }

    // Dynamic floating data updates
    function updateFloatingData() {
        const dataPoints = document.querySelectorAll('.data-point');
        const values = ['95%', '$2.4M', 'Real-time', 'Secure', '99.9%', 'AI-Powered'];
        
        dataPoints.forEach((point, index) => {
            setInterval(() => {
                const randomValue = values[Math.floor(Math.random() * values.length)];
                point.textContent = randomValue;
                point.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    point.style.transform = 'scale(1)';
                }, 300);
            }, 5000 + (index * 1000));
        });
    }

    // Mobile Menu Toggle
    const menuBtn = document.querySelector('.menu-btn');
    const navLeft = document.querySelector('.nav-left');
    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            navLeft.classList.toggle('mobile-active');
        });
    }

    // Pause animations when page hidden
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            document.body.style.animationPlayState = 'paused';
        } else {
            document.body.style.animationPlayState = 'running';
        }
    });

    // Keyboard shortcut for theme toggle (Ctrl/Cmd + Shift + T)
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            themeToggle.click();
        }
    });

    // Initialize all enhancements
    handleImageLoading();
    enhanceFeatureCards();
    animateTextElements();
    enhanceButtonInteractions();
    updateFloatingData();

    // Hover effects for various elements
    const hoverCards = document.querySelectorAll('.feature-card, .stat-item, .feature-item, .challenge-box, .solution-box');
    hoverCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Button interactions
    const buttons = document.querySelectorAll('.get-started-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.05)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
});
