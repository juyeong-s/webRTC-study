import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("인덱스 화면");
});

export default router;
