import express from "express";
import Clan from "../models/Clan.js";
import Player from "../models/Player.js";

const router = express.Router();

router.get("/clans", async (req, res, next) => {
  try {
    const clans = await Clan.find().sort({ createdAt: 1 });
    res.json(clans.map((clan) => ({ name: clan.name, slug: clan.slug })));
  } catch (err) {
    next(err);
  }
});

router.get("/clans/:slug/players", async (req, res, next) => {
  try {
    const clan = await Clan.findOne({ slug: req.params.slug });
    if (!clan) {
      return res.status(404).json({ error: "Clan not found." });
    }

    const players = await Player.find({ clan: clan._id }).sort({ createdAt: 1 });
    res.json({ clan: { name: clan.name, slug: clan.slug }, players });
  } catch (err) {
    next(err);
  }
});

export default router;
