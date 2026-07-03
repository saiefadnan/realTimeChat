const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { users } = require("../sockets/chatSocket");
const { uploadImageToCloudinary } = require("../services/storage/cloudinary");

const secretKey = process.env.JWT_SECRET;

/**
 * POST /api/login
 */
const loginData = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ login: false, notify: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(200)
        .json({ login: false, notify: "Invalid login attempt." });
    }

    const passMatch = await user.comparePassword(password);
    if (!passMatch) {
      return res
        .status(200)
        .json({ login: false, notify: "Invalid login attempt." });
    }

    if (users[user.username]) {
      return res.status(200).json({
        login: false,
        notify: "You are currently logged in elsewhere!",
      });
    }

    const jwtoken = jwt.sign(
      {
        username: user.username,
        imageurl: user.profilePicture,
      },
      secretKey,
      { expiresIn: "30d" },
    );

    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    return res.status(200).json({
      login: true,
      notify: `Welcome back, ${user.username}!`,
      token: jwtoken,
    });
  } catch (err) {
    console.error("[Login] Error:", err);
    return res.status(500).json({ error: "An internal error occurred." });
  }
};

/**
 * POST /api/signin
 */
const signinData = async (req, res) => {
  try {
    const { email, username, password, profile } = req.body;

    if (!email || !username || !password) {
      return res
        .status(400)
        .json({ signin: false, notify: "All fields are required." });
    }

    const [existingUser, existingEmail] = await Promise.all([
      User.findOne({ username }),
      User.findOne({ email }),
    ]);

    if (existingUser || existingEmail) {
      return res.status(200).json({
        signin: false,
        notify: "Email or username already exists. Please log in.",
      });
    }

    let blobPath =
      "https://gifdb.com/images/high/eren-yeager-blowing-hair-o63aaatimhxaojbu.gif";

    if (profile) {
      try {
        const { imageUrl } = await uploadImageToCloudinary(profile);
        blobPath = imageUrl;
      } catch (uploadErr) {
        console.warn(
          "[Signup] Cloudinary upload failed, using default avatar:",
          uploadErr.message,
        );
      }
    }

    const user = new User({
      username,
      password,
      email,
      profilePicture: blobPath,
    });
    await user.save();

    const jwtoken = jwt.sign(
      {
        username: user.username,
        imageurl: user.profilePicture,
      },
      secretKey,
      { expiresIn: "30d" },
    );

    return res.status(201).json({
      signin: true,
      notify: `Successfully registered! Welcome, ${user.username}!`,
      token: jwtoken,
    });
  } catch (err) {
    console.error("[Signup] Error:", err);
    return res.status(500).json({ error: "An internal error occurred." });
  }
};

module.exports = {
  loginData,
  signinData,
};
