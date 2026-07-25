// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET;

// if (!JWT_SECRET) {
//   throw new Error("JWT_SECRET is missing in environment variables.");
// }

// /**
//  * Generate JWT Access Token
//  */
// export const generateAccessToken = (user) => {
//   return jwt.sign(
//     {
//       id: user._id.toString(),
//       email: user.email,
//       role: user.role,
//       plan: user.plan ?? "free",
//     },
//     JWT_SECRET,
//     {
//       expiresIn: "1h",
//     },
//   );
// };

// /**
//  * Verify JWT Access Token
//  */
// export const verifyAccessToken = (token) => {
//   return jwt.verify(token, JWT_SECRET);
// };

const jwt = require("jsonwebtoken");

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const verifyJwt = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyJwt,
};
