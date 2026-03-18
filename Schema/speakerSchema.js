import mongoose from "mongoose";

const SpeakerSchema = mongoose.Schema({
  Title: {
    type: String,
  },
  Speaker_Name: {
    type: String,
  },
  Speaker_About_One: {
    type: String,
  },
  Speaker_About_Two: {
    type: String,
  },
  Speaker_About_Three: {
    type: String,
  },
  Speaker_About_Four: {
    type: String,
  },
  Speaker_Image: {
    data: Buffer,
    contentType: String,
  },
  position: {
    type: Number,
    required: true,
  },
});

export default SpeakerSchema;
