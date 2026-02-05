import mongoose from "mongoose";

const WarSchema = new mongoose.Schema(
  {
    attackStars: { type: Number, default: 0, min: 0, max: 3 },
    attackPct: { type: Number, default: 0, min: 0, max: 100 },
    defenseStars: { type: Number, default: 0, min: 0, max: 3 },
    defensePct: { type: Number, default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

const warsDefault = () => Array.from({ length: 7 }, () => ({ }));

const PlayerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    clan: { type: mongoose.Schema.Types.ObjectId, ref: "Clan", required: true },
    wars: { type: [WarSchema], default: warsDefault }
  },
  { timestamps: true }
);

export default mongoose.model("Player", PlayerSchema);
