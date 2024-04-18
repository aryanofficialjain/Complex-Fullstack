import dotenv from "dotenv"
import mongoose from "mongoose";
import express from "express";
import {connectDB} from "./db/index.js"
import { app } from "./app.js";

// const app = express();
// // dotenv.config({
// //     path: './env'
// // })

// app.listen(process.env.PORT, ()=> {
//     console.log("App is listeing");
// })

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.log("ERROR", error)
        throw error
    })
    app.listen(process.env.PORT || 9000, ()=> {
        console.log("App is running ")
    })
})
.catch((error)=> {
    console.log("App error ", error)
})

/*
(async () => {
    try {
        await mongoose.connect(`mongodb+srv://aryan:aryan123456@cluster0.ufxdpfz.mongodb.net/${DB_NAME}`).then(() => {
            console.log("Mongo DB connected Succesfully")
        })
        app.on("error", (error) => {
            console.log("ERROR", error);
            throw error;
        });
        app.listen(8000, () => {
            console.log(`App is listening on ${8000}`);
        });
    } catch (error) {
        console.log("ERROR is here", error);
        throw error;
    }
})();
*/