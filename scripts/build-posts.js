// Scans blog/posts/*.md, reads each file's YAML-ish frontmatter, and
// (re)generates blog/posts.json. Run by .github/workflows/build-posts.yml
// on every push that touches blog/posts/**, and can also be run locally:
//   node scripts/build-posts.js

const fs = require("fs");
const path = require("path");

const postsDir = path.join(__dirname, "..", "blog", "posts");
const outFile = path.join(__dirname, "..", "blog", "posts.json");

function parseFrontmatter(raw, filename) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
        throw new Error(`${filename}: missing frontmatter (---\\n...\\n---) block`);
    }

    const meta = {};

    for (const line of match[1].split(/\r?\n/)) {
        if (!line.trim()) continue;

        const idx = line.indexOf(":");
        if (idx === -1) continue;

        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();

        // Strip matching quotes: title: "Some: Title"
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (key === "tags") {
            value = value
                .replace(/^\[/, "")
                .replace(/\]$/, "")
                .split(",")
                .map(t => t.trim().replace(/^["']|["']$/g, ""))
                .filter(Boolean);
        }

        meta[key] = value;
    }

    for (const field of ["title", "date", "excerpt", "tags"]) {
        if (!meta[field]) {
            throw new Error(`${filename}: frontmatter missing required field "${field}"`);
        }
    }

    return meta;
}

function build() {
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith(".md"));

    const posts = files.map(file => {
        const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
        const meta = parseFrontmatter(raw, file);
        const slug = file.replace(/\.md$/, "");

        return {
            slug,
            title: meta.title,
            date: meta.date,
            excerpt: meta.excerpt,
            tags: meta.tags
        };
    });

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(outFile, JSON.stringify(posts, null, 2) + "\n");
    console.log(`Wrote ${posts.length} post(s) to ${path.relative(process.cwd(), outFile)}`);
}

build();
