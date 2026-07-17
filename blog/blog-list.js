// ===========================================
// BLOG LIST — fetch posts.json and render cards
// ===========================================

async function loadPosts() {

    const list = document.getElementById("postList");

    try {

        const res = await fetch("posts.json");
        const posts = await res.json();

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        list.innerHTML = posts.map(post => `
            <a class="post-card glass fade" href="post.html?slug=${encodeURIComponent(post.slug)}">
                <time datetime="${post.date}">${formatDate(post.date)}</time>
                <h2>${escapeHtml(post.title)}</h2>
                <p>${escapeHtml(post.excerpt)}</p>
                <div class="tags">
                    ${post.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
                </div>
            </a>
        `).join("");

        document.querySelectorAll(".fade").forEach(el => {

            const observer = new IntersectionObserver((entries) => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add("active");
                        observer.unobserve(entry.target);

                    }

                });

            }, { threshold: 0.1 });

            observer.observe(el);

        });

    } catch (err) {

        list.innerHTML = `<p>Couldn't load posts right now.</p>`;
        console.error(err);

    }

}

function formatDate(dateStr) {

    const date = new Date(dateStr);

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });

}

function escapeHtml(str) {

    const div = document.createElement("div");

    div.textContent = str;

    return div.innerHTML;

}

loadPosts();
