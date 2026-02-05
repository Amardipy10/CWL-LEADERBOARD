import express from "express";
import Player from "../models/Player.js";
import Clan from "../models/Clan.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const WAR_COUNT = 7;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const loadClan = async (req, res, next) => {
  try {
    const clan = await Clan.findOne({ owner: req.user.sub });
    if (!clan) {
      return res.status(400).json({ error: "Create a clan first." });
    }
    req.clan = clan;
    return next();
  } catch (err) {
    return next(err);
  }
};

router.use(requireAuth);
router.use(loadClan);

const parseWarPayload = (body) => {
  const attackStars = Number(body.attackStars);
  const attackPct = Number(body.attackPct);
  const defenseStars = Number(body.defenseStars);
  const defensePct = Number(body.defensePct);

  if (
    !Number.isFinite(attackStars) ||
    !Number.isFinite(attackPct) ||
    !Number.isFinite(defenseStars) ||
    !Number.isFinite(defensePct)
  ) {
    return { error: "All war values must be numbers." };
  }

  if (
    attackStars < 0 ||
    attackStars > 3 ||
    defenseStars < 0 ||
    defenseStars > 3 ||
    attackPct < 0 ||
    attackPct > 100 ||
    defensePct < 0 ||
    defensePct > 100
  ) {
    return { error: "War values out of range." };
  }

  return {
    war: {
      attackStars: clamp(attackStars, 0, 3),
      attackPct: clamp(attackPct, 0, 100),
      defenseStars: clamp(defenseStars, 0, 3),
      defensePct: clamp(defensePct, 0, 100)
    }
  };
};

router.get("/", async (req, res, next) => {
  try {
    const players = await Player.find({ clan: req.clan._id }).sort({ createdAt: 1 });
    res.json(players);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Player name is required." });
    }

    const existing = await Player.findOne({
      clan: req.clan._id,
      name: new RegExp(`^${escapeRegex(name)}$`, "i")
    });
    if (existing) {
      return res.status(409).json({ error: "Player name already exists." });
    }

    const player = await Player.create({ name, clan: req.clan._id });
    res.status(201).json(player);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Player name is required." });
    }

    const existing = await Player.findOne({
      _id: { $ne: req.params.id },
      clan: req.clan._id,
      name: new RegExp(`^${escapeRegex(name)}$`, "i")
    });
    if (existing) {
      return res.status(409).json({ error: "Player name already exists." });
    }

    const player = await Player.findOneAndUpdate(
      { _id: req.params.id, clan: req.clan._id },
      { name },
      { new: true }
    );
    if (!player) {
      return res.status(404).json({ error: "Player not found." });
    }
    res.json(player);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/war/:warIndex", async (req, res, next) => {
  try {
    const warIndex = Number(req.params.warIndex);
    if (!Number.isInteger(warIndex) || warIndex < 0 || warIndex >= WAR_COUNT) {
      return res.status(400).json({ error: "Invalid war index." });
    }

    const { war, error } = parseWarPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const player = await Player.findOne({ _id: req.params.id, clan: req.clan._id });
    if (!player) {
      return res.status(404).json({ error: "Player not found." });
    }

    player.wars[warIndex] = war;
    await player.save();

    res.json(player);
  } catch (err) {
    next(err);
  }
});

router.post("/reset-war/:warIndex", async (req, res, next) => {
  try {
    const warIndex = Number(req.params.warIndex);
    if (!Number.isInteger(warIndex) || warIndex < 0 || warIndex >= WAR_COUNT) {
      return res.status(400).json({ error: "Invalid war index." });
    }

    const path = `wars.${warIndex}`;
    await Player.updateMany(
      { clan: req.clan._id },
      {
        $set: {
          [path]: {
            attackStars: 0,
            attackPct: 0,
            defenseStars: 0,
            defensePct: 0
          }
        }
      }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const player = await Player.findOneAndDelete({ _id: req.params.id, clan: req.clan._id });
    if (!player) {
      return res.status(404).json({ error: "Player not found." });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
