import mongoose from "mongoose";

const spotSchema = new mongoose.Schema(
  {
    committeeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    organizerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    area: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    locality: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    district: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    state: {
      type: String,
      required: true,
      enum: ["Andhra Pradesh"],
      default: "Andhra Pradesh",
    },

    date: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },



    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },

    /*
      Google Maps link.
    */

    mapUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    /*
      Number of visitors who clicked Interested.
    */

    interestedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },

  {
    timestamps: true,
  },
);

spotSchema.index({
  date: 1,
  area: 1,
  locality: 1,
});

export default mongoose.model("Spot", spotSchema);
