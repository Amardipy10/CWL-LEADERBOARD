import express from "express";
import Clan from "../models/Clan.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const clan = await Clan.findOne({ owner: req.user.sub });
    if (!clan) {
      return res.json({ clan: null });
    }
    res.json({ clan: { id: clan._id, name: clan.name, slug: clan.slug } });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Clan name is required." });
    }

    const owned = await Clan.findOne({ owner: req.user.sub });
    if (owned) {
      return res.status(409).json({ error: "You already have a clan." });
    }

    const existing = await Clan.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, "i")
    });
    if (existing) {
      return res.status(409).json({ error: "Clan name already exists." });
    }

    const slug = slugify(name);
    if (!slug) {
      return res.status(400).json({ error: "Clan name is invalid." });
    }

    const slugExists = await Clan.findOne({ slug });
    if (slugExists) {
      return res.status(409).json({ error: "Clan slug already exists." });
    }

    const clan = await Clan.create({ name, slug, owner: req.user.sub });
    res.status(201).json({ clan: { id: clan._id, name: clan.name, slug: clan.slug } });
  } catch (err) {
    next(err);
  }
});

export default router;
