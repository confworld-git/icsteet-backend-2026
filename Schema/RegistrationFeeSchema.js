import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  early_bird_usd: { type: Number, required: true },
  final_usd: { type: Number, required: true },
});

const participantSchema = new mongoose.Schema({
  physical_onsite: {
    type: categorySchema,
    required: true,
  },
  virtual_online: {
    type: categorySchema,
    required: true,
  },
});

const RegistrationFeeSchema = new mongoose.Schema({
  participation: { type: participantSchema, required: true },
});

const Registration_Fee_Schema = mongoose.model(
  "registration_fees",
  RegistrationFeeSchema
);

export default Registration_Fee_Schema;
