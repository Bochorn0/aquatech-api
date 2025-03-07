import mongoose from 'mongoose';

const CitySchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  }
});

const City = mongoose.model('City', CitySchema);
export default City;