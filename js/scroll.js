// ===========================================
// SCROLL-TRIGGERED FADE-IN
// ===========================================

const fadeTargets = document.querySelectorAll(".fade");

const fadeObserver = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add("active");
            fadeObserver.unobserve(entry.target);

        }

    });

}, { threshold: 0.15 });

fadeTargets.forEach(target => fadeObserver.observe(target));
