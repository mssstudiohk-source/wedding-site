import express from "express";
import { chooseDateHandler } from "./api/choose-date.js";

const app = express();
app.use(express.json());
app.post("/choose-date", chooseDateHandler);
app.get("/", (_req, res)=> res.send("擇日 MVP server running. POST /choose-date"));

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log("Listening on http://localhost:"+port));
