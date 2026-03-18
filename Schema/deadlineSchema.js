import mongoose from "mongoose";

const deadlineSchema = new mongoose.Schema({
  Deadline_Title: { type: String, required: true },
  Date: { type: String, required: true },
  Super_Script: { type: String, required: true },
  Month: { type: String, required: true },
  Year: { type: String, required: true },
});

const Deadline_Schema = mongoose.model("Deadline", deadlineSchema);

export default Deadline_Schema;
