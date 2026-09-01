document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.pageType !== 'center') return;

    // ======================================================
    // HEADER TRACKER
    // ======================================================
    const header = document.querySelector('header');
    const root = document.documentElement;
    const DESKTOP_BREAKPOINT = 991;

    if (header) {
        let lastHeight = header.getBoundingClientRect().height;

        root.style.setProperty('--_size---header--top-height', `${lastHeight}px`);

        const resizeObserver = new ResizeObserver(([entry]) => {
            const headerHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;

            if (headerHeight === lastHeight) return;

            lastHeight = headerHeight;

            root.style.setProperty('--_size---header--top-height', `${headerHeight}px`);
        });

        resizeObserver.observe(header);
    }

    // ======================================================
    // Lazy-load Heavy Form Utilities (Phone Input)
    // ======================================================
    const phoneInput = document.querySelector('#phoneNumber');

    if (phoneInput) {
        let intlInitialized = false;
        let iti;

        const initPhoneInput = () => {
            if (intlInitialized || !window.intlTelInput) return;

            intlInitialized = true;

            iti = window.intlTelInput(phoneInput, {
                initialCountry: 'in',
                countrySearch: false,
                loadUtils: () => import('https://cdn.jsdelivr.net/npm/intl-tel-input@29.1.2/dist/js/utils.js'),
            });
        };

        ['focus', 'pointerenter', 'touchstart'].forEach((evt) => {
            phoneInput.addEventListener(evt, initPhoneInput, {
                once: true,
                passive: true,
            });
        });

        document.querySelectorAll('form').forEach((form) => {
            form.addEventListener('submit', () => {
                // Initialize if the user somehow submits without triggering focus/pointer events
                if (!intlInitialized) {
                    initPhoneInput();
                }

                if (iti) {
                    phoneInput.value = iti.getNumber();
                }
            });
        });
    }

    // ======================================================
    // ANCHOR NAV & SCROLLSPY
    // ======================================================

    const HEADER_HEIGHT_VAR = '--_size---header--top-height';
    const SECTION_OFFSET = 0;

    const anchor = document.querySelector('.anchor-nav-sticky');
    const track = document.querySelector('.anchor-nav-track');
    const indicator = document.querySelector('.anchor-nav-indicator');
    const leadCard = document.querySelector('.lead-card');

    if (track && indicator) {
        const linkMap = new Map();
        const sectionMap = new Map();

        track.querySelectorAll('.anchor-nav-link').forEach((link) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                const id = href.slice(1);
                const section = document.getElementById(id);
                if (section) {
                    linkMap.set(id, link);
                    sectionMap.set(id, section);
                }
            }
        });

        if (linkMap.size) {
            let activeLink = null;
            let isManualScrolling = false;
            let manualScrollTimer = null;

            // Accurate horizontal offset math
            const getLinkRelativeLeft = (link) => {
                const trackRect = track.getBoundingClientRect();
                const linkRect = link.getBoundingClientRect();
                return linkRect.left - trackRect.left + track.scrollLeft;
            };

            const getScrollOffset = () => {
                const cssVarHeight = parseFloat(getComputedStyle(root).getPropertyValue(HEADER_HEIGHT_VAR)) || 0;
                const aHeight = anchor?.offsetHeight || 0;
                return cssVarHeight + aHeight + SECTION_OFFSET;
            };

            const updateLeadCardPosition = () => {
                if (!leadCard) return;

                if (window.innerWidth >= DESKTOP_BREAKPOINT) {
                    const combinedTop = getScrollOffset() + 20;
                    leadCard.style.top = `${combinedTop}px`;
                } else {
                    leadCard.style.top = '';
                }
            };

            // Indicator Movement (GPU Transform)
            const moveIndicator = (link, animate = true) => {
                if (!link || !track || !indicator) return;

                const left = getLinkRelativeLeft(link);
                const width = link.getBoundingClientRect().width;

                if (!animate) {
                    indicator.style.transition = 'none';
                }

                indicator.style.width = `${width}px`;
                indicator.style.transform = `translateY(-50%) translateX(${left}px)`;

                if (!animate) {
                    requestAnimationFrame(() => {
                        indicator.style.transition = '';
                    });
                }
            };

            // Center link inside horizontal track
            const centerLinkInTrack = (link, smooth = false) => {
                if (!track || track.scrollWidth <= track.clientWidth) return;

                const linkLeft = getLinkRelativeLeft(link);
                const targetScrollLeft = linkLeft - track.clientWidth / 2 + link.getBoundingClientRect().width / 2;

                if (smooth) {
                    track.scrollTo({
                        left: targetScrollLeft,
                        behavior: 'smooth',
                    });
                } else {
                    // Strategy A core: Instant assignment prevents horizontal animation collisions
                    track.scrollLeft = targetScrollLeft;
                }
            };

            const setActive = (link, animateIndicator = true, centerTrack = true, smoothTrack = false) => {
                if (!link) return;

                if (activeLink && activeLink !== link) {
                    activeLink.classList.remove('is-active');
                    activeLink.setAttribute('aria-current', 'false');
                }

                link.classList.add('is-active');
                link.setAttribute('aria-current', 'true');
                activeLink = link;

                requestAnimationFrame(() => {
                    // Instant snap alignment on click
                    if (centerTrack) {
                        centerLinkInTrack(link, smoothTrack);
                    }
                    // Move indicator
                    moveIndicator(link, animateIndicator);
                });
            };

            const attachObserverTargets = () => {
                sectionMap.forEach((section) => observer.observe(section));
            };

            const visibleSections = new Map();

            const observer = new IntersectionObserver(
                (entries) => {
                    if (isManualScrolling) return;

                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            visibleSections.set(entry.target.id, entry.boundingClientRect.top);
                        } else {
                            visibleSections.delete(entry.target.id);
                        }
                    });

                    if (!visibleSections.size) return;

                    let topSectionId = null;
                    let minTop = Infinity;

                    visibleSections.forEach((top, id) => {
                        if (top < minTop) {
                            minTop = top;
                            topSectionId = id;
                        }
                    });

                    if (topSectionId && linkMap.has(topSectionId)) {
                        // Passive manual page scroll: Smoothly slide indicator & center track
                        setActive(linkMap.get(topSectionId), true, true, true);
                    }
                },
                {
                    rootMargin: `-${getScrollOffset() + 20}px 0px -40% 0px`,
                    threshold: 0,
                },
            );

            attachObserverTargets();

            // Click Event Handler (Strategy A Execution)
            track.addEventListener(
                'click',
                (e) => {
                    const link = e.target.closest('.anchor-nav-link');
                    if (!link) return;

                    const href = link.getAttribute('href');
                    if (!href || !href.startsWith('#')) return;

                    e.preventDefault();
                    e.stopImmediatePropagation();

                    const targetId = href.slice(1);
                    const targetSection = sectionMap.get(targetId);

                    if (!targetSection) return;

                    // 1. Completely disconnect observer during click scroll
                    isManualScrolling = true;
                    observer.disconnect();
                    visibleSections.clear();

                    // 2. Strategy A: Instant Track & Indicator Snap (centerTrack=true, smoothTrack=true)
                    setActive(link, true, true, true);

                    // 3. Initiate vertical window smooth scroll
                    const targetTop = targetSection.getBoundingClientRect().top + window.scrollY;

                    window.scrollTo({
                        top: targetTop - getScrollOffset(),
                        behavior: 'smooth',
                    });

                    // 4. Re-enable IntersectionObserver after landing
                    const reattachObserver = () => {
                        if (manualScrollTimer) clearTimeout(manualScrollTimer);
                        window.removeEventListener('scrollend', reattachObserver);

                        attachObserverTargets();
                        isManualScrolling = false;
                    };

                    if ('onscrollend' in window) {
                        window.addEventListener('scrollend', reattachObserver, {
                            once: true,
                        });
                    }

                    if (manualScrollTimer) clearTimeout(manualScrollTimer);
                    manualScrollTimer = setTimeout(reattachObserver, 1000);
                },
                true,
            );

            // Resize Listener
            let resizeTimer;
            window.addEventListener(
                'resize',
                () => {
                    clearTimeout(resizeTimer);

                    resizeTimer = setTimeout(() => {
                        updateLeadCardPosition();

                        if (activeLink) {
                            moveIndicator(activeLink, false);
                        }
                    }, 100);
                },
                {
                    passive: true,
                },
            );

            // Initial Load
            updateLeadCardPosition();
            const initialLink = linkMap.values().next().value;
            if (initialLink) setActive(initialLink, false, true, false);

            window.addEventListener(
                'load',
                () => {
                    updateLeadCardPosition();
                    if (activeLink) moveIndicator(activeLink, false);
                },
                {
                    once: true,
                },
            );
        }
    }

    // ======================================================
    // TAB CLICK INVIEW
    // ======================================================
    const menu = document.querySelector('.w-tab-menu');
    if (menu) {
        menu.addEventListener('click', (e) => {
            const tab = e.target.closest('.w-tab-link');
            if (!tab) return;

            requestAnimationFrame(() => {
                const left = tab.offsetLeft - menu.clientWidth / 2 + tab.clientWidth / 2;
                menu.scrollTo({
                    left,
                    behavior: 'smooth',
                });
            });
        });
    }

    // ======================================================
    // MOBILE LEAD FORM MODAL
    // ======================================================

    const sidebar = document.querySelector('.page-sidebar');
    const mobileCTA = document.querySelector('#modalOpen');
    const mobileCtaWrap = document.querySelector('.cta-sticky-mob');
    const overlay = document.querySelector('.modal-overlay');
    const footer = document.querySelector('#footer');

    if (sidebar && mobileCTA) {
        const openModal = () => {
            if (window.innerWidth >= DESKTOP_BREAKPOINT) return;

            sidebar.classList.add('is-open');
            document.body.classList.add('modal-open');
        };

        const closeModal = () => {
            sidebar.classList.remove('is-open');
            document.body.classList.remove('modal-open');
        };

        mobileCTA.addEventListener('click', openModal);

        overlay?.addEventListener('click', closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        window.addEventListener(
            'resize',
            () => {
                if (window.innerWidth >= DESKTOP_BREAKPOINT) {
                    closeModal();
                }
            },
            {
                passive: true,
            },
        );
    }

    if (mobileCtaWrap && footer) {
        const footerObserver = new IntersectionObserver(
            ([entry]) => {
                mobileCtaWrap.classList.toggle('is-hidden', entry.isIntersecting);
            },
            {
                rootMargin: '0px 0px 50% 0px',
                threshold: 0,
            },
        );

        footerObserver.observe(footer);
    }

    // ======================================================
    // Embla Carousel Code
    // ======================================================

    const mainViewport = document.querySelector('.embla-main-viewport');
    const thumbsViewport = document.querySelector('.embla-thumbs-viewport');

    if (!mainViewport || !thumbsViewport || typeof EmblaCarousel === 'undefined') {
        return;
    }

    const thumbs = [...document.querySelectorAll('.embla-thumbs-slide')];
    if (!thumbs.length) return;

    const emblaMain = EmblaCarousel(mainViewport, {
        loop: true,
        align: 'center',
    });

    const emblaThumbs = EmblaCarousel(thumbsViewport, {
        containScroll: 'keepSnaps',
        dragFree: true,
        align: 'center',
    });

    let activeThumb = null;

    const updateActiveThumb = () => {
        const selected = emblaMain.selectedScrollSnap();
        const selectedThumb = thumbs[selected];

        activeThumb?.classList.remove('is-active');
        selectedThumb?.classList.add('is-active');
        activeThumb = selectedThumb;

        emblaThumbs.scrollTo(selected);
    };

    thumbs.forEach((thumb, index) => {
        thumb.addEventListener('click', () => emblaMain.scrollTo(index));
    });

    emblaMain.on('select', updateActiveThumb);
    updateActiveThumb();
});