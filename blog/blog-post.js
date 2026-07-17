// ===========================================
// BLOG POST — fetch metadata + markdown, render article
// ===========================================

async function loadPost() {

    const container = document.getElementById("postArticle");

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    if (!slug) {

        container.innerHTML = `<p>No post specified.</p>`;
        return;

    }

    try {

        const [posts, mdRes] = await Promise.all([
            fetch("posts.json").then(r => r.json()),
            fetch(`posts/${encodeURIComponent(slug)}.md`)
        ]);

        if (!mdRes.ok) throw new Error("Post not found");

        const meta = posts.find(p => p.slug === slug);
        const markdown = await mdRes.text();

        const title = meta ? meta.title : slug;

        document.title = `${title} — Ahmet Cevdet Bülbül`;

        const metaHtml = meta ? `
            <div class="post-meta">
                <time datetime="${meta.date}">${formatDate(meta.date)}</time>
                <div class="tags">
                    ${meta.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
                </div>
            </div>
        ` : "";

        container.innerHTML = `
            <a class="back-link" href="index.html">&larr; Back to blog</a>
            ${metaHtml}
            <h1>${escapeHtml(title)}</h1>
            <div class="post-content">${marked.parse(markdown)}</div>
        `;

    } catch (err) {

        container.innerHTML = `
            <a class="back-link" href="index.html">&larr; Back to blog</a>
            <p>This post couldn't be found.</p>
        `;
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

loadPost();
