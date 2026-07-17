## A portfolio is a demo, not a resume clone

A resume tells someone what you claim to have done. A portfolio should let them
watch you think. That's the standard I held this site to while rebuilding it, and
it's a useful filter for deciding what goes in and what gets cut.

## What I optimized for

**Speed and restraint.** No framework, no build step, no bloated component library
— just HTML, CSS, and a small amount of hand-written JavaScript for the animated
background and interactions. It loads fast, and every line of script on the page is
something I wrote and understand.

**One clear story per project.** Instead of a wall of bullet points, each project
entry answers three questions: what problem it solves, what I built, and what
technology made that possible. If a visitor only reads the project titles and tags,
they should still walk away with an accurate picture of what I do.

**A working blog, not a placeholder link.** A "Blog" nav item that goes nowhere is
worse than not having one — it signals unfinished work. This site's blog is backed
by real Markdown files rendered client-side, specifically so that writing a new post
is as simple as adding a file to the repo, no CMS or backend required.

## What I left out

I didn't add a contact form, a dark/light theme toggle, or a CMS-backed admin panel.
None of those improve the core job of a portfolio: showing real work quickly, to
someone who is deciding in under a minute whether to keep reading. Every feature I
didn't build is a feature I don't have to maintain, explain, or debug six months from
now.

## The test I use

Before adding anything to this site, I ask: does this make it easier for a stranger
to understand what I can build for them, or is it here because it felt clever to
implement? If the answer is the second one, it doesn't ship.
