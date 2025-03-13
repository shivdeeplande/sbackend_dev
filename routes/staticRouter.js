const express = require("express");

const router = express.Router();

router.get("/privacy-policy", async (req, res) => {
  return res.render("privacypolicy");
});
router.get("/terms-conditions", async (req, res) => {
  return res.render("termsconditions");
});


module.exports = router;
