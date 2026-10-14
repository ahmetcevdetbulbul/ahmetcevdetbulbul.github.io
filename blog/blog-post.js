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
        const markdown = stripFrontmatter(await mdRes.text());

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

        enhancePostContent(container);
        setupLanguage(container, meta, title);

    } catch (err) {

        container.innerHTML = `
            <a class="back-link" href="index.html">&larr; Back to blog</a>
            <p>This post couldn't be found.</p>
        `;
        console.error(err);

    }

}

function enhancePostContent(container) {

    container.querySelectorAll("pre").forEach(pre => {
        const code = pre.querySelector("code");
        const match = code && code.className.match(/language-(\w+)/);
        if (match) pre.setAttribute("data-lang", match[1]);
    });

    if (window.hljs) {
        container.querySelectorAll("pre code").forEach(block => hljs.highlightElement(block));
    }

    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false },
                { left: "$", right: "$", display: false }
            ]
        });
    }

}

// İki dilli yazılar: [data-lang="en|tr"] bölümleri varsa EN/TR seçici ekler (varsayılan: İngilizce)
function setupLanguage(container, meta, enTitle) {

    const sections = container.querySelectorAll("[data-lang]");
    const frames = container.querySelectorAll("iframe[data-demo-src]");

    // gömülü demolar dil parametresiyle bir kez yüklenir
    const initial = readLang();
    frames.forEach(f => { f.src = f.dataset.demoSrc + "?lang=" + initial; });

    if (!sections.length) return;

    const h1 = container.querySelector("h1");
    const switcher = document.createElement("div");
    switcher.className = "lang-switch";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Language");
    switcher.innerHTML = `<button data-lang="en">EN</button><button data-lang="tr">TR</button>`;
    container.insertBefore(switcher, container.querySelector(".post-meta") || h1);

    function apply(lang, persist) {

        sections.forEach(s => { s.hidden = s.dataset.lang !== lang; });
        switcher.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));

        const t = (lang === "tr" && meta && meta.title_tr) ? meta.title_tr : enTitle;
        if (h1) {
            h1.textContent = t;
            h1.classList.toggle("long-title", t.length > 80);
        }
        document.title = `${t} — Ahmet Cevdet Bülbül`;
        document.documentElement.lang = lang;

        frames.forEach(f => {
            if (f.contentWindow) f.contentWindow.postMessage({ type: "set-lang", lang }, window.location.origin);
        });

        if (persist) {
            try { localStorage.setItem("blog-lang", lang); } catch (e) {}
        }

    }

    switcher.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b) apply(b.dataset.lang, true);
    });

    apply(initial, false);

}

function readLang() {

    try {
        const s = localStorage.getItem("blog-lang");
        if (s === "tr" || s === "en") return s;
    } catch (e) {}

    return "en";

}

function stripFrontmatter(markdown) {
    return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
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

// Gömülü interaktif demolar (iframe) kendi yüksekliklerini bildirir
window.addEventListener("message", (e) => {

    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.type !== "iframe-height") return;

    document.querySelectorAll(".demo-embed iframe").forEach(frame => {

        if (frame.contentWindow === e.source) {
            frame.style.height = Math.ceil(e.data.height) + "px";
        }

    });

});

loadPost();
