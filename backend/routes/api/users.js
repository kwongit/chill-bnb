const express = require("express");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");

const { setTokenCookie, requireAuth } = require("../../utils/auth");
const { User } = require("../../db/models");

const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");

const router = express.Router();

// Validation middleware for the signup request
const validateSignup = [
  check("email")
    .exists({ checkFalsy: true })
    .isEmail()
    .withMessage("The provided email is invalid."),
  check("username")
    .exists({ checkFalsy: true })
    .isLength({ min: 4 })
    .withMessage("Please provide a username with at least 4 characters."),
  check("username").not().isEmail().withMessage("Username cannot be an email."),
  check("password")
    .exists({ checkFalsy: true })
    .isLength({ min: 6 })
    .withMessage("Password must be 6 characters or more."),
  handleValidationErrors,
];

// Route to sign up a user
router.post("/", validateSignup, async (req, res) => {
  const { firstName, lastName, email, password, username } = req.body;

  // Check if a user with the same email or username already exists
  const existingUserEmail = await User.findOne({
    where: { email: email },
  });
  const existingUsername = await User.findOne({
    where: { username: username },
  });

  if (existingUserEmail && existingUsername) {
    return res.status(500).json({
      message: "Email/user already exists",
      errors: {
        email: ["Email must be unique."],
        username: ["Username must be unique."],
      },
    });
  }

  if (existingUserEmail) {
    return res.status(500).json({
      message: "Email already exists",
      errors: { email: "Email must be unique." },
    });
  }

  if (existingUsername) {
    return res.status(500).json({
      message: "User already exists",
      errors: { username: "Usename must be unique." },
    });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password);

  // Create the new user
  const user = await User.create({
    firstName,
    lastName,
    email,
    username,
    hashedPassword,
  });

  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
  };

  await setTokenCookie(res, safeUser);

  return res.status(200).json({
    user: safeUser,
  });
});

module.exports = router;
