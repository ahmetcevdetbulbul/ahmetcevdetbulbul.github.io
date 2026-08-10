---
title: "Planning an Unreal Engine Project: NPCs and AI Optimization"
date: 2026-08-10
excerpt: Notes on a project I'm scoping out — adding NPCs to an Unreal Engine level and getting their AI to scale, built around Behavior Trees and State Trees.
tags: [Unreal Engine, AI, Game Development]
---

## Why this project

I want to build a small Unreal Engine scene populated with NPCs that actually behave like
they're doing something — patrolling, reacting to the player, making decisions — instead of
standing around playing an idle animation. The interesting part isn't spawning a character
model; it's the decision-making layer underneath it, and making that layer hold up once
there are more than two or three NPCs on screen at once.

This post is me thinking through the approach before writing any code: what I'm planning to
build, which systems I'll lean on, and where I expect the optimization problems to show up.

## The AI layer: Behavior Tree vs. State Tree

Unreal gives you two main tools for this kind of NPC logic:

- **Behavior Tree** — the long-standing system: a tree of tasks, selectors, and sequences
  evaluated top-down every tick (or on a configurable interval). Well documented, lots of
  existing tooling, easiest to start with.
- **State Tree** — the newer, more explicit state-machine-like system. Transitions are data-driven
  and the tree only re-evaluates the branches that need it, which is the part that matters for
  scaling to many NPCs.

My current plan is to start with a Behavior Tree for a single NPC to get the core loop working
(detect player → decide → act), then migrate the decision logic to a State Tree once I have more
than one NPC archetype, specifically to see how much of a difference the more targeted
re-evaluation makes in practice.

## What "optimization" means here

For a handful of NPCs, none of this matters — anything will run fine. The plan is to
deliberately push past that point and see where things break down, then fix it:

- **Tick/update intervals** — not every NPC needs to re-evaluate its behavior every frame;
  spacing out AI ticks (and staggering them across NPCs) should be the first lever.
- **Relevance-based LOD for AI** — NPCs far from the player or outside its view frustum can run
  a cheaper, lower-frequency version of their logic.
- **Shared perception vs. per-NPC senses** — using Unreal's AI Perception system efficiently
  instead of having every NPC run its own expensive line-of-sight checks independently.

## What's next

Next step is the boring but necessary one: a minimal level with a single NPC on a Behavior Tree
that can see the player and react. Once that loop is solid, I'll scale up NPC count and start
measuring — actual tick costs, not guesses — before deciding whether the State Tree migration is
worth it. If the numbers are interesting, I'll write a follow-up with the real benchmarks.
