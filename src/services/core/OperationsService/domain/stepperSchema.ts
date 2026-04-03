import mongoose from "mongoose";
import type { StepperDocument } from "../types.js";

const STEPPER_TTL_SECONDS = 48 * 60 * 60; // 48h

export const stepperSchema = new mongoose.Schema<StepperDocument>(
	{ _id: { type: String }, currentIdx: { type: Number, default: -1 }, createdAt: { type: Date, default: Date.now } },
	{ _id: false, timestamps: false }
);
stepperSchema.index({ createdAt: 1 }, { expireAfterSeconds: STEPPER_TTL_SECONDS });
