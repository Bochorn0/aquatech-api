import mongoose from "mongoose";

const ControllerSchema = new mongoose.Schema(
  {
    active_time: { type: Number },
    last_time_active: { type: Number },
    product_type: { type: String },
    create_time: { type: Number },
    kfactor_tds: { type: Number },
    kfactor_flujo: { type: Number },
    icon: { type: String },
    id: { type: String, unique: true, index: true }, // id del ESP32
    ip: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    drive: { type: String },
    lat: { type: String },
    lon: { type: String },
    model: { type: String },
    name: { type: String, required: true },
    online: { type: Boolean, default: false },
    owner_id: { type: String },
    product_id: { type: String },
    product_name: { type: String },
    sub: { type: Boolean, default: false },
    time_zone: { type: String, default: "-07:00" },

    // 🔥 Nuevos campos
    reset_pending: { type: Boolean, default: false },   // Botón remoto
    update_controller_time: { type: Number, default: 10000 }, // default 10 seg
    loop_time: { type: Number, default: 1000 },           // default 1 seg
    flush_time: { type: Number, default: 20000 }, // default 20 seg
  },
  { timestamps: true }
);

export default mongoose.model("Controller", ControllerSchema);
