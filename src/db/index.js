import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


export const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.DB_URL}/${DB_NAME}`)
        console.log(`MOngodb Succesfully Connected ${connectionInstance.connection.host}`);

        
    } catch (error) {
        console.log("MONGO connection ERROR ", error)
        process.exit(1)
    }
}


